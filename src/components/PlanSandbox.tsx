import { useCallback, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import FloorPlan2D from './FloorPlan2D';
import StatusRow from './StatusRow';
import { isFeasible, snapCm, withMovedItem, withRotatedItem } from './floorPlanDrag';
import { describeFinding, findingDetail } from './findingText';
import { statusForClassification } from './statusVocabulary';
import { commitLines, computeMove } from './previewMove';
import type { PreviewMove } from './previewMove';
import { runClearanceAnalysis } from '../engine/clearance';
import type { ClearanceResult } from '../engine/clearance';
import type { FurnitureItem } from '../types';

/**
 * Interactive floor-plan sandbox: the user drags one block (the recommendation's
 * target furniture) to try out a new position.
 *
 * Cheap feasibility (findLayoutViolation) runs live during drag. The FULL
 * clearance analysis runs only on an explicit "Preview this" tap, against the
 * exact hypothetical layout already held in `preview` — no parallel layout is
 * rebuilt for it.
 *
 * The preview lives entirely in local state. This component never writes to
 * furnitureStore — a move only becomes real through the existing AR-confirmed
 * step (Phase 5 hands off to it).
 */

export interface PlanSandboxProps {
  /** The real placed layout. Treated as read-only. */
  baseItems: FurnitureItem[];
  /** The one block the user may move. */
  targetItemId: string;
  roomWidthCm: number;
  roomLengthCm: number;
  /**
   * Hand the built move to the existing guided-instruction / AR-confirm flow.
   * The sandbox never commits anything itself — it only calls into this. The
   * receiver (RecommendationScreen) pre-loads the move as the current target;
   * the move becomes real solely through that flow's AR-confirmed step.
   */
  onUseThisMove: (move: PreviewMove) => void;
}

export default function PlanSandbox({ baseItems, targetItemId, roomWidthCm, roomLengthCm, onUseThisMove }: PlanSandboxProps) {
  // Preview = the layout as the user is tentatively arranging it. Starts as
  // the real layout (which is feasible by construction).
  const [preview, setPreview] = useState<FurnitureItem[]>(baseItems);
  const [infeasible, setInfeasible] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Full-analysis result of the last "Preview this" tap. Cleared whenever the
  // layout changes so a stale analysis is never shown against a newer position.
  const [analysis, setAnalysis] = useState<ClearanceResult | null>(null);

  // The last position the dragged block passed through that was allowed. On an
  // infeasible release we return here. Seeded at drag start with the block's
  // resting position, which is always feasible.
  const lastFeasibleRef = useRef<{ x: number; z: number } | null>(null);
  // Live feasibility, tracked in a ref so onDragEnd reads the current value
  // rather than a stale render closure.
  const currentFeasibleRef = useRef(true);

  const target = preview.find((it) => it.id === targetItemId);
  const baseTarget = baseItems.find((it) => it.id === targetItemId);
  const moved =
    !!target &&
    !!baseTarget &&
    (target.posX !== baseTarget.posX ||
      target.posZ !== baseTarget.posZ ||
      target.rotationY !== baseTarget.rotationY);

  const handleDragStart = useCallback(
    (itemId: string) => {
      const it = preview.find((p) => p.id === itemId);
      if (!it) throw new Error(`PlanSandbox: drag started on unknown item "${itemId}".`);
      lastFeasibleRef.current = { x: it.posX, z: it.posZ };
      currentFeasibleRef.current = true;
      setInfeasible(false);
      setDragging(true);
      setAnalysis(null); // the position is about to change — drop any stale preview
    },
    [preview],
  );

  const handleDragMove = useCallback(
    (worldXMetres: number, worldZMetres: number) => {
      // Snap the centre to the 5cm grid so no position yields false precision.
      const snappedX = snapCm(worldXMetres * 100) / 100;
      const snappedZ = snapCm(worldZMetres * 100) / 100;
      const candidate = withMovedItem(preview, targetItemId, snappedX, snappedZ);
      const ok = isFeasible(candidate, roomWidthCm, roomLengthCm);

      // Always follow the pointer, even into an infeasible spot — just flag it
      // rather than blocking the gesture (blocking feels broken on touch).
      setPreview(candidate);
      setInfeasible(!ok);
      currentFeasibleRef.current = ok;
      if (ok) lastFeasibleRef.current = { x: snappedX, z: snappedZ };
    },
    [preview, targetItemId, roomWidthCm, roomLengthCm],
  );

  const handleDragEnd = useCallback(() => {
    setDragging(false);
    if (currentFeasibleRef.current) return; // dropped somewhere valid — keep it
    const back = lastFeasibleRef.current;
    if (!back) return;
    // Snap back to the last allowed position dragged through.
    setPreview((p) => withMovedItem(p, targetItemId, back.x, back.z));
    setInfeasible(false);
    currentFeasibleRef.current = true;
  }, [targetItemId]);

  // Rotate is a discrete action: apply the quarter-turn only if the result is
  // allowed. There is no drag-release to snap back from, so a rotation that
  // would overlap or leave the room is simply not applied.
  function rotate() {
    if (!target) return;
    const candidate = withRotatedItem(preview, targetItemId, target.rotationY + Math.PI / 2);
    if (isFeasible(candidate, roomWidthCm, roomLengthCm)) {
      setPreview(candidate);
      setInfeasible(false);
      currentFeasibleRef.current = true;
      setAnalysis(null); // layout changed — the previous preview no longer applies
    }
  }

  // Full analysis on explicit confirm. `preview` IS the hypothetical layout the
  // feasibility check already accepted, so it is passed straight through — no
  // second layout is built. No try/catch: findLayoutViolation has already gated
  // everything reaching here, so if runClearanceAnalysis's own guard throws it
  // means the two checks have drifted and we want to see it, not swallow it.
  function runPreview() {
    setAnalysis(runClearanceAnalysis(preview, roomWidthCm, roomLengthCm));
  }

  // Discard the preview and return to the real layout. No store write — the
  // real layout was never changed, so there is nothing to undo.
  function reset() {
    setPreview(baseItems);
    setAnalysis(null);
    setInfeasible(false);
    setDragging(false);
    lastFeasibleRef.current = null;
    currentFeasibleRef.current = true;
  }

  const canPreview = !dragging && !infeasible && moved && !analysis;
  const findings = analysis ? analysis.violations : [];

  // The move to hand off, derived from the real vs previewed target. Only
  // meaningful once a preview is showing for a genuinely changed position.
  const move = analysis && moved && target && baseTarget ? computeMove(baseTarget, target) : null;
  const lines = move ? commitLines(move) : [];

  return (
    <div>
      <FloorPlan2D
        items={preview}
        roomWidthCm={roomWidthCm}
        roomLengthCm={roomLengthCm}
        interactive={{
          draggableItemId: targetItemId,
          infeasible,
          onDragStart: handleDragStart,
          onDragMove: handleDragMove,
          onDragEnd: handleDragEnd,
        }}
      />

      <div style={controlsRow}>
        <p style={hintText}>
          {infeasible
            ? "That spot doesn't fit — let go to snap back."
            : 'Drag the highlighted block to try a new spot.'}
        </p>
        <button type="button" onClick={rotate} style={rotateBtn}>
          Rotate 90°
        </button>
      </div>

      {canPreview && (
        <button type="button" onClick={runPreview} style={previewBtn}>
          Preview this
        </button>
      )}

      {analysis && (
        <section style={resultCard}>
          {findings.length === 0 ? (
            <StatusRow
              status="comfortable"
              title="Everything fits comfortably"
              detail="Enough space around every piece"
            />
          ) : (
            findings.map((v) => (
              <StatusRow
                key={v.id}
                status={statusForClassification(v.classification).key}
                title={describeFinding(v, preview)}
                detail={findingDetail(v)}
              />
            ))
          )}
        </section>
      )}

      {move && (
        <section style={commitCard}>
          {lines.map((line) => (
            <p key={line} style={commitLine}>{line}</p>
          ))}
          <div style={commitButtons}>
            <button type="button" onClick={reset} style={resetBtn}>
              Reset
            </button>
            <button type="button" onClick={() => onUseThisMove(move)} style={useThisBtn}>
              Use this — show me how
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

const controlsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 12,
};

const hintText: CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: '#6B7280',
};

const rotateBtn: CSSProperties = {
  flexShrink: 0,
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#1F3864',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const previewBtn: CSSProperties = {
  width: '100%',
  minHeight: 48,
  marginTop: 14,
  borderRadius: 12,
  border: 0,
  background: '#1F3864',
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};

const resultCard: CSSProperties = {
  marginTop: 16,
  padding: '6px 14px',
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
};

const commitCard: CSSProperties = {
  marginTop: 14,
};

const commitLine: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 17,
  fontWeight: 700,
  color: '#1A1A2E',
  lineHeight: 1.35,
};

const commitButtons: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 10,
};

const resetBtn: CSSProperties = {
  minHeight: 48,
  padding: '0 18px',
  borderRadius: 12,
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#6B7280',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};

const useThisBtn: CSSProperties = {
  minHeight: 48,
  padding: '0 18px',
  borderRadius: 12,
  border: 0,
  background: '#1F3864',
  color: '#FFFFFF',
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};
