import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XRDomOverlay, XROrigin } from '@react-three/xr';
import ClearanceOverlay from '../ar/ClearanceOverlay';
import CorrectionArrow from '../ar/CorrectionArrow';
import { createFurnitureShape } from '../ar/shapeLibrary';
import ErrorBoundary from '../components/ErrorBoundary';
import PlanSandbox from '../components/PlanSandbox';
import { commitLines } from '../components/previewMove';
import type { PreviewMove } from '../components/previewMove';
import { findingReason } from '../components/findingText';
import { color as t, type as typeScale } from '../components/designTokens';
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
          color: dvs.some((v) => v.classification === 'RED') ? t.attentionFg : t.tightFg,
        }))
        .sort((a, b) => {
          const aRed = a.violations.some((v) => v.classification === 'RED') ? 1 : 0;
          const bRed = b.violations.some((v) => v.classification === 'RED') ? 1 : 0;
          return bRed - aRed || b.distanceCm - a.distanceCm;
        });

      const color = vs.some((v) => v.classification === 'RED') ? t.attentionFg : t.tightFg;
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
// commitLines sentence builder — stable anchor instruction format across the path.
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

  const [settledState, setSettledState] = useState<{
    item: FurnitureItem | null;
    isMoved: boolean;
    isDragging: boolean;
  }>({ item: null, isMoved: false, isDragging: false });

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

  useEffect(() => {
    setSettledState({ item: null, isMoved: false, isDragging: false });
  }, [currentGroup?.furnitureId]);

  const handleSettledChange = useCallback(
    (settledItem: FurnitureItem | null, isMoved: boolean, isDragging: boolean) => {
      setSettledState({ item: settledItem, isMoved, isDragging });
    },
    [],
  );

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

  function handleConfirm() {
    if (!currentGroup || !settledState.item || !settledState.isMoved) return;

    // 1. Write the dragged position and rotation to furnitureStore for that item
    //    using updatePosition — this is the ONLY place that writes to the store.
    useFurnitureStore.getState().updatePosition(
      settledState.item.id,
      settledState.item.posX,
      settledState.item.posZ,
      settledState.item.rotationY
    );

    // 2. Mark this furniture's findings resolved by stable key
    resolveViolations(currentGroup.allViolations.map((v) => v.id));

    // 3. Re-run full runClearanceAnalysis on actual updated store state
    const liveItems = useFurnitureStore.getState().items;
    const fresh = runClearanceAnalysis(liveItems, roomWidthCm, roomLengthCm);

    // 4. Refresh recommendations and space score
    refreshViolations(fresh.violations);
    setSpaceScoreAfter(fresh.spaceScoreBefore);

    // Reset local settled state for next item
    setSettledState({ item: null, isMoved: false, isDragging: false });
  }

  function handleSkip() {
    if (!currentGroup) return;
    setSkippedIds((prev) => new Set([...prev, currentGroup.furnitureId]));
    setSettledState({ item: null, isMoved: false, isDragging: false });
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!currentGroup && recommendations.length === 0) {
    return (
      <div className="screen" style={{ maxWidth: 640 }}>
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
          <div className="screen-header-info">
            <span className="step-label">Your room</span>
            <h2>Make room</h2>
          </div>
        </div>
        <div className="card" style={{ borderLeft: `5px solid ${t.comfortFg}`, background: t.comfortBg, padding: 'var(--space-xl)' }}>
          <p style={{ ...typeScale.display, margin: 0, color: t.ink }}>Everything has room</p>
          <p style={{ ...typeScale.body, margin: '8px 0 0', color: t.inkSoft }}>
            None of your furniture is crowding a wall or another piece. There&rsquo;s nothing to move.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }} onClick={() => navigateTo('report')}>
            See the summary
          </button>
        </div>
      </div>
    );
  }

  if (!currentGroup) {
    const stillTight = result.violations.filter((v) => v.classification === 'YELLOW').length;
    const stillAttention = result.violations.filter((v) => v.classification === 'RED').length;
    const headColor = stillAttention > 0 ? t.attentionFg : stillTight > 0 ? t.tightFg : t.comfortFg;
    const headBg = stillAttention > 0 ? t.attentionBg : stillTight > 0 ? t.tightBg : t.comfortBg;
    const body =
      stillAttention > 0
        ? `${stillAttention} spot${stillAttention === 1 ? '' : 's'} could still use more room — you can go back and adjust, or see the summary.`
        : stillTight > 0
          ? `${stillTight} spot${stillTight === 1 ? ' is' : 's are'} still a little tight, but nothing needs urgent room. You can leave ${stillTight === 1 ? 'it' : 'them'} as is or come back later.`
          : 'Every piece now has comfortable clearance.';
    return (
      <div className="screen" style={{ maxWidth: 640 }}>
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
          <div className="screen-header-info">
            <span className="step-label">Your room</span>
            <h2>Make room</h2>
          </div>
        </div>
        <div className="card" style={{ borderLeft: `5px solid ${headColor}`, background: headBg, padding: 'var(--space-xl)' }}>
          <p style={{ ...typeScale.display, margin: 0, color: t.ink }}>You&rsquo;ve been through every piece</p>
          <p style={{ ...typeScale.body, margin: '8px 0 0', color: t.inkSoft }}>{body}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 'var(--space-lg)', maxWidth: 280 }}
            onClick={() => navigateTo('report')}
          >
            See the summary
          </button>
        </div>
      </div>
    );
  }

  const instructionLines = engineMoveLines(currentGroup);
  const reasonViolation = currentGroup.directionGroups[0]?.violations[0] ?? currentGroup.allViolations[0];

  return (
    <div className="screen" style={{ maxWidth: 640, paddingBottom: 92 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('analysis')} aria-label="Go back">←</button>
        <div className="screen-header-info">
          <span className="step-label">Your room</span>
          <h2>Make room</h2>
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
                background: !isPending ? t.comfortFg
                          : isCurrent ? currentGroup.color
                          : t.line,
              }}
            />
          );
        })}
      </div>

      {/* ── Action card — the engine's stable recommendation ──────────────── */}
      {/* This sentence describes the top suggestion for the REAL layout and does
          NOT change as the user drags the plan below — it's steady guidance. */}
      <section
        key={currentGroup.furnitureId}
        className="card"
        style={{ borderLeft: `5px solid ${currentGroup.color}`, animation: 'screenFadeIn 0.3s ease' }}
      >
        <p style={{ ...typeScale.label, margin: '0 0 2px', color: t.inkMute }}>
          What to do
        </p>
        <p style={{ ...typeScale.display, margin: '0 0 12px', color: t.ink }}>
          {currentGroup.furnitureLabel}
        </p>

        {instructionLines.map((line) => (
          <p key={line} style={{ ...typeScale.title, margin: '0 0 8px', color: t.ink }}>
            {line}
          </p>
        ))}

        {reasonViolation && (
          <p style={{ ...typeScale.body, margin: '6px 0 0', color: t.inkSoft }}>
            {findingReason(reasonViolation, items)}
          </p>
        )}
      </section>

      {/* ── Interactive plan — the primary, always-visible sandbox ─────────── */}
      {/* Drag the block to explore; the status list below reacts live. No ghost
          target — the suggestion is the sentence in the action card above. */}
      <section className="card card-sm">
        <PlanSandbox
          key={currentGroup.furnitureId}
          baseItems={items}
          targetItemId={currentGroup.furnitureId}
          roomWidthCm={roomWidthCm}
          roomLengthCm={roomLengthCm}
          onSettledChange={handleSettledChange}
        />
      </section>

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
      {(() => {
        const showConfirm = settledState.isMoved && !settledState.isDragging && settledState.item !== null;
        return (
          <div style={stickyFooterStyle}>
            <div
              style={{
                maxWidth: 640,
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: showConfirm ? '1fr 1fr' : '1fr',
                gap: 10,
              }}
            >
              <button className="btn btn-secondary" type="button" onClick={handleSkip}>
                Skip
              </button>
              {showConfirm && (
                <button className="btn btn-primary" type="button" onClick={handleConfirm}>
                  I placed it here
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const stepCountStyle: CSSProperties = {
  ...typeScale.label,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  borderRadius: 99,
  background: t.brandTint,
  color: t.brand,
  letterSpacing: 'normal',
  textTransform: 'none',
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

