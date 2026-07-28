import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, XROrigin } from '@react-three/xr';
import ClearanceOverlay from '../ar/ClearanceOverlay';
import CorrectionArrow from '../ar/CorrectionArrow';
import { createFurnitureShape } from '../ar/shapeLibrary';
import ErrorBoundary from '../components/ErrorBoundary';
import FloorPlan2D from '../components/FloorPlan2D';
import PlanSandbox from '../components/PlanSandbox';
import { commitLines } from '../components/previewMove';
import type { PreviewMove } from '../components/previewMove';
import { findingReason } from '../components/findingText';
import { runClearanceAnalysis } from '../engine/clearance';
import type { WallSide } from '../engine/clearance';
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

// Express the engine's own recommendation for a furniture group using the SAME
// commitLines sentence builder the sandbox handoff uses — one instruction
// format across both paths, never two separately-formatted strings.
function engineMoveLines(group: FurnitureGroup): string[] {
  return group.directionGroups.flatMap((dg) => {
    const w = dg.word.toLowerCase();
    const directionWall: WallSide | null =
      w === 'north' || w === 'south' || w === 'east' || w === 'west' ? w : null;
    const move: PreviewMove = {
      itemId: group.furnitureId,
      itemLabel: group.furnitureLabel,
      directionWall,
      distanceCm: dg.distanceCm,
      dxCm: 0,
      dzCm: 0,
      rotationDeltaRad: 0,
      rotationDeg: 0,
      facingAfter: null,
    };
    return commitLines(move);
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecommendationScreen() {
  const navigateTo          = useSessionStore((s) => s.navigateTo);
  const roomDimensions      = useSessionStore((s) => s.roomDimensions);
  const items               = useFurnitureStore((s) => s.items);
  const recommendations     = useViolationStore((s) => s.recommendations);
  const refreshViolations   = useViolationStore((s) => s.refreshViolations);
  const resolveViolations   = useViolationStore((s) => s.resolveViolations);
  const setSpaceScoreAfter  = useViolationStore((s) => s.setSpaceScoreAfter);

  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);
  const [arError, setArError] = useState('');
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  // Interactive sandbox: whether it's open, and the move the user handed back
  // from it ("Use this — show me how"). When set, the guided card shows THIS
  // move as the current instruction instead of the engine's default direction.
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxMove, setSandboxMove] = useState<PreviewMove | null>(null);

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

    // 1. Mark this furniture's findings resolved. Keyed by stableViolationKey
    //    now, so the resolution survives the re-analysis below even though
    //    every id changes with the new measurements.
    resolveViolations(currentGroup.allViolations.map((v) => v.id));

    // 2. Re-check the REAL current layout rather than trusting the report.
    //    Read straight from the store for the freshest positions at click time.
    const liveItems = useFurnitureStore.getState().items;
    const fresh = runClearanceAnalysis(liveItems, roomWidthCm, roomLengthCm);

    // 3. Resync recommendations to the fresh layout. Resolved (stable keys) and
    //    skipped (furnitureId) both carry forward; any newly-introduced or
    //    newly-worsened finding appears here instead of being trusted away.
    refreshViolations(fresh.violations);

    // 4. Real free-floor-area from the fresh analysis — no synthetic increment.
    //    Tracked internally (for the report), not shown raw to the user.
    setSpaceScoreAfter(fresh.spaceScoreBefore);

    // Advancing to the next piece — drop any sandbox move from this one.
    setSandboxMove(null);
    setShowSandbox(false);
  }

  function handleSkip() {
    if (!currentGroup) return;
    setSkippedIds((prev) => new Set([...prev, currentGroup.furnitureId]));
    setSandboxMove(null);
    setShowSandbox(false);
  }

  // Handoff target: the sandbox hands its built move back here, and the guided
  // card pre-loads it as the current instruction (no store write happens here —
  // the move still only becomes real through the AR-confirmed "Done" step).
  function handleUseSandboxMove(m: PreviewMove) {
    setSandboxMove(m);
    setShowSandbox(false);
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

  // One instruction format for both paths: the sandbox move if the user chose
  // one, otherwise the engine's own recommendation — both through commitLines.
  const instructionLines = sandboxMove ? commitLines(sandboxMove) : engineMoveLines(currentGroup);
  const reasonViolation = currentGroup.directionGroups[0]?.violations[0] ?? currentGroup.allViolations[0];

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
          {doneCount + 1} of {totalCount}
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

      {/* ── 2D plan — current real layout, target highlighted ─────────────── */}
      <section className="card card-sm">
        <FloorPlan2D
          items={items}
          roomWidthCm={roomWidthCm}
          roomLengthCm={roomLengthCm}
          highlightItemId={currentGroup.furnitureId}
        />
      </section>

      {/* ── Action card — the single instruction ──────────────────────────── */}
      <section
        key={currentGroup.furnitureId}
        className="card"
        style={{ borderLeft: `5px solid ${currentGroup.color}`, animation: 'screenFadeIn 0.3s ease' }}
      >
        <p style={{ margin: '0 0 2px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {sandboxMove ? 'Your chosen move' : 'What to do'}
        </p>
        <p style={{ margin: '0 0 12px', fontSize: '1.375rem', fontWeight: 850, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {currentGroup.furnitureLabel}
        </p>

        {/* Instruction — identical commitLines format for engine + sandbox paths */}
        {instructionLines.map((line) => (
          <p key={line} style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            {line}
          </p>
        ))}

        {/* Reason — names both objects and the human consequence */}
        {reasonViolation && (
          <p style={{ margin: '6px 0 0', fontSize: 15, color: '#6B7280', lineHeight: 1.45 }}>
            {findingReason(reasonViolation, items)}
          </p>
        )}

        {/* Optional interactive path — not the first thing shown. */}
        <button type="button" onClick={() => setShowSandbox((v) => !v)} style={tryItBtnStyle}>
          {showSandbox ? 'Hide' : sandboxMove ? 'Adjust it yourself' : 'Or try it yourself'}
        </button>
      </section>

      {showSandbox && (
        <section className="card card-sm">
          <PlanSandbox
            baseItems={items}
            targetItemId={currentGroup.furnitureId}
            roomWidthCm={roomWidthCm}
            roomLengthCm={roomLengthCm}
            onUseThisMove={handleUseSandboxMove}
          />
        </section>
      )}

      {/* ── AR guidance ─────────────────────────────────────────────────────── */}
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
            style={{ width: 'auto', minWidth: 80, fontSize: '0.875rem', padding: '10px 14px', minHeight: 40, flexShrink: 0 }}
          >
            Open AR
          </button>
        </div>
        {arError && <p className="form-error" style={{ marginTop: 8 }}>{arError}</p>}

        {/* Canvas always mounted so xrRecommendationStore.enterAR() has a
            Three.js context; the container is only visible during an active
            immersive-ar session (WebXR renders full-screen regardless) */}
        <div style={{
          height: 0,
          overflow: 'hidden',
          borderRadius: 10,
          border: 'none',
          background: '#f0f4f8',
        }}>
          <ErrorBoundary where="Recommendation AR view" fallback={null}>
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
          </ErrorBoundary>
        </div>
      </section>

      {/* ── Session progress ─────────────────────────────────────────────────── */}
      <div className="card card-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {doneCount} of {totalCount} furniture piece{totalCount !== 1 ? 's' : ''} addressed
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

const tryItBtnStyle: CSSProperties = {
  marginTop: 14,
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: '#1F3864',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};
