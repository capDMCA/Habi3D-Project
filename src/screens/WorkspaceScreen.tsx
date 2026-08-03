import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import CondoFloorPlan from '../components/CondoFloorPlan';
import { color as t, radius } from '../components/designTokens';
import { runClearanceAnalysis } from '../engine/clearance';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import { isFeasible, withMovedItem, withRotatedItem } from '../components/floorPlanDrag';
import { computeWalkways } from '../engine/walkways';
import type { FurnitureItem } from '../types';

// ─── Normalization & Initialization ─────────────────────────────────────────
function initializeRoomAssignments(items: FurnitureItem[]): FurnitureItem[] {
  return items.map((item) => {
    if (item.roomId) return item;
    return {
      ...item,
      roomId: getRoomForCategory(item.category, item.label),
    };
  });
}

function normalizeFurniturePositions(items: FurnitureItem[]): FurnitureItem[] {
  return items.map((item) => {
    const roomId = item.roomId || getRoomForCategory(item.category, item.label);
    const room = CONDO_ROOMS.find((r) => r.id === roomId);
    if (!room) return item;

    // Check if the current position is already inside the room
    const rxCm = item.posX * 100;
    const rzCm = item.posZ * 100;
    const padding = 15; // padding in cm
    const inX = rxCm >= room.x + padding && rxCm <= room.x + room.width - padding;
    const inZ = rzCm >= room.y + padding && rzCm <= room.y + room.height - padding;

    if (inX && inZ) return item;

    // Otherwise, place it in the center of its assigned room
    return {
      ...item,
      posX: (room.x + room.width / 2) / 100,
      posZ: (room.y + room.height / 2) / 100,
    };
  });
}

// ─── Tab enum ───────────────────────────────────────────────────────────────
type Tab = 'items' | 'recommendations';

export default function WorkspaceScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const items = useFurnitureStore((s) => s.items);
  const updateItem = useFurnitureStore((s) => s.updateItem);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const setSpaceScoreBefore = useViolationStore((s) => s.setSpaceScoreBefore);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);
  const recommendations = useViolationStore((s) => s.recommendations);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [infeasible, setInfeasible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Room Zoom Focus State
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);

  const [preview, setPreview] = useState<FurnitureItem[]>(items);
  const previewRef = useRef<FurnitureItem[]>(items);
  const lastOkRef = useRef<{ x: number; z: number } | null>(null);
  const okRef = useRef(true);

  // Width/height from store/constants
  const roomWidthCm = 510;
  const roomLengthCm = 880;

  // ── Normalize & Assign rooms once on mount ────────────────────────────────
  useEffect(() => {
    if (items.length > 0 && !loaded) {
      // First ensure all items have roomIds
      const withRooms = initializeRoomAssignments(items);
      withRooms.forEach((it) => {
        if (it.roomId !== items.find((orig) => orig.id === it.id)?.roomId) {
          updateItem(it.id, { roomId: it.roomId });
        }
      });

      // Now normalize inside their room boundaries
      const normalized = normalizeFurniturePositions(withRooms);
      normalized.forEach((it) => {
        updatePosition(it.id, it.posX, it.posZ, it.rotationY);
      });

      setPreview(normalized);
      previewRef.current = normalized;
      setLoaded(true);
    }
  }, [items, updateItem, updatePosition, loaded]);

  // ── Keep preview in sync with store ───────────────────────────────────────
  useEffect(() => {
    if (loaded) {
      setPreview(items);
      previewRef.current = items;
    }
  }, [items, loaded]);

  // ── Toast warning ────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2500);
  }, []);

  // ── Analysis & Walkways ───────────────────────────────────────────────────
  const analysis = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items],
  );

  const walkwayStatuses = useMemo(() => computeWalkways(preview), [preview]);

  useEffect(() => {
    if (analysis.violations.length > 0 && recommendations.length === 0) {
      refreshViolations(analysis.violations);
      setSpaceScoreBefore(analysis.spaceScoreBefore);
    }
  }, [analysis, refreshViolations, recommendations.length, setSpaceScoreBefore]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const selectedItem = useMemo(() => {
    if (selectedId) return preview.find((it) => it.id === selectedId) ?? null;
    return preview[0] ?? null;
  }, [selectedId, preview]);

  if (selectedItem && selectedId !== selectedItem.id) {
    setSelectedId(selectedItem.id);
  }

  const selectedRoomLabel = useMemo(() => {
    if (!selectedItem) return '';
    const roomId = selectedItem.roomId || getRoomForCategory(selectedItem.category, selectedItem.label);
    return CONDO_ROOMS.find((r) => r.id === roomId)?.label ?? 'Living Room';
  }, [selectedItem]);

  // Select Item and Automatically zoom to its Room Zone
  const handleSelectItem = useCallback((id: string) => {
    setSelectedId(id);
    const item = preview.find((it) => it.id === id);
    if (item) {
      const roomId = item.roomId || getRoomForCategory(item.category, item.label);
      setFocusedRoomId(roomId);
    }
  }, [preview]);

  // ── Status map ────────────────────────────────────────────────────────────
  const itemStatuses = useMemo(() => {
    const s: Record<string, 'RED' | 'YELLOW' | 'GREEN'> = {};
    for (const it of preview) {
      const vs = analysis.violations.filter((v) => v.furnitureId === it.id || v.itemBId === it.id);
      if (vs.some((v) => v.classification === 'RED')) s[it.id] = 'RED';
      else if (vs.some((v) => v.classification === 'YELLOW')) s[it.id] = 'YELLOW';
      else s[it.id] = 'GREEN';
    }
    return s;
  }, [preview, analysis.violations]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => {
    const it = preview.find((p) => p.id === id);
    if (!it) return;
    lastOkRef.current = { x: it.posX, z: it.posZ };
    okRef.current = true;
    setInfeasible(false);
  }, [preview]);

  // 60FPS Drag move - bypass heavy validation and analysis checks
  const handleDragMove = useCallback((xm: number, zm: number) => {
    if (!selectedItem) return;
    const next = withMovedItem(preview, selectedItem.id, xm, zm);
    setPreview(next);
    previewRef.current = next;
  }, [preview, selectedItem]);

  // Run overlap/clearance engine checks on release (PointerUp)
  const handleDragEnd = useCallback(() => {
    if (!selectedItem) return;
    const settled = previewRef.current;

    // Run feasibility checks on release
    const ok = isFeasible(settled, roomWidthCm, roomLengthCm);

    if (!ok && lastOkRef.current) {
      // Revert with spring animation to last feasible position if collision detected
      const reverted = withMovedItem(settled, selectedItem.id, lastOkRef.current.x, lastOkRef.current.z);
      previewRef.current = reverted;
      setPreview(reverted);
      setInfeasible(false);
      okRef.current = true;
      showToast(`${selectedItem.label} overlaps with walls or other furniture.`);
    } else {
      // Commit the updated coordinates to store
      const s = settled.find((it) => it.id === selectedItem.id);
      if (s) {
        lastOkRef.current = { x: s.posX, z: s.posZ };
        updatePosition(s.id, s.posX, s.posZ, s.rotationY);
        
        // Re-run the clearance engine and recommendations immediately on release
        const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
        refreshViolations(fresh.violations);
        setSpaceScoreAfter(fresh.spaceScoreBefore);
      }
    }
  }, [selectedItem, roomWidthCm, roomLengthCm, updatePosition, refreshViolations, setSpaceScoreAfter, showToast]);

  const handleRotate = useCallback(() => {
    if (!selectedItem) return;
    const next = withRotatedItem(preview, selectedItem.id, selectedItem.rotationY + Math.PI / 2);
    if (isFeasible(next, roomWidthCm, roomLengthCm)) {
      setPreview(next);
      previewRef.current = next;
      updatePosition(selectedItem.id, selectedItem.posX, selectedItem.posZ, selectedItem.rotationY + Math.PI / 2);
      
      const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
      refreshViolations(fresh.violations);
      setSpaceScoreAfter(fresh.spaceScoreBefore);
    } else {
      showToast(`${selectedItem.label} cannot rotate there (insufficient space).`);
    }
  }, [selectedItem, preview, roomWidthCm, roomLengthCm, updatePosition, refreshViolations, setSpaceScoreAfter, showToast]);

  const handleResetPosition = useCallback(() => {
    if (!selectedItem) return;
    const roomId = selectedItem.roomId || getRoomForCategory(selectedItem.category, selectedItem.label);
    const room = CONDO_ROOMS.find((r) => r.id === roomId);
    if (room) {
      const rx = (room.x + room.width / 2) / 100;
      const rz = (room.y + room.height / 2) / 100;
      updatePosition(selectedItem.id, rx, rz, 0);
      setPreview(useFurnitureStore.getState().items);
    }
  }, [selectedItem, updatePosition]);

  // Counts for pills
  const issueCount = analysis.violations.length;
  const redCount = analysis.violations.filter((v) => v.classification === 'RED').length;
  const yellowCount = analysis.violations.filter((v) => v.classification === 'YELLOW').length;
  const greenCount = preview.length - redCount - yellowCount;
  const blockedWalkwaysCount = walkwayStatuses.filter((w) => w.status === 'RED').length;

  const focusedRoom = useMemo(() => {
    if (!focusedRoomId) return null;
    return CONDO_ROOMS.find((r) => r.id === focusedRoomId) ?? null;
  }, [focusedRoomId]);

  return (
    <div style={shell}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={header}>
        <button className="wksp-icon-btn" style={backBtn} onClick={() => navigateTo('positionMap')} aria-label="Go back">←</button>
        <div style={{ flex: 1 }}>
          {focusedRoom ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
              <span
                style={{ cursor: 'pointer', color: t.brand, fontWeight: 700 }}
                onClick={() => setFocusedRoomId(null)}
              >
                Mulberry Place
              </span>
              <span style={{ color: t.inkMute, fontWeight: 500 }}>&gt;</span>
              <span style={{ color: t.ink, fontWeight: 850 }}>{focusedRoom.label}</span>
            </div>
          ) : (
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.ink }}>Mulberry Place Digital Twin</h1>
          )}
          <p style={{ margin: 0, fontSize: 14, color: t.inkSoft, fontWeight: 500 }}>
            {issueCount === 0 && blockedWalkwaysCount === 0
              ? 'All rooms and walkways clear'
              : `${issueCount} clearance issues · ${blockedWalkwaysCount} blocked walkways`}
          </p>
        </div>
        <button className="wksp-solid-btn" style={finishBtn} onClick={() => navigateTo('report')}>Done</button>
      </header>

      {/* ── SPLIT WORKSPACE ────────────────────────────────────────────────── */}
      <div style={workspaceLayout}>
        {/* LEFT COLUMN: INTERACTIVE DIGITAL TWIN FLOOR PLAN (82% WIDTH ON DESKTOP) */}
        <section style={planPanel}>
          <div style={pillRow}>
            {redCount > 0 && <span style={pill(t.attentionBg, t.attentionFg)}>{redCount} Issues</span>}
            {yellowCount > 0 && <span style={pill(t.tightBg, t.tightFg)}>{yellowCount} Warnings</span>}
            {blockedWalkwaysCount > 0 && (
              <span style={pill(t.attentionBg, t.attentionFg)}>{blockedWalkwaysCount} Walkways Blocked</span>
            )}
            <span style={pill(t.comfortBg, t.comfortFg)}>{greenCount} Clear</span>
          </div>

          <div style={planContainer}>
            <CondoFloorPlan
              items={preview}
              highlightItemId={selectedItem?.id}
              itemStatuses={itemStatuses}
              onSelectItem={handleSelectItem}
              walkwayStatuses={walkwayStatuses}
              focusedRoomId={focusedRoomId}
              onFocusRoom={setFocusedRoomId}
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

          {/* Toast Warning */}
          {toast && <div style={toastBanner}>{toast}</div>}

          {/* Interactive controls under the plan */}
          <div style={controlToolbar}>
            <span style={feedbackHint}>
              {infeasible ? (
                <span style={{ color: t.attentionFg, fontWeight: 700 }}>Collision: overlaps wall or other block</span>
              ) : selectedItem ? (
                <span>Selected {selectedItem.label} inside {selectedRoomLabel}</span>
              ) : (
                'Select a block to drag and rotate it'
              )}
            </span>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="wksp-outline-btn"
                style={actionBtn}
                onClick={handleRotate}
                disabled={!selectedItem}
              >
                Rotate 90
              </button>
              <button
                className="wksp-outline-btn"
                style={secBtn}
                onClick={handleResetPosition}
                disabled={!selectedItem}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: SANDBOX ASSISTANT & DETAIL VIEW (18% WIDTH ON DESKTOP) */}
        <section style={sideDrawer}>
          <div style={tabHeader}>
            <button
              className="wksp-tab-btn"
              style={tabBtn(activeTab === 'items')}
              onClick={() => setActiveTab('items')}
            >
              Items
            </button>
            <button
              className="wksp-tab-btn"
              style={tabBtn(activeTab === 'recommendations')}
              onClick={() => setActiveTab('recommendations')}
            >
              Recommendations
            </button>
          </div>

          <div style={drawerBody}>
            {/* TAB: Items list */}
            {activeTab === 'items' && (
              <div style={scrollContainer}>
                <h3 style={sectionHeading}>Furniture List</h3>
                {preview.map((item) => {
                  const status = itemStatuses[item.id] ?? 'GREEN';
                  const sel = selectedItem?.id === item.id;
                  const meta = statusMeta(
                    status === 'RED' ? 'needs-attention' : status === 'YELLOW' ? 'tight' : 'comfortable',
                  );
                  const roomName = CONDO_ROOMS.find((r) => r.id === (item.roomId || getRoomForCategory(item.category, item.label)))?.label ?? '';

                  return (
                    <div
                      key={item.id}
                      className="wksp-list-row"
                      onClick={() => handleSelectItem(item.id)}
                      style={{
                        ...listItemStyle(sel),
                        borderLeftColor: meta.color,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: t.ink, fontSize: 14 }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>{roomName}</div>
                      </div>
                      <span style={{ ...badgeStyle, background: meta.bg, color: meta.color }}>
                        {status === 'RED' ? 'Needs Attention' : status === 'YELLOW' ? 'Tight' : 'Good'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB: Recommendations list (All in one: Actions, Walkways, Checklist) */}
            {activeTab === 'recommendations' && (
              <div style={scrollContainer}>
                {/* 1. Clearance Recommendations */}
                <h3 style={sectionHeading}>Suggested Actions</h3>
                {issueCount === 0 ? (
                  <div style={successMessage}>
                    All clearances passed!
                  </div>
                ) : (
                  analysis.violations.map((v) => (
                    <div
                      key={v.id}
                      className="wksp-list-row"
                      style={{
                        ...violationCard,
                        borderLeftColor: v.classification === 'RED' ? t.attentionFg : t.tightFg,
                      }}
                      onClick={() => handleSelectItem(v.furnitureId)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: t.ink, fontSize: 13 }}>{v.furnitureLabel}</span>
                        <span style={{
                          ...badgeStyle,
                          background: v.classification === 'RED' ? t.attentionBg : t.tightBg,
                          color: v.classification === 'RED' ? t.attentionFg : t.tightFg,
                        }}>
                          {v.ruleCode}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: 13, color: t.attentionFg, fontWeight: 700 }}>
                        Move {v.furnitureLabel} {v.fixDirectionLabel} by {v.fixDirectionCm}cm
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: t.inkSoft }}>
                        Goal: resolve {v.ruleLabel} clearance issue ({v.measuredCm}cm measured, required: {v.requiredCm}cm)
                      </p>
                    </div>
                  ))
                )}

                {/* 2. Walkways access */}
                <h3 style={{ ...sectionHeading, marginTop: 20 }}>Walkway Access</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {walkwayStatuses.map((w) => {
                    const isRed = w.status === 'RED';
                    const isYellow = w.status === 'YELLOW';
                    return (
                      <div
                        key={w.id}
                        style={{
                          ...checkRow,
                          padding: '10px 12px',
                          borderLeft: `4px solid ${isRed ? t.attentionFg : isYellow ? t.tightFg : t.comfortFg}`,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: t.ink }}>{w.label}</div>
                          <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>
                            {w.clearanceCm} cm (Target: ≥91cm)
                          </div>
                        </div>
                        <span style={{
                          ...badgeStyle,
                          background: isRed ? t.attentionBg : isYellow ? t.tightBg : t.comfortBg,
                          color: isRed ? t.attentionFg : isYellow ? t.tightFg : t.comfortFg,
                        }}>
                          {isRed ? 'Blocked' : isYellow ? 'Tight' : 'Clear'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Room quality checklist */}
                <h3 style={{ ...sectionHeading, marginTop: 20 }}>Room Checklist</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Walking Paths', codes: ['L1', 'L3', 'L4'] },
                    { label: 'Wall Clearances', codes: ['D1', 'D2', 'D3'] },
                    { label: 'Dining Areas', codes: ['D4', 'D5'] },
                    { label: 'TV Clearances', codes: ['L2', 'L5'] },
                  ].map(({ label, codes }) => {
                    const hasIssue = analysis.violations.some((v) => codes.includes(v.ruleCode));
                    return (
                      <div key={label} style={checkRow}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: t.ink }}>{label}</span>
                        <span style={{
                          ...badgeStyle,
                          background: hasIssue ? t.tightBg : t.comfortBg,
                          color: hasIssue ? t.tightFg : t.comfortFg,
                        }}>
                          {hasIssue ? 'Needs Work' : 'Good'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── STYLES — DIGITAL TWIN RESPONSIVE ───────────────────────────────────────

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  width: '100%',
  background: '#F8FAFC',
  fontFamily: "'Inter', system-ui, sans-serif",
  overflow: 'hidden',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 24px',
  background: '#FFFFFF',
  borderBottom: '1px solid #E2E8F0',
  gap: 16,
  flexShrink: 0,
};

const backBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '6px 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const finishBtn: CSSProperties = {
  background: t.brand,
  color: '#FFFFFF',
  border: 'none',
  padding: '10px 24px',
  borderRadius: radius.sm,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};

const workspaceLayout: CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'row',
  height: 'calc(100vh - 60px)',
  overflow: 'hidden',
  flexWrap: 'wrap',
};

const planPanel: CSSProperties = {
  flex: '82% 1 600px', // takes 82% width on desktop
  display: 'flex',
  flexDirection: 'column',
  padding: '24px',
  overflow: 'hidden',
  height: '100%',
  position: 'relative',
};

const planContainer: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 0,
  position: 'relative',
};

const pillRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const pill = (bg: string, fg: string): CSSProperties => ({
  fontSize: 14,
  fontWeight: 700,
  padding: '6px 14px',
  borderRadius: '20px',
  background: bg,
  color: fg,
});

const toastBanner: CSSProperties = {
  position: 'absolute',
  top: 50,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#DC2626',
  color: '#FFFFFF',
  padding: '10px 20px',
  borderRadius: '20px',
  fontSize: 14,
  fontWeight: 700,
  boxShadow: '0 4px 15px rgba(220, 38, 38, 0.25)',
  animation: 'fadeIn 0.2s ease',
  pointerEvents: 'none',
  zIndex: 10,
};

const controlToolbar: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 16,
  borderTop: '1px solid #E2E8F0',
  marginTop: 16,
  flexShrink: 0,
};

const feedbackHint: CSSProperties = {
  fontSize: 16,
  color: t.inkSoft,
  fontWeight: 500,
};

const actionBtn: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #CBD5E1',
  color: t.brand,
  padding: '10px 20px',
  borderRadius: radius.sm,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
};

const secBtn: CSSProperties = {
  background: 'none',
  border: '1px solid transparent',
  color: t.inkSoft,
  padding: '10px 16px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const sideDrawer: CSSProperties = {
  flex: '18% 1 250px', // takes 18% width on desktop
  background: '#FFFFFF',
  borderLeft: '1px solid #E2E8F0',
  boxShadow: '-2px 0 8px rgba(0,0,0,0.01)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

const tabHeader: CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #E2E8F0',
  flexShrink: 0,
  overflowX: 'auto',
};

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '14px 10px',
  border: 'none',
  background: 'none',
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 14,
  fontWeight: 700,
  color: active ? t.brand : t.inkMute,
  borderBottom: active ? `3px solid ${t.brand}` : '3px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

const drawerBody: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};

const scrollContainer: CSSProperties = {
  overflowY: 'auto',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  height: '100%',
};

const sectionHeading: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: t.inkMute,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 6px',
};

const listItemStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: radius.sm,
  background: sel ? t.brandTint : '#F8FAFC',
  border: `1px solid ${sel ? t.brand : '#E2E8F0'}`,
  borderLeft: '4px solid',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const badgeStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '20px',
  whiteSpace: 'nowrap',
};

const violationCard: CSSProperties = {
  padding: '12px 14px',
  borderRadius: radius.sm,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderLeft: '4px solid',
  cursor: 'pointer',
};

const successMessage: CSSProperties = {
  textAlign: 'center',
  color: t.comfortFg,
  fontWeight: 600,
  padding: '24px 12px',
  background: t.comfortBg,
  border: `1px solid ${t.comfortFg}`,
  borderRadius: radius.sm,
  fontSize: 16,
};

const checkRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: radius.sm,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  fontSize: 16,
};

// ─── Status meta helper ─────────────────────────────────────────────────────
interface StatusMeta {
  bg: string;
  color: string;
}

function statusMeta(type: 'needs-attention' | 'tight' | 'comfortable'): StatusMeta {
  if (type === 'needs-attention') {
    return { bg: t.attentionBg, color: t.attentionFg };
  } else if (type === 'tight') {
    return { bg: t.tightBg, color: t.tightFg };
  }
  return { bg: t.comfortBg, color: t.comfortFg };
}
