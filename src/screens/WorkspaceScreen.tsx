import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { runClearanceAnalysis } from '../engine/clearance';
import { stableViolationKey } from '../engine/violationKey';
import { describeFinding } from '../components/findingText';
import { statusMeta } from '../components/statusVocabulary';
import { color as t, type as typeScale, radius, space } from '../components/designTokens';
import FloorPlan2D from '../components/FloorPlan2D';
import { isFeasible, snapCm, withMovedItem, withRotatedItem } from '../components/floorPlanDrag';
import { commitLines } from '../components/previewMove';
import type { FurnitureItem, Violation } from '../types';

// ─── Normalization Helper ───────────────────────────────────────────────────
function normalizeFurniturePositions(
  items: FurnitureItem[],
  roomWidthCm: number,
  roomLengthCm: number
): FurnitureItem[] {
  if (items.length === 0) return [];
  const roomWidthM = roomWidthCm / 100;
  const roomLengthM = roomLengthCm / 100;

  // Calculate layout bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  items.forEach((item) => {
    const halfL = (item.lengthCm / 100) / 2;
    const halfW = (item.widthCm / 100) / 2;
    minX = Math.min(minX, item.posX - halfL);
    maxX = Math.max(maxX, item.posX + halfL);
    minZ = Math.min(minZ, item.posZ - halfW);
    maxZ = Math.max(maxZ, item.posZ + halfW);
  });

  const layoutCenterX = (minX + maxX) / 2;
  const layoutCenterZ = (minZ + maxZ) / 2;

  // Center the layout in the room coordinates
  const dx = (roomWidthM / 2) - layoutCenterX;
  const dz = (roomLengthM / 2) - layoutCenterZ;

  return items.map((item) => {
    let newX = item.posX + dx;
    let newZ = item.posZ + dz;

    const halfL = (item.lengthCm / 100) / 2;
    const halfW = (item.widthCm / 100) / 2;

    // Apply a safe 5cm padding boundary
    const pad = 0.05;
    newX = Math.max(halfL + pad, Math.min(roomWidthM - halfL - pad, newX));
    newZ = Math.max(halfW + pad, Math.min(roomLengthM - halfW - pad, newZ));

    return { ...item, posX: newX, posZ: newZ };
  });
}

// ─── Direction & Shift Mapping ──────────────────────────────────────────────
function getGhostItem(item: FurnitureItem, violation: Violation | undefined): FurnitureItem | null {
  if (!violation || violation.resolved) return null;
  const label = violation.fixDirectionLabel.toLowerCase();
  const distanceM = violation.fixDirectionCm / 100;

  let dx = 0;
  let dz = 0;

  if (label.includes('west')) {
    dx = -distanceM;
  } else if (label.includes('east')) {
    dx = distanceM;
  } else if (label.includes('north')) {
    dz = -distanceM;
  } else if (label.includes('south')) {
    dz = distanceM;
  }

  return {
    ...item,
    posX: item.posX + dx,
    posZ: item.posZ + dz,
  };
}

// ─── Lookahead Lookups (Validation Engine) ───────────────────────────────────
interface LookaheadResult {
  hasWorsened: boolean;
  warnings: string[];
}

function getLookaheadValidation(
  items: FurnitureItem[],
  itemId: string,
  targetX: number,
  targetZ: number,
  targetRot: number,
  roomWidthCm: number,
  roomLengthCm: number
): LookaheadResult {
  let candidate = withRotatedItem(items, itemId, targetRot);
  candidate = withMovedItem(candidate, itemId, targetX, targetZ);

  if (!isFeasible(candidate, roomWidthCm, roomLengthCm)) {
    return {
      hasWorsened: true,
      warnings: ["Position overlaps walls or other furniture blocks."],
    };
  }

  const baseAnalysis = runClearanceAnalysis(items, roomWidthCm, roomLengthCm);
  const simulatedAnalysis = runClearanceAnalysis(candidate, roomWidthCm, roomLengthCm);

  const baseKeys = new Map<string, Violation>();
  baseAnalysis.violations.forEach((v) => baseKeys.set(stableViolationKey(v), v));

  const warnings: string[] = [];
  let hasWorsened = false;

  simulatedAnalysis.violations.forEach((h) => {
    const key = stableViolationKey(h);
    const base = baseKeys.get(key);

    if (!base) {
      hasWorsened = true;
      warnings.push(
        `Crowds space near the ${h.wallSide ? h.wallSide + ' wall' : 'furniture'} (${h.ruleLabel})`
      );
    } else if (h.classification === 'RED' && base.classification === 'YELLOW') {
      hasWorsened = true;
      warnings.push(`Worsens walkway space clearance with ${h.furnitureLabel} from tight to critical`);
    }
  });

  return { hasWorsened, warnings };
}

// ─── Main Workspace Screen ──────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);

  const recommendations = useViolationStore((s) => s.recommendations);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const setSpaceScoreBefore = useViolationStore((s) => s.setSpaceScoreBefore);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);

  const roomWidthCm = useMemo(() => {
    if (!roomDimensions) return 360;
    return Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm);
  }, [roomDimensions]);

  const roomLengthCm = useMemo(() => {
    if (!roomDimensions) return 520;
    return roomDimensions.livingDepthCm + roomDimensions.diningDepthCm;
  }, [roomDimensions]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [infeasible, setInfeasible] = useState(false);

  // Local dragged copy representing the workspace coordinate preview
  const [preview, setPreview] = useState<FurnitureItem[]>(items);
  const previewRef = useRef<FurnitureItem[]>(items);
  const lastFeasibleRef = useRef<{ x: number; z: number } | null>(null);
  const currentFeasibleRef = useRef(true);

  // 1. Initial Coordinate Normalization check
  useEffect(() => {
    if (items.length > 0 && !initialLoaded) {
      // Check if coordinates land outside room boundaries
      const needsNormalization = items.some((item) => {
        const halfL = item.lengthCm / 200;
        const halfW = item.widthCm / 200;
        return (
          item.posX - halfL < 0 ||
          item.posZ - halfW < 0 ||
          item.posX + halfL > roomWidthCm / 100 ||
          item.posZ + halfW > roomLengthCm / 100
        );
      });

      if (needsNormalization) {
        const normalized = normalizeFurniturePositions(items, roomWidthCm, roomLengthCm);
        normalized.forEach((item) => {
          updatePosition(item.id, item.posX, item.posZ, item.rotationY);
        });
        setPreview(normalized);
        previewRef.current = normalized;
      } else {
        setPreview(items);
        previewRef.current = items;
      }
      setInitialLoaded(true);
    }
  }, [items, roomWidthCm, roomLengthCm, updatePosition, initialLoaded]);

  // Synchronize local preview with store additions/changes
  useEffect(() => {
    if (initialLoaded) {
      setPreview(items);
      previewRef.current = items;
    }
  }, [items, initialLoaded]);

  // Analysis derived from store coordinates
  const analysis = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomWidthCm, roomLengthCm]
  );

  // Sync analysis to violationStore
  useEffect(() => {
    if (analysis.violations.length > 0 && recommendations.length === 0) {
      refreshViolations(analysis.violations);
      setSpaceScoreBefore(analysis.spaceScoreBefore);
    }
  }, [analysis, refreshViolations, recommendations.length, setSpaceScoreBefore]);

  // Active target & selection setup
  const selectedItem = useMemo(() => {
    if (selectedItemId) {
      return preview.find((it) => it.id === selectedItemId) ?? null;
    }
    // Default to the first item that has an active violation
    const firstViolationId = analysis.violations[0]?.furnitureId;
    if (firstViolationId) {
      return preview.find((it) => it.id === firstViolationId) ?? null;
    }
    return preview[0] ?? null;
  }, [selectedItemId, preview, analysis.violations]);

  // Sync selected target back to selectedItemId state
  useEffect(() => {
    if (selectedItem && selectedItemId !== selectedItem.id) {
      setSelectedItemId(selectedItem.id);
    }
  }, [selectedItem, selectedItemId]);

  const activeViolation = useMemo(() => {
    if (!selectedItem) return undefined;
    return analysis.violations.find((v) => v.furnitureId === selectedItem.id);
  }, [selectedItem, analysis.violations]);

  const ghostItem = useMemo(() => {
    if (!selectedItem) return null;
    return getGhostItem(selectedItem, activeViolation);
  }, [selectedItem, activeViolation]);

  // Determine item-to-status mappings for FloorPlan2D coloring
  const itemStatuses = useMemo(() => {
    const statuses: Record<string, 'RED' | 'YELLOW' | 'GREEN'> = {};
    preview.forEach((item) => {
      const itemViolations = analysis.violations.filter(
        (v) => v.furnitureId === item.id || v.itemBId === item.id
      );
      if (itemViolations.some((v) => v.classification === 'RED')) {
        statuses[item.id] = 'RED';
      } else if (itemViolations.some((v) => v.classification === 'YELLOW')) {
        statuses[item.id] = 'YELLOW';
      } else {
        statuses[item.id] = 'GREEN';
      }
    });
    return statuses;
  }, [preview, analysis.violations]);

  // Checklist Categories
  const checklist = useMemo(() => {
    const walkingStatus = analysis.violations.some(
      (v) => ['L1', 'L3', 'L4'].includes(v.ruleCode) && v.itemBId !== 'wall'
    )
      ? 'Needs Adjustment'
      : 'Good';

    const wallStatus = analysis.violations.some(
      (v) => (v.ruleCode === 'L1' && v.itemBId === 'wall') || ['D1', 'D2', 'D3'].includes(v.ruleCode)
    )
      ? 'Needs Adjustment'
      : 'Good';

    const diningStatus = analysis.violations.some((v) => ['D4', 'D5'].includes(v.ruleCode))
      ? 'Needs Adjustment'
      : 'Good';

    const tvStatus = analysis.violations.some((v) => ['L2', 'L5'].includes(v.ruleCode))
      ? 'Needs Adjustment'
      : 'Good';

    return {
      walking: walkingStatus,
      wall: wallStatus,
      dining: diningStatus,
      tv: tvStatus,
      totalIssues: analysis.violations.length,
      resolvedIssues: items.length - analysis.violations.length, // approximation of solved items
    };
  }, [analysis.violations, items.length]);

  // ─── LOOKAHEAD SIMULATION LOOKUPS ──────────────────────────────────────────
  const recommendedValidation = useMemo(() => {
    if (!selectedItem || !activeViolation) return null;
    const ghost = getGhostItem(selectedItem, activeViolation);
    if (!ghost) return null;

    return getLookaheadValidation(
      preview,
      selectedItem.id,
      ghost.posX,
      ghost.posZ,
      ghost.rotationY,
      roomWidthCm,
      roomLengthCm
    );
  }, [selectedItem, activeViolation, preview, roomWidthCm, roomLengthCm]);

  // Drag handlers
  const handleDragStart = useCallback(
    (itemId: string) => {
      const it = preview.find((p) => p.id === itemId);
      if (!it) return;
      lastFeasibleRef.current = { x: it.posX, z: it.posZ };
      currentFeasibleRef.current = true;
      setInfeasible(false);
    },
    [preview]
  );

  const handleDragMove = useCallback(
    (worldXMetres: number, worldZMetres: number) => {
      if (!selectedItem) return;
      const snappedX = snapCm(worldXMetres * 100) / 100;
      const snappedZ = snapCm(worldZMetres * 100) / 100;
      const candidate = withMovedItem(preview, selectedItem.id, snappedX, snappedZ);
      const ok = isFeasible(candidate, roomWidthCm, roomLengthCm);

      setPreview(candidate);
      previewRef.current = candidate;
      setInfeasible(!ok);
      currentFeasibleRef.current = ok;
      if (ok) lastFeasibleRef.current = { x: snappedX, z: snappedZ };
    },
    [preview, selectedItem, roomWidthCm, roomLengthCm]
  );

  const handleDragEnd = useCallback(() => {
    if (!selectedItem) return;
    let settled = previewRef.current;

    if (!currentFeasibleRef.current && lastFeasibleRef.current) {
      settled = withMovedItem(previewRef.current, selectedItem.id, lastFeasibleRef.current.x, lastFeasibleRef.current.z);
      previewRef.current = settled;
      setPreview(settled);
      setInfeasible(false);
      currentFeasibleRef.current = true;
    }

    // Auto-snapping to Ghost recommended outline within 5cm tolerance
    const finalItem = settled.find((it) => it.id === selectedItem.id);
    if (finalItem && ghostItem) {
      const dx = Math.abs(finalItem.posX - ghostItem.posX);
      const dz = Math.abs(finalItem.posZ - ghostItem.posZ);
      if (dx <= 0.05 && dz <= 0.05) {
        settled = withMovedItem(settled, selectedItem.id, ghostItem.posX, ghostItem.posZ);
        setPreview(settled);
        previewRef.current = settled;
      }
    }

    // Write directly to store coordinate systems
    const settledItem = settled.find((it) => it.id === selectedItem.id);
    if (settledItem) {
      updatePosition(settledItem.id, settledItem.posX, settledItem.posZ, settledItem.rotationY);
      // Update analysis state
      const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
      refreshViolations(fresh.violations);
      setSpaceScoreAfter(fresh.spaceScoreBefore);
    }
  }, [selectedItem, ghostItem, roomWidthCm, roomLengthCm, updatePosition, refreshViolations, setSpaceScoreAfter]);

  const handleRotate = useCallback(() => {
    if (!selectedItem) return;
    const candidate = withRotatedItem(preview, selectedItem.id, selectedItem.rotationY + Math.PI / 2);

    if (isFeasible(candidate, roomWidthCm, roomLengthCm)) {
      setPreview(candidate);
      previewRef.current = candidate;
      updatePosition(selectedItem.id, selectedItem.posX, selectedItem.posZ, selectedItem.rotationY + Math.PI / 2);
      const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
      refreshViolations(fresh.violations);
      setSpaceScoreAfter(fresh.spaceScoreBefore);
    }
  }, [selectedItem, preview, roomWidthCm, roomLengthCm, updatePosition, refreshViolations, setSpaceScoreAfter]);

  const handleResetPosition = useCallback(() => {
    if (!selectedItem) return;
    // Standard starting layout centroids center coordinates can serve as resets
    const normalizedItems = normalizeFurniturePositions(
      useFurnitureStore.getState().items,
      roomWidthCm,
      roomLengthCm
    );
    const origin = normalizedItems.find((it) => it.id === selectedItem.id);
    if (origin) {
      updatePosition(selectedItem.id, origin.posX, origin.posZ, origin.rotationY);
      setPreview(useFurnitureStore.getState().items);
    }
  }, [selectedItem, roomWidthCm, roomLengthCm, updatePosition]);

  return (
    <div style={containerStyle}>
      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <button style={backBtnStyle} onClick={() => navigateTo('positionMap')}>
            ← Back
          </button>
          <div>
            <h1 style={{ ...typeScale.title, margin: 0 }}>Habi3D Layout Workspace</h1>
            <span style={{ ...typeScale.label, color: t.inkSoft, textTransform: 'none' }}>
              Drag, select, and optimize layout live
            </span>
          </div>
        </div>
        <button style={finishBtnStyle} onClick={() => navigateTo('report')}>
          Finish Session
        </button>
      </header>

      {/* ─── 3-COLUMN WORKSPACE BODY ────────────────────────────────────────── */}
      <main style={mainLayoutStyle}>
        {/* COLUMN 1: FURNITURE LIST */}
        <section style={leftColStyle}>
          <h2 style={{ ...typeScale.label, color: t.inkMute, marginBottom: space.sm }}>Furniture List</h2>
          <div style={scrollContainer}>
            {preview.map((item) => {
              const status = itemStatuses[item.id] ?? 'GREEN';
              const isSelected = selectedItem?.id === item.id;
              const meta = statusMeta(status === 'RED' ? 'needs-attention' : status === 'YELLOW' ? 'tight' : 'comfortable');

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  style={{
                    ...itemCardStyle(isSelected),
                    borderLeft: `5px solid ${meta.color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: t.brand }}>{item.label}</span>
                    <span style={{ ...badgeStyle, background: meta.bg, color: meta.color }}>
                      {status === 'RED' ? 'Needs Attention' : status === 'YELLOW' ? 'Tight' : 'Comfortable'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 4 }}>
                    {item.lengthCm} x {item.widthCm} x {item.heightCm} cm
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: space.sm }}>
            <button style={btnActionStyle} onClick={handleResetPosition} disabled={!selectedItem}>
              Reset Position
            </button>
          </div>
        </section>

        {/* COLUMN 2: SVG FLOOR PLAN CENTER */}
        <section style={centerColStyle}>
          <div style={canvasBoxStyle}>
            <FloorPlan2D
              items={preview}
              roomWidthCm={roomWidthCm}
              roomLengthCm={roomLengthCm}
              highlightItemId={selectedItem?.id}
              itemStatuses={itemStatuses}
              ghostItem={ghostItem}
              onSelectItem={setSelectedItemId}
              interactive={
                selectedItem
                  ? {
                      draggableItemId: selectedItem.id,
                      infeasible,
                      onDragStart: handleDragStart,
                      onDragMove: handleDragMove,
                      onDragEnd: handleDragEnd,
                    }
                  : undefined
              }
            />
          </div>

          <div style={toolRowStyle}>
            <p style={{ ...typeScale.body, color: t.inkSoft, margin: 0 }}>
              {infeasible ? (
                <span style={{ color: t.attentionFg }}>❌ Position overlaps boundaries or furniture.</span>
              ) : (
                '💡 Drag furniture blocks to experiment with alternative layouts.'
              )}
            </p>
            <div style={{ display: 'flex', gap: space.sm }}>
              <button style={btnRotateStyle} onClick={handleRotate} disabled={!selectedItem}>
                Rotate 90°
              </button>
            </div>
          </div>
        </section>

        {/* COLUMN 3: INTELLIGENT DESIGN ASSISTANT */}
        <section style={rightColStyle}>
          <h2 style={{ ...typeScale.label, color: t.inkMute, marginBottom: space.sm }}>Design Assistant</h2>

          {selectedItem && activeViolation ? (
            <div style={assistantCard}>
              <span style={{ ...badgeStyle, background: t.attentionBg, color: t.attentionFg, marginBottom: 8, display: 'inline-block' }}>
                Issue Detected
              </span>
              <p style={{ ...typeScale.title, margin: '0 0 4px', color: t.ink }}>{selectedItem.label}</p>
              <p style={{ ...typeScale.body, fontWeight: 700, margin: '0 0 12px', color: t.inkSoft }}>
                {describeFinding(activeViolation, preview)}
              </p>

              <div style={specRowStyle}>
                <div>
                  <span style={specLabel}>Current Gap</span>
                  <span style={specVal(t.attentionFg)}>{activeViolation.measuredCm} cm</span>
                </div>
                <div>
                  <span style={specLabel}>Target Gap</span>
                  <span style={specVal(t.comfortFg)}>{activeViolation.requiredCm} cm</span>
                </div>
              </div>

              <div style={{ margin: '16px 0', borderTop: `1px solid ${t.line}`, paddingTop: 12 }}>
                <span style={specLabel}>Recommended Adjustment</span>
                <p style={{ ...typeScale.body, color: t.ink, fontWeight: 600 }}>
                  {commitLines({
                    itemId: selectedItem.id,
                    itemLabel: selectedItem.label,
                    directionWall: activeViolation.wallSide ?? null,
                    distanceCm: activeViolation.fixDirectionCm,
                    dxCm: 0,
                    dzCm: 0,
                    rotationDeltaRad: 0,
                    rotationDeg: 0,
                    facingAfter: null,
                  }).join(' ')}
                </p>
              </div>

              {/* SIMULATED LOOKAHEAD RECOMMENDATION VALIDATION */}
              <div style={lookaheadBox(recommendedValidation?.hasWorsened ?? false)}>
                <span style={{ ...typeScale.label, fontSize: 11, color: t.brand, marginBottom: 4 }}>
                  Whole-Room Simulation Lookahead
                </span>
                {recommendedValidation ? (
                  recommendedValidation.hasWorsened ? (
                    <div>
                      <p style={{ ...typeScale.body, color: t.attentionFg, fontWeight: 700, margin: 0 }}>
                        ⚠️ Warning: Creating new crowding issues:
                      </p>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13, color: t.attentionFg }}>
                        {recommendedValidation.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p style={{ ...typeScale.body, color: t.comfortFg, fontWeight: 600, margin: 0 }}>
                      ✅ Safely validated: No secondary violations created elsewhere in the room.
                    </p>
                  )
                ) : null}
              </div>
            </div>
          ) : selectedItem ? (
            <div style={assistantCard}>
              <p style={{ ...typeScale.title, color: t.comfortFg, margin: '0 0 6px' }}>✅ Clearance Compliant</p>
              <p style={{ ...typeScale.body, color: t.inkSoft, margin: 0 }}>
                {selectedItem.label} satisfies all clearance requirements in this layout position.
              </p>
            </div>
          ) : (
            <p style={{ color: t.inkSoft, textAlign: 'center', marginTop: 32 }}>Select an item to view recommendations.</p>
          )}

          {/* Actionable Category Checklist */}
          <div style={{ marginTop: 'auto', borderTop: `1px solid ${t.line}`, paddingTop: 16 }}>
            <h3 style={{ ...typeScale.label, color: t.inkMute, marginBottom: 12 }}>Room Quality Checklist</h3>
            <div style={checklistRow}>
              <span>🚶 Walking Paths</span>
              <span style={checklistBadge(checklist.walking === 'Good')}>{checklist.walking}</span>
            </div>
            <div style={checklistRow}>
              <span>🏢 Wall Clearances</span>
              <span style={checklistBadge(checklist.wall === 'Good')}>{checklist.wall}</span>
            </div>
            <div style={checklistRow}>
              <span>🍽️ Dining Areas</span>
              <span style={checklistBadge(checklist.dining === 'Good')}>{checklist.dining}</span>
            </div>
            <div style={checklistRow}>
              <span>📺 TV Viewing clearances</span>
              <span style={checklistBadge(checklist.tv === 'Good')}>{checklist.tv}</span>
            </div>
          </div>
        </section>
      </main>

      {/* ─── LIVE SUMMARY FOOTER ────────────────────────────────────────────── */}
      <footer style={footerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ ...typeScale.body, fontWeight: 700, color: t.ink }}>
            Issues Resolved: {checklist.resolvedIssues} of {items.length} items compliant
          </span>
          <div style={barTrack}>
            <div
              style={{
                height: '100%',
                background: checklist.totalIssues === 0 ? t.comfortFg : t.brand,
                width: `${items.length > 0 ? (checklist.resolvedIssues / items.length) * 100 : 0}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
        <span style={{ ...typeScale.body, color: t.inkSoft, fontStyle: 'italic' }}>
          {checklist.totalIssues === 0
            ? '🎉 Excellent layout: all clearance rules satisfied!'
            : `⚠️ ${checklist.totalIssues} clearance issue(s) remaining`}
        </span>
      </footer>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  background: t.ground,
  color: t.ink,
  fontFamily: "'Inter', system-ui, sans-serif",
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px 24px',
  background: t.surface,
  borderBottom: `1px solid ${t.line}`,
};

const backBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: t.brand,
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 14,
};

const finishBtnStyle: CSSProperties = {
  background: t.brand,
  color: t.surface,
  border: 'none',
  padding: '8px 16px',
  borderRadius: radius.sm,
  fontWeight: 700,
  cursor: 'pointer',
};

const mainLayoutStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  height: 'calc(100vh - 140px)',
  overflow: 'hidden',
};

const leftColStyle: CSSProperties = {
  width: '280px',
  background: t.surface,
  borderRight: `1px solid ${t.line}`,
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const scrollContainer: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  paddingRight: '4px',
};

const itemCardStyle = (isSelected: boolean): CSSProperties => ({
  background: isSelected ? t.brandTint : t.ground,
  border: `1px solid ${isSelected ? t.brand : t.line}`,
  padding: '12px',
  borderRadius: radius.sm,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
});

const badgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: '20px',
};

const btnActionStyle: CSSProperties = {
  background: t.surface,
  border: `1px solid ${t.line}`,
  color: t.ink,
  padding: '10px',
  borderRadius: radius.sm,
  fontWeight: 700,
  cursor: 'pointer',
};

const centerColStyle: CSSProperties = {
  flex: 1,
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: t.ground,
};

const canvasBoxStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  background: t.surface,
  borderRadius: radius.md,
  padding: '16px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  border: `1px solid ${t.line}`,
};

const toolRowStyle: CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  marginTop: '16px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const btnRotateStyle: CSSProperties = {
  background: t.surface,
  border: `1px solid ${t.line}`,
  color: t.brand,
  padding: '8px 16px',
  borderRadius: radius.sm,
  fontWeight: 700,
  cursor: 'pointer',
};

const rightColStyle: CSSProperties = {
  width: '320px',
  background: t.surface,
  borderLeft: `1px solid ${t.line}`,
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const assistantCard: CSSProperties = {
  background: t.ground,
  padding: '14px',
  borderRadius: radius.md,
  border: `1px solid ${t.line}`,
};

const specRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  background: t.surface,
  padding: '8px 12px',
  borderRadius: radius.sm,
  border: `1px solid ${t.line}`,
};

const specLabel: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: t.inkMute,
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: '2px',
};

const specVal = (color: string): CSSProperties => ({
  fontSize: '15px',
  fontWeight: 800,
  color,
});

const lookaheadBox = (worsened: boolean): CSSProperties => ({
  marginTop: '12px',
  background: worsened ? t.attentionBg : t.comfortBg,
  border: `1px solid ${worsened ? t.attentionFg : t.comfortFg}`,
  padding: '10px 12px',
  borderRadius: radius.sm,
  display: 'flex',
  flexDirection: 'column',
});

const checklistRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: `1px solid ${t.line}`,
  fontSize: '14px',
};

const checklistBadge = (isGood: boolean): CSSProperties => ({
  fontSize: '11px',
  fontWeight: 700,
  color: isGood ? t.comfortFg : t.tightFg,
  background: isGood ? t.comfortBg : t.tightBg,
  padding: '3px 8px',
  borderRadius: '20px',
});

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 24px',
  background: t.surface,
  borderTop: `1px solid ${t.line}`,
};

const barTrack: CSSProperties = {
  width: '180px',
  height: '8px',
  borderRadius: '4px',
  background: t.line,
  overflow: 'hidden',
};
