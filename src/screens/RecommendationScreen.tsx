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

/** Extract a compass arrow from the fixDirectionLabel string */
function getDirectionArrow(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('north')) return '↑';
  if (l.includes('south')) return '↓';
  if (l.includes('east'))  return '→';
  if (l.includes('west'))  return '←';
  return '↗';
}

function getDirectionWord(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('north')) return 'North';
  if (l.includes('south')) return 'South';
  if (l.includes('east'))  return 'East';
  if (l.includes('west'))  return 'West';
  return label;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FurnitureMesh({ item }: { item: FurnitureItem }) {
  const { geometry, boundingBox } = useMemo(
    () => createFurnitureShape(item.shape, { lengthCm: item.lengthCm, widthCm: item.widthCm, heightCm: item.heightCm }),
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecommendationScreen() {
  const navigateTo       = useSessionStore((s) => s.navigateTo);
  const roomDimensions   = useSessionStore((s) => s.roomDimensions);
  const items            = useFurnitureStore((s) => s.items);
  const recommendations  = useViolationStore((s) => s.recommendations);
  const currentStepIndex = useViolationStore((s) => s.currentStepIndex);
  const setCurrentStepIndex = useViolationStore((s) => s.setCurrentStepIndex);
  const resolveCurrentStep  = useViolationStore((s) => s.resolveCurrentStep);
  const refreshViolations   = useViolationStore((s) => s.refreshViolations);
  const advanceCurrentStep  = useViolationStore((s) => s.advanceCurrentStep);
  const spaceScoreAfter     = useViolationStore((s) => s.spaceScoreAfter);
  const setSpaceScoreAfter  = useViolationStore((s) => s.setSpaceScoreAfter);

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
      : recommendations.find((v) => !v.resolved);

  const activeIndex    = activeViolation ? recommendations.findIndex((v) => v.id === activeViolation.id) : -1;
  const totalSteps     = recommendations.length;
  const completedSteps = recommendations.filter((v) => v.resolved).length;
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
    } catch (err) {
      setArError(err instanceof Error ? err.message : String(err));
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
    const moreLeft = recommendations.some((v, i) => i > activeIndex && !v.resolved);
    if (!moreLeft) navigateTo('end_survey');
  }

  // ── Empty / all-done state ────────────────────────────────────────────────
  if (!activeViolation) {
    return (
      <div className="screen" style={{ maxWidth: 640 }}>
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
          <div className="screen-header-info">
            <span className="step-label">Recommendations</span>
            <h2>Fix Violations</h2>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)', borderLeft: '5px solid #4CAF50' }}>
          <p className="card-title" style={{ color: '#166534', fontSize: '1.125rem' }}>All violations addressed</p>
          <p className="card-subtitle" style={{ marginTop: 6 }}>
            You have resolved or skipped all recommendations. Continue to the survey.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }} onClick={() => navigateTo('end_survey')}>
            Continue to Survey
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round((activeViolation.measuredCm / activeViolation.requiredCm) * 100));
  const color = getColor(activeViolation.classification);
  const arrow = getDirectionArrow(activeViolation.fixDirectionLabel);
  const dirWord = getDirectionWord(activeViolation.fixDirectionLabel);

  return (
    <div className="screen" style={{ maxWidth: 640, paddingBottom: 96 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
        <div className="screen-header-info">
          <span className="step-label">Recommendations</span>
          <h2>Fix Violations</h2>
        </div>
        <span style={stepCountStyle}>{activeIndex + 1} / {totalSteps}</span>
      </div>

      {/* ── Per-violation progress track ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-md)' }}>
        {recommendations.map((v, i) => (
          <div
            key={v.id}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              transition: 'background 0.4s ease',
              background: v.resolved   ? '#4CAF50'
                        : i === activeIndex ? color
                        : '#E2E8F0',
            }}
          />
        ))}
      </div>

      {/* ── Main instruction card — key remounts & animates on change ──── */}
      <section
        key={activeViolation.id}
        className="card"
        style={{ borderLeft: `5px solid ${color}`, animation: 'screenFadeIn 0.3s ease' }}
      >
        {/* Rule badge + Priority */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ ...chipStyle, background: color, color: '#fff' }}>
              {activeViolation.ruleCode}
            </span>
            <span style={{ ...chipStyle, background: color === '#E24B4A' ? '#FEF2F2' : '#FFFBEB', color }}>
              {activeViolation.classification}
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
            Priority {activeViolation.priorityScore.toLocaleString()}
          </span>
        </div>

        {/* What to move */}
        <p style={{ margin: '0 0 2px', fontSize: '0.8125rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Furniture to move
        </p>
        <p style={{ margin: '0 0 18px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {activeViolation.furnitureLabel}
        </p>

        {/* Direction box */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: color === '#E24B4A' ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${color === '#E24B4A' ? '#FECACA' : '#FCD34D'}`,
          borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{arrow}</div>
          <div>
            <p style={{ margin: 0, fontSize: 26, fontWeight: 850, color, lineHeight: 1 }}>
              {activeViolation.fixDirectionCm} cm
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 14, fontWeight: 600, color: '#475569' }}>
              toward the {dirWord.toLowerCase()} wall
            </p>
          </div>
        </div>

        {/* Clearance progress bar */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Clearance gap</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              {activeViolation.measuredCm} cm → {activeViolation.requiredCm} cm needed
            </span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: '#E2E8F0', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.4s ease' }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
            Rule {activeViolation.ruleCode} — {activeViolation.ruleLabel} · Shortfall: {activeViolation.shortfallCm} cm
          </p>
        </div>
      </section>

      {/* ── AR Guidance ─────────────────────────────────────────────────── */}
      <section className="card card-sm">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="card-title">AR Correction Guide</p>
            <p className="card-subtitle">See the direction arrow live in your room</p>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={launchAR}
            style={{ width: 'auto', minWidth: 96, fontSize: '0.875rem', padding: '10px 14px', minHeight: 42, flexShrink: 0 }}
          >
            Open AR
          </button>
        </div>

        {arError && (
          <p className="form-error" style={{ marginTop: 8 }}>{arError}</p>
        )}

        {/*
          Canvas is kept in DOM at zero height so the WebXR session can attach.
          When the user taps "Open AR", the session takes over the full display
          regardless of canvas size — this hidden canvas just provides the
          WebGL context. Do NOT remove it.
        */}
        <div style={{ height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
          <Canvas style={{ width: '100%', height: 1 }} gl={{ antialias: false, alpha: true }}>
            <XR store={xrRecommendationStore}>
              <ambientLight intensity={1.25} />
              <directionalLight position={[3, 5, 3]} intensity={0.9} />
              <XROrigin />
              {items.map((item) => <FurnitureMesh key={item.id} item={item} />)}
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
        </div>
      </section>

      {/* ── Session progress ─────────────────────────────────────────────── */}
      <div className="card card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <p className="card-subtitle">{completedSteps} of {totalSteps} violations resolved</p>
          <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#475569', fontWeight: 600 }}>
            Free floor area: {displayedScore.toFixed(1)}%
          </p>
        </div>
        <div style={{ width: 56, height: 56, borderRadius: '50%', border: `4px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>
            {completedSteps}/{totalSteps}
          </span>
        </div>
      </div>

      {/* ── Sticky action buttons ─────────────────────────────────────────── */}
      <div style={stickyFooterStyle}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn btn-secondary" type="button" onClick={handleSkip}>
            Skip
          </button>
          <button className="btn btn-primary" type="button" onClick={handleDone}>
            Done — I moved it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const stepCountStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  borderRadius: 99,
  background: '#e6edf8',
  color: '#1F3864',
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
};

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 99,
  fontSize: 11,
  fontWeight: 800,
};

const stickyFooterStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '12px 16px',
  paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
  background: 'rgba(255,255,255,0.96)',
  borderTop: '1px solid var(--border)',
  backdropFilter: 'blur(10px)',
  zIndex: 20,
};
