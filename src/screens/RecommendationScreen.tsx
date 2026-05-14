import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin } from '@react-three/xr';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { runClearanceAnalysis } from '../engine/clearance';
import CorrectionArrow from '../ar/CorrectionArrow';
import type { RoomDimensions, Violation } from '../types';

const xrRecommendationStore = createXRStore({
  offerSession: false,
  emulate: false,
  hitTest: false,
  planeDetection: false,
  domOverlay: true,
});

function getRoomDimensions(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };
  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

function formatFixInstruction(violation: Violation): string {
  const label = violation.fixDirectionLabel.toLowerCase();
  const prefix = `Move ${violation.fixDirectionCm} cm`;

  if (label.includes('toward') || label.includes('away')) return `${prefix} ${label}`;
  if (label.includes('north')) return `${prefix} toward the north wall`;
  if (label.includes('south')) return `${prefix} toward the south wall`;
  if (label.includes('east')) return `${prefix} toward the east wall`;
  if (label.includes('west')) return `${prefix} toward the west wall`;
  return `${prefix} in the recommended direction`;
}

function getBadgeColor(classification: Violation['classification']) {
  if (classification === 'RED') return '#E24B4A';
  if (classification === 'YELLOW') return '#F0A500';
  return '#94A3B8';
}

export default function RecommendationScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);

  const recommendations = useViolationStore((s) => s.recommendations);
  const currentStepIndex = useViolationStore((s) => s.currentStepIndex);
  const spaceScoreBefore = useViolationStore((s) => s.spaceScoreBefore);
  const spaceScoreAfter = useViolationStore((s) => s.spaceScoreAfter);
  const resolveCurrentStep = useViolationStore((s) => s.resolveCurrentStep);
  const advanceCurrentStep = useViolationStore((s) => s.advanceCurrentStep);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);

  const [arState, setArState] = useState<'starting' | 'active' | 'error'>('starting');

  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomWidthCm, roomLengthCm],
  );

  const unresolvedViolations = useMemo(
    () => recommendations.filter((violation) => !violation.resolved),
    [recommendations],
  );

  const currentViolation = unresolvedViolations[currentStepIndex];
  const currentStepNumber = Math.min(currentStepIndex + 1, unresolvedViolations.length);
  const totalSteps = unresolvedViolations.length;
  const isLastStep = currentStepNumber === totalSteps;

  useEffect(() => {
    if (spaceScoreAfter === 0) {
      setSpaceScoreAfter(result.spaceScoreBefore);
    }
  }, [result.spaceScoreBefore, setSpaceScoreAfter, spaceScoreAfter]);

  useEffect(() => {
    let active = true;

    async function startAR() {
      try {
        await xrRecommendationStore.enterAR();
        if (active) setArState('active');
      } catch (err) {
        if (active) {
          // preserve the error for diagnostics and update AR state
          console.warn(err);
          setArState('error');
        }
      }
    }

    startAR();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (recommendations.length === 0 && result.violations.length > 0) {
      refreshViolations(result.violations);
    }
  }, [recommendations.length, refreshViolations, result.violations]);

  if (!currentViolation) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">
            &lt;
          </button>
          <div className="screen-header-info">
            <span className="step-label">Recommendation complete</span>
            <h2>All steps finished</h2>
          </div>
        </div>

        <div className="card">
          <p className="card-title">No more recommendation steps remain.</p>
          <p className="card-subtitle">You can continue to the post-session evaluation now.</p>
        </div>

        <button className="btn btn-primary" onClick={() => navigateTo('surveyEnd')}>
          Go to evaluation
        </button>
      </div>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round((currentViolation.measuredCm / currentViolation.requiredCm) * 100),
  );

  async function handleDone() {
    resolveCurrentStep();
    const refreshed = runClearanceAnalysis(items, roomWidthCm, roomLengthCm);
    refreshViolations(refreshed.violations);
    setSpaceScoreAfter(refreshed.spaceScoreBefore);

    const outstanding = refreshed.violations.some((violation) => !violation.resolved);
    if (!outstanding) {
      navigateTo('surveyEnd');
    }
  }

  function handleSkip() {
    advanceCurrentStep();
    if (isLastStep) {
      navigateTo('surveyEnd');
    }
  }

  const renderedItem = items.find((item) => item.id === currentViolation.furnitureId);

  return (
    <div className="screen" style={{ paddingBottom: 24 }}>
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">
          &lt;
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step {currentStepNumber} of {totalSteps}</span>
          <h2>Recommendation</h2>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <p className="card-title">Move your {currentViolation.furnitureLabel}</p>
            <p className="card-subtitle" style={{ marginTop: 8 }}>{formatFixInstruction(currentViolation)}</p>
          </div>
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              background: getBadgeColor(currentViolation.classification),
              color: '#111827',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {currentViolation.ruleCode}
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <p className="info-label">Measured</p>
            <p className="info-value">{currentViolation.measuredCm} cm</p>
          </div>
          <div>
            <p className="info-label">Required</p>
            <p className="info-value">{currentViolation.requiredCm} cm</p>
          </div>
        </div>

        <div style={{ marginTop: 20, height: 12, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: currentViolation.classification === 'RED' ? '#E24B4A' : '#F0A500',
            }}
          />
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
          {currentViolation.measuredCm} cm of {currentViolation.requiredCm} cm gap
        </p>

        <p style={{ marginTop: 20, color: '#475569', fontSize: 13 }}>
          Priority Score: {currentViolation.priorityScore.toLocaleString()}
        </p>
      </div>

      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', minHeight: 320, marginBottom: 20, border: '1px solid rgba(148, 163, 184, 0.2)' }}>
        <Canvas style={{ width: '100%', height: 320, background: '#0f172a' }} gl={{ antialias: true, alpha: true }}>
          <XR store={xrRecommendationStore}>
            <XROrigin>
              <ambientLight intensity={0.9} />
              <directionalLight position={[1.5, 5, 2]} intensity={0.7} />
              <CorrectionArrow
                posX={renderedItem?.posX ?? 0}
                posZ={renderedItem?.posZ ?? 0}
                fixDirectionLabel={currentViolation.fixDirectionLabel}
                fixDirectionCm={currentViolation.fixDirectionCm}
                classification={currentViolation.classification}
              />
            </XROrigin>
          </XR>
        </Canvas>
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            color: '#ffffff',
            fontSize: 13,
          }}
        >
          {arState === 'active' && 'AR camera active'}
          {arState === 'starting' && 'Launching AR camera...'}
          {arState === 'error' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setArState('starting');
                xrRecommendationStore.enterAR().catch(() => setArState('error'));
              }}
            >
              Retry AR
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="card-title">Space Utilization</p>
            <p className="card-subtitle">Live score after each confirmed fix</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="info-value">{spaceScoreAfter.toFixed(1)}%</p>
            <p className="info-label">After score</p>
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 14 }}>
            <p className="info-label">Before</p>
            <p className="info-value">{spaceScoreBefore.toFixed(1)}%</p>
          </div>
          <div style={{ padding: 14, background: '#ECFDF5', borderRadius: 14 }}>
            <p className="info-label">Improvement</p>
            <p className="info-value" style={{ color: '#16A34A' }}>
              {(spaceScoreAfter - spaceScoreBefore).toFixed(1)} pts
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={handleSkip}
          style={{ flex: '1 1 48%' }}
        >
          Skip this step
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={handleDone}
          style={{ flex: '1 1 48%' }}
        >
          Done — I moved it ✓
        </button>
      </div>
    </div>
  );
}
