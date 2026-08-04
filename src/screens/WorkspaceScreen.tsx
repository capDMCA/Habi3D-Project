import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import CondoFloorPlan from '../components/CondoFloorPlan';
import ClearanceMeter, { BandGlyph } from '../components/ClearanceMeter';
import { color as t, radius } from '../components/designTokens';
import { runClearanceAnalysis } from '../engine/clearance';
import { ALL_RULE_GUIDANCE, ruleGuidance } from '../engine/ruleGuidance';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import {
  canPlace,
  clampToUnit,
  overlappingItemIds,
  packItemsIntoRoom,
  roomIdForItem,
  withMovedItem,
} from '../components/floorPlanDrag';
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

/**
 * Give every piece a sane opening position. Pieces already sitting inside their
 * room are left alone; the rest are packed into that room side by side.
 *
 * The previous version dropped each stray piece on its room's exact centre, so
 * a room with three pieces opened with all three occupying the same point —
 * a permanent overlap that made every later placement look invalid.
 */
function normalizeFurniturePositions(items: FurnitureItem[]): FurnitureItem[] {
  const settled: FurnitureItem[] = [];
  const needsPlacing = new Map<string, FurnitureItem[]>();

  items.forEach((item) => {
    const roomId = item.roomId || getRoomForCategory(item.category, item.label);
    const room = CONDO_ROOMS.find((r) => r.id === roomId);
    if (!room) {
      settled.push(item);
      return;
    }

    const rxCm = item.posX * 100;
    const rzCm = item.posZ * 100;
    const padding = 15;
    const inX = rxCm >= room.x + padding && rxCm <= room.x + room.width - padding;
    const inZ = rzCm >= room.y + padding && rzCm <= room.y + room.height - padding;

    // Already placed sensibly and not sitting on top of something else.
    if (inX && inZ && overlappingItemIds(item, items).length === 0) {
      settled.push(item);
      return;
    }

    const bucket = needsPlacing.get(roomId) ?? [];
    bucket.push(item);
    needsPlacing.set(roomId, bucket);
  });

  const placed = new Map<string, FurnitureItem>();
  needsPlacing.forEach((bucket, roomId) => {
    const room = CONDO_ROOMS.find((r) => r.id === roomId);
    if (!room) {
      bucket.forEach((it) => placed.set(it.id, it));
      return;
    }
    packItemsIntoRoom(bucket, room).forEach((it) => placed.set(it.id, it));
  });

  // Preserve the caller's ordering.
  return items.map((item) => placed.get(item.id) ?? settled.find((s) => s.id === item.id) ?? item);
}

// ─── Tab enum ───────────────────────────────────────────────────────────────
type Tab = 'items' | 'recommendations' | 'rules';

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
  // Layout snapshots taken before each committed change, for undo.
  const historyRef = useRef<FurnitureItem[][]>([]);

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

  // Selecting a piece must NOT re-frame the camera: selection happens on
  // pointerdown, and zooming while the user is starting a drag pulls the plan
  // out from under their cursor. Room focus stays a deliberate action (click a
  // room's empty area, or the minimap).
  const handleSelectItem = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

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

  // ── Commit a settled layout to the store and re-run the engine ────────────
  const commitLayout = useCallback(
    (layout: FurnitureItem[], changed: FurnitureItem) => {
      previewRef.current = layout;
      setPreview(layout);
      updateItem(changed.id, { roomId: changed.roomId });
      updatePosition(changed.id, changed.posX, changed.posZ, changed.rotationY);

      const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
      refreshViolations(fresh.violations);
      setSpaceScoreAfter(fresh.spaceScoreBefore);
    },
    [roomWidthCm, roomLengthCm, updateItem, updatePosition, refreshViolations, setSpaceScoreAfter],
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => {
    const it = previewRef.current.find((p) => p.id === id);
    if (!it) return;
    // Remember where it came from, so an impossible drop can fall back to a
    // spot the user actually dragged through rather than the origin.
    historyRef.current.push(previewRef.current);
    if (historyRef.current.length > 50) historyRef.current.shift();
    lastOkRef.current = { x: it.posX, z: it.posZ };
    okRef.current = true;
    setInfeasible(false);
  }, []);

  // Runs every pointermove — keep it cheap. Only the dragged piece is checked;
  // the full clearance engine waits until release.
  const handleDragMove = useCallback((draggedId: string, xm: number, zm: number) => {
    setPreview((prev) => {
      const next = withMovedItem(prev, draggedId, xm, zm);
      previewRef.current = next;

      const moved = next.find((it) => it.id === draggedId);
      if (moved) {
        const clear = overlappingItemIds(moved, next).length === 0;
        okRef.current = clear;
        setInfeasible(!clear);
        if (clear) lastOkRef.current = { x: xm, z: zm };
      }
      return next;
    });
  }, []);

  // On release: re-home the piece into whichever room it was dropped in, and
  // run the clearance engine against the committed layout.
  const handleDragEnd = useCallback(
    (draggedId: string) => {
      const settled = previewRef.current;
      const item = settled.find((it) => it.id === draggedId);
      if (!item) return;

      setInfeasible(false);

      // Only the dragged piece gates the drop. Overlaps elsewhere in the layout
      // are the user's business, not a reason to reject this move.
      if (overlappingItemIds(item, settled).length > 0) {
        const fallback = lastOkRef.current;
        if (fallback) {
          const reverted = withMovedItem(settled, draggedId, fallback.x, fallback.z);
          const revertedItem = reverted.find((it) => it.id === draggedId)!;
          const rehomed = { ...revertedItem, roomId: roomIdForItem(revertedItem) };
          commitLayout(
            reverted.map((it) => (it.id === draggedId ? rehomed : it)),
            rehomed,
          );
          showToast(`${item.label} would overlap another piece — moved to the last clear spot.`);
          return;
        }
      }

      const newRoomId = roomIdForItem(item);
      const rehomed = { ...item, roomId: newRoomId };
      const layout = settled.map((it) => (it.id === draggedId ? rehomed : it));

      if (newRoomId !== (item.roomId ?? null)) {
        const roomLabel = CONDO_ROOMS.find((r) => r.id === newRoomId)?.label;
        if (roomLabel) showToast(`${item.label} moved to ${roomLabel}.`);
      }

      lastOkRef.current = { x: item.posX, z: item.posZ };
      commitLayout(layout, rehomed);
    },
    [commitLayout, showToast],
  );

  // ── Nudge / rotate / undo ─────────────────────────────────────────────────
  const nudgeSelected = useCallback(
    (dxCm: number, dzCm: number) => {
      const current = previewRef.current.find((it) => it.id === selectedId);
      if (!current) return;

      const target = { ...current, posX: current.posX + dxCm / 100, posZ: current.posZ + dzCm / 100 };
      const placed = clampToUnit(target, target.posX, target.posZ);
      const moved = { ...current, posX: placed.posX, posZ: placed.posZ };

      if (overlappingItemIds(moved, previewRef.current).length > 0) {
        showToast(`${current.label} is blocked in that direction.`);
        return;
      }

      historyRef.current.push(previewRef.current);
      if (historyRef.current.length > 50) historyRef.current.shift();

      const rehomed = { ...moved, roomId: roomIdForItem(moved) };
      commitLayout(
        previewRef.current.map((it) => (it.id === rehomed.id ? rehomed : it)),
        rehomed,
      );
    },
    [selectedId, commitLayout, showToast],
  );

  const handleRotate = useCallback(() => {
    if (!selectedItem) return;
    const rotation = selectedItem.rotationY + Math.PI / 2;
    const rotated = { ...selectedItem, rotationY: rotation };

    // Keep the turned footprint inside the unit before judging it.
    const placed = clampToUnit(rotated, rotated.posX, rotated.posZ);
    const candidate = { ...rotated, posX: placed.posX, posZ: placed.posZ };

    if (!canPlace(candidate, preview)) {
      showToast(`${selectedItem.label} cannot rotate there — not enough room.`);
      return;
    }

    historyRef.current.push(previewRef.current);
    if (historyRef.current.length > 50) historyRef.current.shift();

    const rehomed = { ...candidate, roomId: roomIdForItem(candidate) };
    commitLayout(
      preview.map((it) => (it.id === rehomed.id ? rehomed : it)),
      rehomed,
    );
  }, [selectedItem, preview, commitLayout, showToast]);

  const handleUndo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) {
      showToast('Nothing to undo.');
      return;
    }
    previewRef.current = previous;
    setPreview(previous);
    previous.forEach((it) => {
      updateItem(it.id, { roomId: it.roomId });
      updatePosition(it.id, it.posX, it.posZ, it.rotationY);
    });
    const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
    refreshViolations(fresh.violations);
    setSpaceScoreAfter(fresh.spaceScoreBefore);
  }, [roomWidthCm, roomLengthCm, updateItem, updatePosition, refreshViolations, setSpaceScoreAfter, showToast]);

  // Send a piece back to its category's home room, into the first free slot
  // there rather than onto whatever already occupies the centre.
  const handleResetPosition = useCallback(() => {
    if (!selectedItem) return;
    const homeRoomId = getRoomForCategory(selectedItem.category, selectedItem.label);
    const room = CONDO_ROOMS.find((r) => r.id === homeRoomId);
    if (!room) return;

    const others = previewRef.current.filter((it) => it.id !== selectedItem.id);
    const upright = { ...selectedItem, rotationY: 0 };
    const [packed] = packItemsIntoRoom([upright], room);

    // Walk the room on a coarse lattice until the piece lands somewhere clear.
    let target = packed;
    if (overlappingItemIds(packed, others).length > 0) {
      const step = 0.2;
      search: for (let z = room.y / 100; z < (room.y + room.height) / 100; z += step) {
        for (let x = room.x / 100; x < (room.x + room.width) / 100; x += step) {
          const placed = clampToUnit(upright, x, z);
          const trial = { ...upright, posX: placed.posX, posZ: placed.posZ };
          if (overlappingItemIds(trial, others).length === 0) {
            target = trial;
            break search;
          }
        }
      }
    }

    historyRef.current.push(previewRef.current);
    if (historyRef.current.length > 50) historyRef.current.shift();

    const rehomed = { ...target, roomId: roomIdForItem(target) };
    commitLayout(
      previewRef.current.map((it) => (it.id === rehomed.id ? rehomed : it)),
      rehomed,
    );
  }, [selectedItem, commitLayout]);

  // ── Keyboard: arrow nudge, R rotate, Ctrl/Cmd+Z undo ──────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (!selectedId) return;

      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          nudgeSelected(-step, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          nudgeSelected(step, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          nudgeSelected(0, -step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          nudgeSelected(0, step);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRotate();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, nudgeSelected, handleRotate, handleUndo]);

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
                <span style={{ color: t.attentionFg, fontWeight: 700 }}>
                  Overlapping another piece — release to snap back to the last clear spot
                </span>
              ) : selectedItem ? (
                <span>
                  {selectedItem.label} in {selectedRoomLabel}
                  <span style={{ color: t.inkMute, fontWeight: 500 }}>
                    {' · '}drag anywhere · arrows nudge · R rotates · Ctrl+Z undo
                  </span>
                </span>
              ) : (
                'Drag any piece to move it — it can go into any room'
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
                onClick={handleUndo}
              >
                Undo
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
              Fixes{issueCount > 0 ? ` (${issueCount})` : ''}
            </button>
            <button
              className="wksp-tab-btn"
              style={tabBtn(activeTab === 'rules')}
              onClick={() => setActiveTab('rules')}
            >
              Rules
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
                <h3 style={sectionHeading}>What to fix</h3>
                {issueCount === 0 ? (
                  <div style={successMessage}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                      <BandGlyph band="GREEN" size={12} />
                      Every clearance rule passes
                    </span>
                  </div>
                ) : (
                  analysis.violations.map((v, idx) => {
                    const g = ruleGuidance(v.ruleCode);
                    const isRed = v.classification === 'RED';
                    const bandColor = isRed ? t.attentionFg : t.tightFg;
                    const isFocused = selectedItem?.id === v.furnitureId;

                    return (
                      <div
                        key={v.id}
                        className="wksp-rec-card"
                        style={{
                          ...violationCard,
                          borderLeftColor: bandColor,
                          borderColor: isFocused ? bandColor : '#E2E8F0',
                          background: isFocused ? '#FFFFFF' : '#F8FAFC',
                          animationDelay: `${Math.min(idx, 8) * 40}ms`,
                        }}
                        onClick={() => handleSelectItem(v.furnitureId)}
                      >
                        {/* Status + which piece */}
                        <div style={recHeaderRow}>
                          <span style={{ fontWeight: 700, color: t.ink, fontSize: 14 }}>{v.furnitureLabel}</span>
                          <span
                            style={{
                              ...badgeStyle,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              background: isRed ? t.attentionBg : t.tightBg,
                              color: bandColor,
                            }}
                          >
                            <BandGlyph band={isRed ? 'RED' : 'YELLOW'} size={9} />
                            {isRed ? 'Too tight' : 'Tight'}
                          </span>
                        </div>

                        {/* The rule, in words before codes */}
                        <p style={recRuleTitle}>{g?.title ?? v.ruleLabel}</p>
                        <p style={recRequirement}>{g?.requirement ?? v.ruleLabel}</p>

                        {/* Where this measurement sits across the rule's bands */}
                        {g && <ClearanceMeter guidance={g} measuredCm={v.measuredCm} />}

                        {/* The move that resolves it */}
                        <div style={{ ...recActionRow, borderColor: bandColor }}>
                          <span style={{ color: t.inkSoft, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                            DO THIS
                          </span>
                          <span style={{ color: t.ink, fontSize: 13, fontWeight: 700 }}>
                            Move {v.fixDirectionLabel.toLowerCase()} by {v.fixDirectionCm} cm
                          </span>
                          <span style={{ color: t.inkSoft, fontSize: 12 }}>
                            Otherwise {g?.consequence ?? 'the gap stays tighter than recommended'}.
                          </span>
                        </div>

                        <span style={recRuleRef}>Rule {v.ruleCode} · {v.ruleLabel}</span>
                      </div>
                    );
                  })
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

            {/* TAB: The 10 clearance rules, with each rule's own bands */}
            {activeTab === 'rules' && (
              <div style={scrollContainer}>
                <h3 style={sectionHeading}>Clearance rules</h3>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>
                  Every gap in your layout is measured against these. A rule passes once its
                  gap reaches the comfortable range.
                </p>

                {/* Colour-independent key, stated once for the whole list */}
                <div style={legendRow}>
                  {(['RED', 'YELLOW', 'GREEN'] as const).map((band) => (
                    <span key={band} style={legendItem}>
                      <BandGlyph band={band} size={9} />
                      <span style={{ color: t.inkSoft }}>
                        {band === 'RED' ? 'Too tight' : band === 'YELLOW' ? 'Tight' : 'Comfortable'}
                      </span>
                    </span>
                  ))}
                </div>

                {(['Living area', 'Dining area'] as const).map((area) => (
                  <div key={area} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <h4 style={ruleGroupHeading}>{area}</h4>
                    {ALL_RULE_GUIDANCE.filter((g) => g.area === area).map((g) => {
                      const breached = analysis.violations.filter((v) => v.ruleCode === g.code);
                      const worst = breached.some((v) => v.classification === 'RED')
                        ? 'RED'
                        : breached.length > 0
                          ? 'YELLOW'
                          : 'GREEN';

                      return (
                        <div
                          key={g.code}
                          style={{
                            ...ruleRefCard,
                            borderLeft: `4px solid ${
                              worst === 'RED' ? t.attentionFg : worst === 'YELLOW' ? t.tightFg : t.comfortFg
                            }`,
                          }}
                        >
                          <div style={recHeaderRow}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: t.ink }}>{g.title}</span>
                            <span
                              style={{
                                ...badgeStyle,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                background:
                                  worst === 'RED' ? t.attentionBg : worst === 'YELLOW' ? t.tightBg : t.comfortBg,
                                color: worst === 'RED' ? t.attentionFg : worst === 'YELLOW' ? t.tightFg : t.comfortFg,
                              }}
                            >
                              <BandGlyph band={worst} size={9} />
                              {breached.length > 0
                                ? `${breached.length} to fix`
                                : 'Passing'}
                            </span>
                          </div>
                          <p style={recRequirement}>{g.requirement}</p>
                          <div style={ruleBandRow}>
                            <span style={ruleBandChip}>
                              <BandGlyph band="RED" size={8} />
                              under {g.violationThresholdCm} cm
                            </span>
                            <span style={ruleBandChip}>
                              <BandGlyph band="YELLOW" size={8} />
                              {g.violationThresholdCm}–{g.warningThresholdCm} cm
                            </span>
                            <span style={ruleBandChip}>
                              <BandGlyph band="GREEN" size={8} />
                              {g.warningThresholdCm} cm and over
                            </span>
                          </div>
                          <span style={recRuleRef}>Rule {g.code}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}

                <p style={{ margin: '4px 0 0', fontSize: 11, color: t.inkMute, lineHeight: 1.5 }}>
                  Thresholds from Time-Saver Standards for Interior Design and Space Planning
                  (DeChiara, Panero &amp; Zelnik, 2001), Tables 3–4.
                </p>
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
  // Wider than the old 18%: the recommendation cards now carry a rule name, a
  // banded meter and an action, which crush below ~300px.
  flex: '0 1 340px',
  minWidth: 300,
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
  padding: '14px 16px',
  borderRadius: radius.md,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderLeft: '4px solid',
  cursor: 'pointer',
  transition: 'background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
};

const recHeaderRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
};

const recRuleTitle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: t.ink,
  lineHeight: 1.3,
};

const recRequirement: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  color: t.inkSoft,
  lineHeight: 1.45,
};

const recActionRow: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: t.surface,
  border: '1px solid',
  borderLeftWidth: 3,
};

const recRuleRef: CSSProperties = {
  display: 'block',
  marginTop: 10,
  fontSize: 10.5,
  fontWeight: 600,
  color: t.inkMute,
  letterSpacing: '0.03em',
};

const ruleRefCard: CSSProperties = {
  padding: '12px 14px',
  borderRadius: radius.sm,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
};

const ruleGroupHeading: CSSProperties = {
  margin: '10px 0 0',
  fontSize: 12,
  fontWeight: 800,
  color: t.inkMute,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const ruleBandRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px 10px',
  marginTop: 10,
  fontSize: 11,
  fontWeight: 600,
};

const ruleBandChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: t.inkSoft,
  whiteSpace: 'nowrap',
};

const legendRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 14px',
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: t.surface,
  border: `1px solid ${t.line}`,
  fontSize: 11,
  fontWeight: 700,
};

const legendItem: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  whiteSpace: 'nowrap',
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
