import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import FloorPlan2D from './FloorPlan2D';
import StatusRow from './StatusRow';
import { isFeasible, snapCm, withMovedItem, withRotatedItem } from './floorPlanDrag';
import { describeFinding, findingDetail } from './findingText';
import { statusForClassification } from './statusVocabulary';
import { color as t, type as typeScale } from './designTokens';
import { runClearanceAnalysis } from '../engine/clearance';
import type { ClearanceResult } from '../engine/clearance';
import type { FurnitureItem } from '../types';

/**
 * Interactive floor plan — the primary way the user explores where a piece
 * could go. They drag the target block on a 5cm grid; a fast feasibility check
 * runs every frame (red tint + snap-back if it doesn't fit). When they settle
 * on a position, the FULL clearance analysis re-runs automatically and the
 * status list below updates to show what that layout would be — no button.
 *
 * There is NO ghost/suggested-position outline here: the engine's recommendation
 * lives only as a sentence in the action card above. The plan is a pure sandbox.
 *
 * The preview lives entirely in local state — this component never writes to
 * furnitureStore. (Writing the chosen position is the confirm step, Phase 3.)
 */

function checkIsMoved(base: FurnitureItem | undefined, current: FurnitureItem | undefined): boolean {
  if (!base || !current) return false;
  const dx = Math.abs(current.posX - base.posX);
  const dz = Math.abs(current.posZ - base.posZ);
  let dRot = Math.abs(current.rotationY - base.rotationY) % (2 * Math.PI);
  if (dRot > Math.PI) dRot = 2 * Math.PI - dRot;
  return dx >= 0.01 || dz >= 0.01 || dRot >= 0.01;
}

export interface PlanSandboxProps {
  /** The real placed layout. Treated as read-only. */
  baseItems: FurnitureItem[];
  /** The one block the user may move. */
  targetItemId: string;
  roomWidthCm: number;
  roomLengthCm: number;
  /** Notifies caller of settled position, movement status, and drag state. */
  onSettledChange?: (settledItem: FurnitureItem | null, isMoved: boolean, isDragging: boolean) => void;
}

export default function PlanSandbox({ baseItems, targetItemId, roomWidthCm, roomLengthCm, onSettledChange }: PlanSandboxProps) {
  // Preview = the layout as the user is tentatively arranging it.
  const [preview, setPreview] = useState<FurnitureItem[]>(baseItems);
  const [infeasible, setInfeasible] = useState(false);
  // Live status for whatever position the block last SETTLED on. Seeded from the
  // real layout so the list is populated the moment the plan appears.
  const [analysis, setAnalysis] = useState<ClearanceResult>(() =>
    runClearanceAnalysis(baseItems, roomWidthCm, roomLengthCm),
  );

  // Freshest preview array, for reading in drag-end without a stale closure.
  const previewRef = useRef<FurnitureItem[]>(baseItems);
  // Last feasible position dragged through; where we snap back to on an
  // infeasible release. Seeded at drag start with the resting position.
  const lastFeasibleRef = useRef<{ x: number; z: number } | null>(null);
  const currentFeasibleRef = useRef(true);

  const baseTarget = useMemo(() => baseItems.find((it) => it.id === targetItemId), [baseItems, targetItemId]);
  const target = preview.find((it) => it.id === targetItemId);

  const runStatus = useCallback(
    (layout: FurnitureItem[]) => setAnalysis(runClearanceAnalysis(layout, roomWidthCm, roomLengthCm)),
    [roomWidthCm, roomLengthCm],
  );

  const handleDragStart = useCallback(
    (itemId: string) => {
      const it = preview.find((p) => p.id === itemId);
      if (!it) throw new Error(`PlanSandbox: drag started on unknown item "${itemId}".`);
      lastFeasibleRef.current = { x: it.posX, z: it.posZ };
      currentFeasibleRef.current = true;
      setInfeasible(false);
      onSettledChange?.(null, false, true);
    },
    [preview, onSettledChange],
  );

  const handleDragMove = useCallback(
    (worldXMetres: number, worldZMetres: number) => {
      // Snap the centre to the 5cm grid so no position yields false precision.
      const snappedX = snapCm(worldXMetres * 100) / 100;
      const snappedZ = snapCm(worldZMetres * 100) / 100;
      const candidate = withMovedItem(preview, targetItemId, snappedX, snappedZ);
      const ok = isFeasible(candidate, roomWidthCm, roomLengthCm);

      // Follow the pointer even into an infeasible spot — flag it, don't block.
      setPreview(candidate);
      previewRef.current = candidate;
      setInfeasible(!ok);
      currentFeasibleRef.current = ok;
      if (ok) lastFeasibleRef.current = { x: snappedX, z: snappedZ };
      onSettledChange?.(null, false, true);
    },
    [preview, targetItemId, roomWidthCm, roomLengthCm, onSettledChange],
  );

  const handleDragEnd = useCallback(() => {
    // Resolve the SETTLED layout: the current position if it's allowed, else
    // snap back to the last allowed position dragged through.
    let settled = previewRef.current;
    if (!currentFeasibleRef.current && lastFeasibleRef.current) {
      settled = withMovedItem(previewRef.current, targetItemId, lastFeasibleRef.current.x, lastFeasibleRef.current.z);
      previewRef.current = settled;
      setPreview(settled);
      setInfeasible(false);
      currentFeasibleRef.current = true;
    }
    // Automatic feedback: re-run the full analysis for the settled position.
    runStatus(settled);
    const settledItem = settled.find((it) => it.id === targetItemId) ?? null;
    const isMoved = checkIsMoved(baseTarget, settledItem ?? undefined);
    onSettledChange?.(settledItem, isMoved, false);
  }, [targetItemId, runStatus, baseTarget, onSettledChange]);

  // Rotate is a discrete action: apply the quarter-turn only if the result fits.
  function rotate() {
    if (!target) return;
    const candidate = withRotatedItem(preview, targetItemId, target.rotationY + Math.PI / 2);
    if (isFeasible(candidate, roomWidthCm, roomLengthCm)) {
      setPreview(candidate);
      previewRef.current = candidate;
      setInfeasible(false);
      currentFeasibleRef.current = true;
      runStatus(candidate);
      const rotatedItem = candidate.find((it) => it.id === targetItemId) ?? null;
      const isMoved = checkIsMoved(baseTarget, rotatedItem ?? undefined);
      onSettledChange?.(rotatedItem, isMoved, false);
    }
  }

  const findings = analysis.violations;

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
            : 'Drag your furniture to try a new spot.'}
        </p>
        <button type="button" onClick={rotate} style={rotateBtn}>
          Rotate 90°
        </button>
      </div>

      <section style={resultCard} aria-live="polite">
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
  ...typeScale.body,
  margin: 0,
  color: t.inkSoft,
};

const rotateBtn: CSSProperties = {
  flexShrink: 0,
  minHeight: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: `1px solid ${t.line}`,
  background: t.surface,
  color: t.brand,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};

const resultCard: CSSProperties = {
  marginTop: 16,
  padding: '6px 14px',
  borderRadius: 14,
  border: `1px solid ${t.line}`,
  background: t.surface,
};
