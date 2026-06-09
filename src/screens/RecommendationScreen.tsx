import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, XROrigin } from '@react-three/xr';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoomDimensions(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };
  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

function directionArrow(label: string) {
  const l = label.toLowerCase();
  if (l.includes('north')) return '↑';
  if (l.includes('south')) return '↓';
  if (l.includes('east'))  return '→';
  if (l.includes('west'))  return '←';
  return '↗';
}

function directionWord(label: string) {
  const l = label.toLowerCase();
  if (l.includes('north')) return 'North';
  if (l.includes('south')) return 'South';
  if (l.includes('east'))  return 'East';
  if (l.includes('west'))  return 'West';
  return label;
}

// ─── Data structures ──────────────────────────────────────────────────────────

interface DirectionGroup {
  label: string;
  arrow: string;
  word: string;
  distanceCm: number;
  violations: Violation[];
  color: string;
}

interface FurnitureGroup {
  furnitureId: string;
  furnitureLabel: string;
  directionGroups: DirectionGroup[];
  allViolations: Violation[];
  color: string;
}

function buildFurnitureGroups(violations: Violation[], skippedIds: Set<string>): FurnitureGroup[] {
  const unresolved = violations.filter((v) => !v.resolved && !skippedIds.has(v.furnitureId));

  const byFurniture = new Map<string, Violation[]>();
  unresolved.forEach((v) => {
    if (!byFurniture.has(v.furnitureId)) byFurniture.set(v.furnitureId, []);
    byFurniture.get(v.furnitureId)!.push(v);
  });

  return Array.from(byFurniture.entries())
    .map(([furnitureId, vs]) => {
      // Group violations within this furniture by direction
      const byDir = new Map<string, Violation[]>();
      vs.forEach((v) => {
        if (!byDir.has(v.fixDirectionLabel)) byDir.set(v.fixDirectionLabel, []);
        byDir.get(v.fixDirectionLabel)!.push(v);
      });

      const directionGroups: DirectionGroup[] = Array.from(byDir.entries())
        .map(([label, dvs]) => ({
          label,
          arrow: directionArrow(label),
          word: directionWord(label),
          distanceCm: Math.max(...dvs.map((v) => v.fixDirectionCm)),
          violations: dvs.sort((a, b) => b.priorityScore - a.priorityScore),
          color: dvs.some((v) => v.classification === 'RED') ? '#E24B4A' : '#F0A500',
        }))
        .sort((a, b) => {
          const aRed = a.violations.some((v) => v.classification === 'RED') ? 1 : 0;
          const bRed = b.violations.some((v) => v.classification === 'RED') ? 1 : 0;
          return bRed - aRed || b.distanceCm - a.distanceCm;
        });

      const color = vs.some((v) => v.classification === 'RED') ? '#E24B4A' : '#F0A500';
      return {
        furnitureId,
        furnitureLabel: vs[0].furnitureLabel,
        directionGroups,
        allViolations: vs,
        color,
      };
    })
    .sort((a, b) => {
      const aMax = Math.max(...a.allViolations.map((v) => v.priorityScore));
      const bMax = Math.max(...b.allViolations.map((v) => v.priorityScore));
      return bMax - aMax;
    });
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

function DirectionBlock({ dg }: { dg: DirectionGroup }) {
  const bgColor = dg.color === '#E24B4A' ? '#FEF2F2' : '#FFFBEB';
  const borderColor = dg.color === '#E24B4A' ? '#FECACA' : '#FCD34D';

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
      {/* Arrow + distance row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{dg.arrow}</span>
        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 850, color: dg.color, lineHeight: 1 }}>
            {dg.distanceCm} cm
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            toward {dg.word.toLowerCase()} wall
          </p>
        </div>
      </div>

      {/* Rule chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {dg.violations.map((v) => (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ffffff', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '3px 8px' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: dg.color }}>{v.ruleCode}</span>
            <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>{v.ruleLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecommendationScreen() {
  const navigateTo          = useSessionStore((s) => s.navigateTo);
  const roomDimensions      = useSessionStore((s) => s.roomDimensions);
  const items               = useFurnitureStore((s) => s.items);
  const recommendations     = useViolationStore((s) => s.recommendations);
  const refreshViolations   = useViolationStore((s) => s.refreshViolations);
  const resolveViolations   = useViolationStore((s) => s.resolveViolations);
  const setSpaceScoreAfter  = useViolationStore((s) => s.setSpaceScoreAfter);
  const spaceScoreAfter     = useViolationStore((s) => s.spaceScoreAfter);

  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);
  const [arError, setArError] = useState('');
  const [correctionPreviewOpen, setCorrectionPreviewOpen] = useState(false);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const result = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomLengthCm, roomWidthCm],
  );

  // Seed violations into the store if arriving fresh from AnalysisScreen
  useEffect(() => {
    if (recommendations.length === 0 && result.violations.length > 0) {
      refreshViolations(result.violations);
      setSpaceScoreAfter(result.spaceScoreBefore);
    }
  }, [recommendations.length, refreshViolations, result.spaceScoreBefore, result.violations, setSpaceScoreAfter]);

  // All unique furniture pieces that appear in any violation (for total count)
  const allFurnitureItems = useMemo(() => {
    const seen = new Set<string>();
    return recommendations.filter((v) => {
      if (seen.has(v.furnitureId)) return false;
      seen.add(v.furnitureId);
      return true;
    }).map((v) => ({ id: v.furnitureId, label: v.furnitureLabel }));
  }, [recommendations]);

  // Active (unresolved, not skipped) furniture groups — priority sorted
  const pendingGroups = useMemo(
    () => buildFurnitureGroups(recommendations, skippedIds),
    [recommendations, skippedIds],
  );

  const currentGroup    = pendingGroups[0] ?? null;
  const totalCount      = allFurnitureItems.length;
  const doneCount       = totalCount - pendingGroups.length;
  const displayedScore  = spaceScoreAfter || result.spaceScoreBefore;

  // Update score when all groups are done/skipped
  useEffect(() => {
    if (recommendations.length > 0 && pendingGroups.length === 0) {
      setSpaceScoreAfter(result.spaceScoreBefore);
    }
  }, [pendingGroups.length, recommendations.length, result.spaceScoreBefore, setSpaceScoreAfter]);

  async function launchAR() {
    setArError('');
    try {
      await xrRecommendationStore.enterAR();
    } catch (err) {
      setArError(err instanceof Error ? err.message : String(err));
    }
  }

  function exitAR() {
    xrRecommendationStore.getState().session?.end();
  }

  function handleDone() {
    if (!currentGroup) return;
    // Mark all violations for this furniture piece as resolved
    resolveViolations(currentGroup.allViolations.map((v) => v.id));
    // Re-run analysis and refresh
    const updated = runClearanceAnalysis(items, roomWidthCm, roomLengthCm);
    refreshViolations(updated.violations);
    setSpaceScoreAfter(updated.spaceScoreBefore);
  }

  function handleSkip() {
    if (!currentGroup) return;
    setSkippedIds((prev) => new Set([...prev, currentGroup.furnitureId]));
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!currentGroup && recommendations.length === 0) {
    return (
      <div className="screen" style={{ maxWidth: 640 }}>
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
          <div className="screen-header-info">
            <span className="step-label">Recommendations</span>
            <h2>Fix Violations</h2>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '5px solid #4CAF50', background: '#ECFDF5', textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p className="card-title" style={{ color: '#166534' }}>No violations to fix</p>
          <p className="card-subtitle" style={{ marginTop: 6 }}>Your layout meets all clearance standards.</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }} onClick={() => navigateTo('report')}>
            View Report
          </button>
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="screen" style={{ maxWidth: 640 }}>
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
          <div className="screen-header-info">
            <span className="step-label">Recommendations</span>
            <h2>Fix Violations</h2>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '5px solid #4CAF50', background: '#ECFDF5', textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p className="card-title" style={{ color: '#166534' }}>All items addressed</p>
          <p className="card-subtitle" style={{ marginTop: 6 }}>
            You have worked through all clearance recommendations for this session.
          </p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 'var(--space-lg)', maxWidth: 280 }}
            onClick={() => navigateTo('report')}
          >
            View Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ maxWidth: 640, paddingBottom: 92 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
        <div className="screen-header-info">
          <span className="step-label">Recommendations</span>
          <h2>Fix Violations</h2>
        </div>
        <span style={stepCountStyle}>
          {doneCount + 1} / {totalCount}
        </span>
      </div>

      {/* ── Progress track — one bar per unique furniture piece ─────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-md)' }}>
        {allFurnitureItems.map((furn) => {
          const isPending = pendingGroups.some((g) => g.furnitureId === furn.id);
          const isCurrent = currentGroup.furnitureId === furn.id;
          return (
            <div
              key={furn.id}
              style={{
                flex: 1, height: 5, borderRadius: 3,
                transition: 'background 0.4s ease',
                background: !isPending ? '#4CAF50'
                          : isCurrent ? currentGroup.color
                          : '#E2E8F0',
              }}
            />
          );
        })}
      </div>

      {/* ── Main instruction card — animates when furniture changes ────────── */}
      <section
        key={currentGroup.furnitureId}
        className="card"
        style={{ borderLeft: `5px solid ${currentGroup.color}`, animation: 'screenFadeIn 0.3s ease' }}
      >
        {/* Furniture name */}
        <p style={{ margin: '0 0 2px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Move this furniture
        </p>
        <p style={{ margin: '0 0 14px', fontSize: '1.375rem', fontWeight: 850, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {currentGroup.furnitureLabel}
        </p>

        {/* One block per direction */}
        {currentGroup.directionGroups.map((dg) => (
          <DirectionBlock key={dg.label} dg={dg} />
        ))}

        {/* Summary count */}
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
          {currentGroup.allViolations.length} clearance issue{currentGroup.allViolations.length !== 1 ? 's' : ''} addressed with this move
        </p>
      </section>

      {/* ── AR guidance ─────────────────────────────────────────────────────── */}
      <section className="card card-sm">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p className="card-title">AR Correction Guide</p>
            <p className="card-subtitle">See the direction arrow live in your room</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-secondary"
              type="button"
              style={{ width: 'auto', fontSize: '0.875rem', padding: '10px 14px', minHeight: 40 }}
              onClick={() => setCorrectionPreviewOpen((v) => !v)}
            >
              {correctionPreviewOpen ? 'Hide 3D' : '3D Preview'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={launchAR}
              style={{ width: 'auto', minWidth: 80, fontSize: '0.875rem', padding: '10px 14px', minHeight: 40 }}
            >
              Open AR
            </button>
          </div>
        </div>
        {arError && <p className="form-error" style={{ marginTop: 8 }}>{arError}</p>}

        {/* Canvas always mounted so xrRecommendationStore.enterAR() has a
            Three.js context; the container height controls visual visibility */}
        <div style={{
          marginTop: correctionPreviewOpen ? 12 : 0,
          height: correctionPreviewOpen ? 280 : 0,
          overflow: 'hidden',
          borderRadius: 10,
          border: correctionPreviewOpen ? '1px solid var(--border)' : 'none',
          background: '#f0f4f8',
        }}>
          <Canvas
            camera={{ position: [0, 3.5, 4.5], fov: 52 }}
            style={{ width: '100%', height: 280 }}
            gl={{ antialias: true, alpha: true }}
          >
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
                highlightedRuleCode={currentGroup.directionGroups[0]?.violations[0]?.ruleCode}
              />
              <CorrectionArrow
                violation={currentGroup.directionGroups[0]?.violations[0] ?? currentGroup.allViolations[0]}
                items={items}
              />
              <XRDomOverlay>
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
                  <button
                    type="button"
                    onClick={exitAR}
                    style={{
                      position: 'absolute', top: 16, right: 16,
                      background: 'rgba(239,68,68,0.92)', color: 'white',
                      border: 0, borderRadius: 12, padding: '12px 16px',
                      fontWeight: 700, fontSize: 14,
                      backdropFilter: 'blur(8px)', pointerEvents: 'auto',
                    }}
                  >
                    Exit AR
                  </button>
                </div>
              </XRDomOverlay>
            </XR>
          </Canvas>
        </div>
      </section>

      {/* ── Session progress ─────────────────────────────────────────────────── */}
      <div className="card card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {doneCount} of {totalCount} furniture piece{totalCount !== 1 ? 's' : ''} addressed
          </p>
          <p className="card-subtitle" style={{ marginTop: 2 }}>
            Free floor area: {displayedScore.toFixed(1)}%
          </p>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `3px solid ${currentGroup.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: currentGroup.color }}>
            {doneCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* ── Sticky action buttons ─────────────────────────────────────────────── */}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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
