import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import ClearanceOverlay from '../ar/ClearanceOverlay';
import CorrectionArrow from '../ar/CorrectionArrow';
import { createFurnitureShape } from '../ar/shapeLibrary';
import { runClearanceAnalysis } from '../engine/clearance';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import type { FurnitureItem, RoomDimensions, Violation } from '../types';

const xrRecommendationStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: true,
  planeDetection: true,
  domOverlay: true,
});

function getRoomDimensions(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };
  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

function getColor(classification: Violation['classification']) {
  return classification === 'RED' ? '#E24B4A' : '#F0A500';
}

function FurnitureMesh({ item }: { item: FurnitureItem }) {
  const { geometry, boundingBox } = useMemo(
    () =>
      createFurnitureShape(item.shape, {
        lengthCm: item.lengthCm,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
      }),
    [item.heightCm, item.lengthCm, item.shape, item.widthCm],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group position={[item.posX, boundingBox.heightM / 2, item.posZ]} rotation={[0, item.rotationY, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#2B4E8C" roughness={0.45} metalness={0.05} />
      </mesh>
    </group>
  );
}

export default function RecommendationScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const recommendations = useViolationStore((s) => s.recommendations);
  const currentStepIndex = useViolationStore((s) => s.currentStepIndex);
  const setCurrentStepIndex = useViolationStore((s) => s.setCurrentStepIndex);
  const resolveCurrentStep = useViolationStore((s) => s.resolveCurrentStep);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const advanceCurrentStep = useViolationStore((s) => s.advanceCurrentStep);
  const spaceScoreAfter = useViolationStore((s) => s.spaceScoreAfter);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);
  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);
  const [arError, setArError] = useState('');

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomLengthCm, roomWidthCm],
  );

  useEffect(() => {
    if (recommendations.length === 0 && result.violations.length > 0) {
      refreshViolations(result.violations);
      setSpaceScoreAfter(result.spaceScoreBefore);
    }
  }, [recommendations.length, refreshViolations, result.spaceScoreBefore, result.violations, setSpaceScoreAfter]);

  const activeViolation =
    recommendations[currentStepIndex] && !recommendations[currentStepIndex].resolved
      ? recommendations[currentStepIndex]
      : recommendations.find((violation) => !violation.resolved);
  const activeIndex = activeViolation
    ? recommendations.findIndex((violation) => violation.id === activeViolation.id)
    : -1;
  const totalSteps = recommendations.length;
  const completedSteps = recommendations.filter((violation) => violation.resolved).length;
  const displayedScore = spaceScoreAfter || result.spaceScoreBefore;

  useEffect(() => {
    if (!activeViolation && totalSteps > 0) {
      setSpaceScoreAfter(result.spaceScoreBefore);
      navigateTo('end_survey');
    }
  }, [activeViolation, navigateTo, result.spaceScoreBefore, setSpaceScoreAfter, totalSteps]);

  async function launchAR() {
    setArError('');
    try {
      await xrRecommendationStore.enterAR();
    } catch (error) {
      setArError(error instanceof Error ? error.message : String(error));
    }
  }

  function handleSkip() {
    advanceCurrentStep();
    if (activeIndex >= totalSteps - 1) {
      setSpaceScoreAfter(result.spaceScoreBefore);
      navigateTo('end_survey');
    }
  }

  function handleDone() {
    if (!activeViolation) return;
    if (activeIndex >= 0) setCurrentStepIndex(activeIndex);
    resolveCurrentStep();
    const updated = runClearanceAnalysis(items, roomWidthCm, roomLengthCm);
    refreshViolations(updated.violations);
    setSpaceScoreAfter(updated.spaceScoreBefore);

    const unresolvedAfterCurrent = recommendations.some(
      (violation, index) => index > activeIndex && !violation.resolved,
    );
    if (!unresolvedAfterCurrent) navigateTo('end_survey');
  }

  if (!activeViolation) {
    return (
      <div className="screen">
        <div className="card">
          <p className="card-title">No recommendation steps available.</p>
          <p className="card-subtitle">Return to analysis or continue to evaluation.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigateTo('end_survey')}>
          Continue to evaluation
        </button>
      </div>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round((activeViolation.measuredCm / activeViolation.requiredCm) * 100),
  );
  const color = getColor(activeViolation.classification);

  return (
    <div className="screen" style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">
          ←
        </button>
        <span style={stepBadgeStyle}>Step {activeIndex + 1} of {totalSteps}</span>
      </div>

      <section style={{ height: '45vh', minHeight: 300, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative', marginBottom: 16 }}>
        <Canvas style={{ width: '100%', height: '100%', background: '#f8fafc' }} gl={{ antialias: true, alpha: true }}>
          <XR store={xrRecommendationStore}>
            <ambientLight intensity={1.25} />
            <directionalLight position={[3, 5, 3]} intensity={0.9} />
            <XROrigin />
            {items.map((item) => (
              <FurnitureMesh key={item.id} item={item} />
            ))}
            <ClearanceOverlay
              items={items}
              classifications={result.allClassifications}
              roomWidthCm={roomWidthCm}
              roomLengthCm={roomLengthCm}
              highlightedRuleCode={activeViolation.ruleCode}
            />
            <CorrectionArrow violation={activeViolation} items={items} />
          </XR>
        </Canvas>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={launchAR}
          style={{ position: 'absolute', top: 12, right: 12, width: 'auto' }}
        >
          Open AR
        </button>
      </section>

      {arError && <p className="form-error">{arError}</p>}

      <section className="card" style={{ borderLeft: `5px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ ...badgeStyle, backgroundColor: color }}>{activeViolation.classification}</span>
          <span style={{ color: '#64748b', fontSize: 11 }}>
            Priority Score: {activeViolation.priorityScore.toLocaleString()}
          </span>
        </div>
        <h2 style={{ margin: '14px 0 6px', fontSize: 24, color: 'var(--text-primary)' }}>
          Move your {activeViolation.furnitureLabel}
        </h2>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F3864' }}>
          {activeViolation.fixDirectionCm} cm {activeViolation.fixDirectionLabel}
        </p>

        <div style={{ marginTop: 20 }}>
          <div style={{ height: 14, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: color }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#64748b', fontSize: 12 }}>
            <span>Current: {activeViolation.measuredCm}cm</span>
            <span>Needed: {activeViolation.requiredCm}cm</span>
          </div>
        </div>

        <p style={{ margin: '18px 0 0', color: '#64748b', fontSize: 13 }}>
          Rule {activeViolation.ruleCode} — {activeViolation.ruleLabel}
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn btn-secondary" type="button" onClick={handleSkip}>
          Skip this step
        </button>
        <button className="btn btn-primary" type="button" onClick={handleDone}>
          Done - I moved it
        </button>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="card-subtitle">Free floor area</span>
          <strong>{displayedScore.toFixed(1)}%</strong>
        </div>
        <p className="card-subtitle" style={{ marginTop: 8 }}>
          {completedSteps} of {totalSteps} violations resolved
        </p>
      </div>
    </div>
  );
}

const stepBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 600,
  color: '#1F3864',
  backgroundColor: '#e6edf8',
  padding: '3px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  color: 'white',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};
