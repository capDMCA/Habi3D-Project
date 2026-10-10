import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import CondoFloorPlan, { type FocusTarget } from '../components/CondoFloorPlan';
import WorkspaceHeader from '../components/WorkspaceHeader';
import RecommendationSheet from '../components/RecommendationSheet';
import RecommendationCard from '../components/RecommendationCard';
import RecommendationPanel from '../components/RecommendationPanel';
import MobileWorkspaceHub from '../components/MobileWorkspaceHub';
import { useWorkspaceScroll } from '../hooks/useWorkspaceScroll';
import { color as t, radius, fontFamily } from '../components/tokens';
import { runClearanceAnalysis } from '../engine/clearance';
import { buildWorkspaceRecommendations, type WorkspaceRecommendation } from '../engine/recommendations';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { useAutosaveLayout } from '../stores/useAutosaveLayout';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';
import {
  canPlace,
  clampToUnit,
  overlappingItemIds,
  packItemsIntoRoom,
  roomIdForItem,
  withMovedItem,
} from '../components/floorPlanDrag';
import { computeWalkways, isItemInMainWalkway } from '../engine/walkways';
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

    // Already placed sensibly in its assigned room and not sitting on top of something else.
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
type PanelTab = 'recommendations' | 'items' | 'rules';

export default function WorkspaceScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const previousScreen = useSessionStore((s) => s.previousScreen);
  const setActivePlacementItemId = useSessionStore((s) => s.setActivePlacementItemId);
  const items = useFurnitureStore((s) => s.items);
  const updateItem = useFurnitureStore((s) => s.updateItem);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);
  const removeItem = useFurnitureStore((s) => s.removeItem);
  const setItems = useFurnitureStore((s) => s.setItems);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const setSpaceScoreBefore = useViolationStore((s) => s.setSpaceScoreBefore);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);
  const recommendations = useViolationStore((s) => s.recommendations);
  const captureInitialFindings = useViolationStore((s) => s.captureInitialFindings);
  const markItemTouched = useViolationStore((s) => s.markItemTouched);

  useAutosaveLayout(items);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Internal one-shot bookkeeping only — never read by JSX (confirmed via
  // grep) — so a ref, not state: flipping it shouldn't itself force a
  // render, only the store writes it gates should.
  const loadedRef = useRef(false);
  const [infeasible, setInfeasible] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('recommendations');
  const [recSheetOpen, setRecSheetOpen] = useState(false);
  const [activeRec, setActiveRec] = useState<WorkspaceRecommendation | null>(null);
  const [isRecResolved, setIsRecResolved] = useState(false);
  const resolveTimeoutRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { isScrolled } = useWorkspaceScroll({ threshold: 100, containerRef: scrollContainerRef });

  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);

  // Room Zoom Focus State
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);

  const [preview, setPreview] = useState<FurnitureItem[]>(items);
  const previewRef = useRef<FurnitureItem[]>(items);
  const lastOkRef = useRef<{ x: number; z: number } | null>(null);
  const okRef = useRef(true);
  // Layout snapshots taken before each committed change, for undo.
  const historyRef = useRef<FurnitureItem[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Width/height from store/constants
  const roomWidthCm = 510;
  const roomLengthCm = 880;

  // ── Normalize & Assign rooms once on mount ────────────────────────────────
  // Pure external-system sync (writes to furnitureStore) gated by a ref, not
  // state — no component state setter runs in here at all, so there's
  // nothing for this effect to cascade.
  useEffect(() => {
    if (items.length > 0 && !loadedRef.current) {
      // The 3D preview is read-only, so returning from it must preserve the store verbatim.
      if (previousScreen === 'threeDPreview') {
        loadedRef.current = true;
        return;
      }

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

      // Not seeding `preview` here — the store writes above flip `items`,
      // and the render-time sync just below picks it up on the next render.
      loadedRef.current = true;
    }
  }, [items, previousScreen, updateItem, updatePosition]);

  // ── Keep preview in sync with store ───────────────────────────────────────
  // Adjusted during render rather than in a follow-up effect — this is
  // React's documented pattern for state that mirrors another value
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes):
  // calling the setter here, guarded by an identity check against the last
  // seen `items`, applies before the screen paints instead of costing an
  // extra commit. Interactive paths (drag, undo, rotate, reset) already set
  // `preview` directly inside their own handlers — this is the catch-all
  // for any other path that changes the store's `items`. `items !== prevItems`
  // is already false until the mount-normalization effect above has run at
  // least once, so no separate `loaded` gate is needed here.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setPreview(items);
  }

  // Refs may only be mutated in an effect or event handler, never at render
  // time — so `previewRef` (read imperatively by drag/undo/rotate handlers)
  // is kept in sync here rather than alongside the `setPreview` call above.
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

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

  const recommendationList = useMemo(
    () => buildWorkspaceRecommendations(analysis.violations, preview, walkwayStatuses),
    [analysis.violations, preview, walkwayStatuses],
  );

  const handleSelectRecommendation = useCallback((rec: WorkspaceRecommendation) => {
    setActiveRec(rec);
    setSelectedId(rec.furnitureId);
    setIsRecResolved(false);
    setRecSheetOpen(false);
    if (resolveTimeoutRef.current) {
      window.clearTimeout(resolveTimeoutRef.current);
      resolveTimeoutRef.current = null;
    }
  }, []);

  const handleClearActiveRec = useCallback(() => {
    setActiveRec(null);
    setIsRecResolved(false);
    if (resolveTimeoutRef.current) {
      window.clearTimeout(resolveTimeoutRef.current);
      resolveTimeoutRef.current = null;
    }
  }, []);

  const focusTarget: FocusTarget | null = useMemo(() => {
    if (!activeRec) return null;
    return {
      itemId: activeRec.furnitureId,
      wallSide: activeRec.wallSide,
      fixDirectionLabel: activeRec.fixDirectionLabel,
      fixDirectionCm: activeRec.fixDirectionCm,
      itemBId: activeRec.itemBId,
      actionText: activeRec.actionText,
    };
  }, [activeRec]);

  useEffect(() => {
    if (analysis.violations.length > 0 && recommendations.length === 0) {
      refreshViolations(analysis.violations);
      setSpaceScoreBefore(analysis.spaceScoreBefore);
    }
  }, [analysis, refreshViolations, recommendations.length, setSpaceScoreBefore]);

  // Session-start snapshot for ReportScreen's "you made N spots more
  // comfortable" headline. Deliberately NOT gated on violations.length > 0
  // like the effect above — a session that starts fully comfortable still
  // needs a real (empty) snapshot captured, so a violation introduced later
  // reads as a genuine change rather than defaulting to "nothing to compare
  // against." captureInitialFindings is itself idempotent (no-ops after the
  // first call), so calling it on every analysis recompute is safe — it
  // only ever actually captures once, whichever call happens first.
  useEffect(() => {
    captureInitialFindings(analysis.violations);
  }, [analysis, captureInitialFindings]);

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

  const handleLaunchAR = useCallback(
    (item?: FurnitureItem) => {
      const target = item || selectedItem || preview[0];
      if (target) {
        setActivePlacementItemId(target.id);
      }
      navigateTo('positionMap');
    },
    [selectedItem, preview, setActivePlacementItemId, navigateTo],
  );

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
      updateItem(changed.id, { ...changed });
      updatePosition(changed.id, changed.posX, changed.posZ, changed.rotationY);
      markItemTouched(changed.id);

      const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
      refreshViolations(fresh.violations);
      setSpaceScoreAfter(fresh.spaceScoreBefore);

      // Check if current active recommendation was resolved
      if (activeRec && activeRec.furnitureId === changed.id) {
        const stillViolated = fresh.violations.some((v) =>
          v.furnitureId === changed.id &&
          (activeRec.ruleCode ? v.ruleCode === activeRec.ruleCode : true),
        );
        if (!stillViolated) {
          setIsRecResolved(true);
          if (resolveTimeoutRef.current) window.clearTimeout(resolveTimeoutRef.current);
          resolveTimeoutRef.current = window.setTimeout(() => {
            setActiveRec(null);
            setIsRecResolved(false);
          }, 1500);
        }
      }
    },
    [roomWidthCm, roomLengthCm, updateItem, updatePosition, markItemTouched, refreshViolations, setSpaceScoreAfter, activeRec],
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback((id: string) => {
    const it = previewRef.current.find((p) => p.id === id);
    if (!it) return;
    // Remember where it came from, so an impossible drop can fall back to a
    // spot the user actually dragged through rather than the origin.
    historyRef.current.push(previewRef.current);
    if (historyRef.current.length > 50) historyRef.current.shift();
    setCanUndo(true);
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
        const valid = canPlace(moved, next);
        okRef.current = valid;
        setInfeasible(!valid);
        if (valid) lastOkRef.current = { x: xm, z: zm };
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

      const newRoomId = roomIdForItem(item);
      const room = CONDO_ROOMS.find((r) => r.id === newRoomId);
      if (!room) {
        const fallback = lastOkRef.current;
        if (fallback) {
          const reverted = withMovedItem(settled, draggedId, fallback.x, fallback.z);
          const revertedItem = reverted.find((it) => it.id === draggedId)!;
          const rehomed = { ...revertedItem, roomId: roomIdForItem(revertedItem) };
          commitLayout(
            reverted.map((it) => (it.id === draggedId ? rehomed : it)),
            rehomed,
          );
          showToast(`⚠️ Furniture must be placed within the condo unit.`);
          return;
        }
      }

      const rehomed = { ...item, roomId: newRoomId };
      const layout = settled.map((it) => (it.id === draggedId ? rehomed : it));

      const isOverlapping = overlappingItemIds(rehomed, layout).length > 0;
      if (isOverlapping) {
        showToast(`⚠️ Notice: Furniture pieces are overlapping.`);
      } else if (isItemInMainWalkway(rehomed)) {
        showToast(`⚠️ Notice: ${item.label} is placed on the main walkway corridor.`);
      } else if (newRoomId !== (item.roomId ?? null)) {
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

      if (moved.posX === current.posX && moved.posZ === current.posZ) {
        showToast(`${current.label} has reached the unit boundary.`);
        return;
      }

      const movedRoomId = roomIdForItem(moved);
      const room = CONDO_ROOMS.find((r) => r.id === movedRoomId);
      if (!room) {
        showToast(`⚠️ Furniture must remain inside the condo unit.`);
        return;
      }

      const otherItems = previewRef.current.filter((it) => it.id !== moved.id);
      const isOverlapping = overlappingItemIds(moved, otherItems).length > 0;
      if (isOverlapping) {
        showToast(`⚠️ Notice: Furniture pieces are overlapping.`);
      }

      historyRef.current.push(previewRef.current);
      if (historyRef.current.length > 50) historyRef.current.shift();
      setCanUndo(true);

      const rehomed: FurnitureItem = {
        ...current,
        posX: moved.posX,
        posZ: moved.posZ,
        roomId: roomIdForItem(moved),
      };
      commitLayout(
        previewRef.current.map((it) => (it.id === rehomed.id ? rehomed : it)),
        rehomed,
      );
    },
    [selectedId, commitLayout, showToast],
  );

  const handleRotate = useCallback(() => {
    if (!selectedItem) return;
    // A circle's bounding box (and clearance footprint) is identical at
    // every angle — spinning it changes nothing visible or measurable, so
    // rotation is a no-op rather than a control that pretends to do something.
    if (selectedItem.shape === 'round') return;
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
    setCanUndo(true);

    const rehomed = { ...candidate, roomId: roomIdForItem(candidate) };
    const nextLayout = preview.map((it) => (it.id === rehomed.id ? rehomed : it));

    const isOverlapping = overlappingItemIds(rehomed, nextLayout).length > 0;
    if (isOverlapping) {
      showToast(`⚠️ Notice: Furniture pieces are overlapping.`);
    }

    commitLayout(nextLayout, rehomed);
  }, [selectedItem, preview, commitLayout, showToast]);

  const handleUndo = useCallback(() => {
    const previous = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    if (!previous) {
      showToast('Nothing to undo.');
      return;
    }
    setItems(previous);
    previewRef.current = previous;
    setPreview(previous);
    previous.forEach((it) => {
      updateItem(it.id, { ...it });
      updatePosition(it.id, it.posX, it.posZ, it.rotationY);
    });
    const fresh = runClearanceAnalysis(previous, roomWidthCm, roomLengthCm);
    refreshViolations(fresh.violations);
    setSpaceScoreAfter(fresh.spaceScoreBefore);
    showToast('Action undone.');
  }, [setItems, updateItem, updatePosition, roomWidthCm, roomLengthCm, refreshViolations, setSpaceScoreAfter, showToast]);

  const handleDelete = useCallback(() => {
    if (!selectedItem) return;
    historyRef.current.push(previewRef.current);
    if (historyRef.current.length > 50) historyRef.current.shift();
    setCanUndo(true);
    const remaining = previewRef.current.filter((it) => it.id !== selectedItem.id);
    removeItem(selectedItem.id);
    previewRef.current = remaining;
    setPreview(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    const fresh = runClearanceAnalysis(remaining, roomWidthCm, roomLengthCm);
    refreshViolations(fresh.violations);
    setSpaceScoreAfter(fresh.spaceScoreBefore);
    showToast(`${selectedItem.label} deleted.`);
  }, [selectedItem, removeItem, roomWidthCm, roomLengthCm, refreshViolations, setSpaceScoreAfter, showToast]);


  // ── Keyboard: arrow nudge, R rotate, Ctrl/Cmd+Z undo ──────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (deleteConfirmationOpen) return;

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
  }, [deleteConfirmationOpen, selectedId, nudgeSelected, handleRotate, handleUndo]);

  useEffect(() => {
    if (!deleteConfirmationOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDeleteConfirmationOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [deleteConfirmationOpen]);

  const focusedRoom = useMemo(() => {
    if (!focusedRoomId) return null;
    return CONDO_ROOMS.find((r) => r.id === focusedRoomId) ?? null;
  }, [focusedRoomId]);

  return (
    <div className="wksp-shell" style={shell}>
      {/* ── RESPONSIVE SCROLL-AWARE WORKSPACE HEADER ────────────────────── */}
      <WorkspaceHeader
        isScrolled={isScrolled}
        focusedRoom={focusedRoom}
        onClearFocusedRoom={() => setFocusedRoomId(null)}
        onBack={() => navigateTo('positionMap')}
        onLaunchAR={() => handleLaunchAR()}
        onOpen3DView={() => navigateTo('threeDPreview')}
        onDone={() => navigateTo('report')}
      />

      {/* ── SPLIT WORKSPACE ────────────────────────────────────────────────── */}
      <div style={workspaceLayout} ref={scrollContainerRef}>
        {/* LEFT COLUMN: INTERACTIVE DIGITAL TWIN FLOOR PLAN (HERO VISUAL FOCUS) */}
        <section style={planPanel}>
          <div style={planContainer}>
            <CondoFloorPlan
              items={preview}
              highlightItemId={activeRec?.furnitureId ?? selectedItem?.id}
              itemStatuses={itemStatuses}
              onSelectItem={handleSelectItem}
              focusedRoomId={focusedRoomId}
              onFocusRoom={setFocusedRoomId}
              focusTarget={focusTarget}
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

            {/* Contextual Recommendation Card attached near focused problem area */}
            {activeRec && (
              <RecommendationCard
                recommendation={activeRec}
                isResolved={isRecResolved}
                onDone={handleClearActiveRec}
              />
            )}

            {/* Mobile Actionable Hub Bar (Improvements, Placed Items, Standards & Rules) */}
            <MobileWorkspaceHub
              recommendationCount={recommendationList.length}
              itemCount={preview.length}
              activeTab={panelTab}
              isSheetOpen={recSheetOpen}
              onOpenTab={(tab) => {
                setPanelTab(tab);
                setRecSheetOpen(true);
              }}
            />
          </div>

          {/* Toast Warning */}
          {toast && <div style={toastBanner}>{toast}</div>}

          {/* Item toolbar row directly under the plan — status caption on
              the left, responsive text action buttons on the right. */}
          <div style={planToolbar}>
            <span style={planCaption}>
              {infeasible ? (
                <span style={{ color: t.ink, fontWeight: 700 }}>
                  Overlapping — release to snap back
                </span>
              ) : selectedItem ? (
                `${selectedItem.label} · ${selectedRoomLabel}`
              ) : (
                'Tap a piece to select it'
              )}
            </span>
            <div style={toolbarTextRow}>
              {/* Quick Mobile Access to Insights / Sheet */}
              <button
                className="wksp-text-btn wksp-mobile-toolbar-btn"
                style={textToolbarBtn(false)}
                onClick={() => {
                  setPanelTab('recommendations');
                  setRecSheetOpen(true);
                }}
                aria-label="View actionable improvements, items, and rules"
                title="View actionable improvements, items, and rules"
              >
                💡 {recommendationList.length > 0 ? `${recommendationList.length} Fixes` : 'All Clear'}
              </button>
              <button
                className="wksp-text-btn"
                style={textToolbarBtn(!selectedItem)}
                onClick={() => handleLaunchAR(selectedItem ?? undefined)}
                disabled={!selectedItem}
                aria-label="Adjust in AR"
                title="Adjust this item in AR"
              >
                📷 AR Mode
              </button>
              {selectedItem?.shape !== 'round' && (
                <button
                  className="wksp-text-btn"
                  style={textToolbarBtn(!selectedItem)}
                  onClick={handleRotate}
                  disabled={!selectedItem}
                  aria-label="Rotate 90 degrees"
                  title="Rotate 90° (R)"
                >
                  Rotate
                </button>
              )}
              <button
                className="wksp-text-btn"
                style={textToolbarBtn(!canUndo)}
                onClick={handleUndo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (Ctrl/Cmd+Z)"
              >
                Undo
              </button>
              <button
                className="wksp-text-btn wksp-text-btn-danger"
                style={textToolbarBtn(!selectedItem, 'danger')}
                onClick={() => setDeleteConfirmationOpen(true)}
                disabled={!selectedItem}
                aria-label="Delete item"
                title="Delete item"
              >
                Delete
              </button>
            </div>
          </div>
        </section>

        {/* DESKTOP/TABLET RIGHT COLUMN: RECOMMENDATIONS & DETAIL PANEL */}
        <div className="wksp-desktop-panel" style={{ height: '100%', flexShrink: 0 }}>
          <RecommendationPanel
            recommendations={recommendationList}
            activeTab={panelTab}
            onTabChange={setPanelTab}
            selectedId={activeRec?.furnitureId ?? selectedId}
            onSelectRecommendation={handleSelectRecommendation}
            items={preview}
            itemStatuses={itemStatuses}
            onSelectItem={handleSelectItem}
            onLaunchAR={handleLaunchAR}
          />
        </div>
      </div>

      {/* Mobile Recommendations, Items & Rules Bottom Sheet */}
      <RecommendationSheet
        isOpen={recSheetOpen}
        onClose={() => setRecSheetOpen(false)}
        activeTab={panelTab}
        onTabChange={setPanelTab}
        recommendations={recommendationList}
        selectedId={activeRec?.furnitureId ?? selectedId}
        onSelectRecommendation={handleSelectRecommendation}
        items={preview}
        itemStatuses={itemStatuses}
        onSelectItem={(id) => {
          handleSelectItem(id);
          setRecSheetOpen(false);
        }}
        onLaunchAR={(item) => {
          setRecSheetOpen(false);
          handleLaunchAR(item);
        }}
      />

      {deleteConfirmationOpen && selectedItem && (
        <div
          style={deleteDialogBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteConfirmationOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-furniture-title"
            aria-describedby="delete-furniture-message"
            style={deleteDialog}
          >
            <h2 id="delete-furniture-title" style={deleteDialogTitle}>Delete Furniture?</h2>
            <p id="delete-furniture-message" style={deleteDialogMessage}>
              Are you sure you want to delete this furniture item? This action can be undone using the Undo button.
            </p>
            <div style={deleteDialogActions}>
              <button
                type="button"
                className="wksp-outline-btn"
                style={deleteDialogCancelBtn}
                onClick={() => setDeleteConfirmationOpen(false)}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="wksp-text-btn wksp-text-btn-danger"
                style={deleteDialogDeleteBtn}
                onClick={() => {
                  setDeleteConfirmationOpen(false);
                  handleDelete();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STYLES — DIGITAL TWIN RESPONSIVE ───────────────────────────────────────

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  width: '100%',
  background: t.ground,
  fontFamily,
  overflow: 'hidden',
};

const workspaceLayout: CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'row',
  height: 'calc(100vh - 56px)',
  overflow: 'hidden',
  position: 'relative',
};

const planPanel: CSSProperties = {
  flex: '1 1 0%',
  display: 'flex',
  flexDirection: 'column',
  padding: '8px 12px 12px',
  overflow: 'hidden',
  height: '100%',
  position: 'relative',
  minWidth: 0,
};

const planContainer: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 0,
  position: 'relative',
};

// One slim row directly under the plan — caption on the left, text buttons on the right.
const planToolbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 10,
  paddingTop: 10,
  borderTop: `1px solid ${t.line}`,
  flexShrink: 0,
  flexWrap: 'wrap',
};

const toolbarTextRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const textToolbarBtn = (disabled: boolean, variant: 'default' | 'danger' = 'default'): CSSProperties => ({
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 8,
  border: `1px solid ${variant === 'danger' ? 'rgba(239, 68, 68, 0.4)' : t.line}`,
  background: variant === 'danger' ? 'rgba(239, 68, 68, 0.08)' : t.ground,
  color: disabled ? t.inkMute : variant === 'danger' ? '#dc2626' : t.ink,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  whiteSpace: 'nowrap',
  transition: 'all 0.15s ease',
});

const planCaption: CSSProperties = {
  fontSize: 13,
  color: t.inkSoft,
  fontWeight: 500,
  flex: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const toastBanner: CSSProperties = {
  position: 'absolute',
  top: 50,
  left: '50%',
  transform: 'translateX(-50%)',
  // Neutral now, not attention-red — this banner is reused for plain
  // confirmations too ("Sofa moved to Living Room"), not only warnings, so
  // a severity hue here was already miscalibrated even before this pass.
  background: t.ink,
  color: t.surface,
  padding: '10px 20px',
  borderRadius: '20px',
  fontSize: 14,
  fontWeight: 700,
  boxShadow: '0 4px 15px rgba(22, 32, 58, 0.25)',
  animation: 'fadeIn 0.2s ease',
  pointerEvents: 'none',
  zIndex: 10,
};

const deleteDialogBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
  background: 'rgba(22, 32, 58, 0.48)',
};

const deleteDialog: CSSProperties = {
  width: 'min(380px, calc(100vw - 32px))',
  boxSizing: 'border-box',
  padding: 20,
  borderRadius: radius.sm,
  border: `1px solid ${t.line}`,
  background: t.surface,
  boxShadow: '0 18px 48px rgba(22, 32, 58, 0.28)',
};

const deleteDialogTitle: CSSProperties = {
  margin: 0,
  color: t.ink,
  fontSize: 19,
  fontWeight: 800,
};

const deleteDialogMessage: CSSProperties = {
  margin: '10px 0 20px',
  color: t.inkSoft,
  fontSize: 14,
  lineHeight: 1.55,
};

const deleteDialogActions: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
};

const deleteDialogCancelBtn: CSSProperties = {
  minWidth: 88,
  minHeight: 44,
  padding: '0 16px',
  borderRadius: radius.sm,
  border: `1px solid ${t.line}`,
  background: t.surface,
  color: t.ink,
  fontWeight: 700,
  cursor: 'pointer',
};

const deleteDialogDeleteBtn: CSSProperties = {
  minWidth: 88,
  minHeight: 44,
  padding: '0 16px',
  borderRadius: radius.sm,
  border: '1px solid rgba(220, 38, 38, 0.45)',
  background: '#DC2626',
  color: '#FFFFFF',
  fontWeight: 700,
  cursor: 'pointer',
};

