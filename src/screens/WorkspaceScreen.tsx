import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { runClearanceAnalysis } from '../engine/clearance';
import { stableViolationKey } from '../engine/violationKey';
import { statusMeta } from '../components/statusVocabulary';
import { color as t, radius } from '../components/designTokens';
import FloorPlan2D from '../components/FloorPlan2D';
import { isFeasible, snapCm, withMovedItem, withRotatedItem } from '../components/floorPlanDrag';
import type { FurnitureItem, Violation } from '../types';

// ─── Normalization ──────────────────────────────────────────────────────────
function normalizeFurniturePositions(
  items: FurnitureItem[],
  roomWidthCm: number,
  roomLengthCm: number,
): FurnitureItem[] {
  if (items.length === 0) return [];
  const rW = roomWidthCm / 100;
  const rL = roomLengthCm / 100;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const it of items) {
    const hL = (it.lengthCm / 100) / 2;
    const hW = (it.widthCm / 100) / 2;
    minX = Math.min(minX, it.posX - hL);
    maxX = Math.max(maxX, it.posX + hL);
    minZ = Math.min(minZ, it.posZ - hW);
    maxZ = Math.max(maxZ, it.posZ + hW);
  }

  const dx = (rW / 2) - (minX + maxX) / 2;
  const dz = (rL / 2) - (minZ + maxZ) / 2;
  const pad = 0.05;

  return items.map((it) => {
    const hL = (it.lengthCm / 100) / 2;
    const hW = (it.widthCm / 100) / 2;
    const x = Math.max(hL + pad, Math.min(rW - hL - pad, it.posX + dx));
    const z = Math.max(hW + pad, Math.min(rL - hW - pad, it.posZ + dz));
    return { ...it, posX: x, posZ: z };
  });
}

// ─── Ghost position helper ──────────────────────────────────────────────────
function getGhostItem(item: FurnitureItem, v: Violation | undefined): FurnitureItem | null {
  if (!v || v.resolved) return null;
  const dir = v.fixDirectionLabel.toLowerCase();
  const d = v.fixDirectionCm / 100;
  let dx = 0, dz = 0;
  if (dir.includes('west')) dx = -d;
  else if (dir.includes('east')) dx = d;
  else if (dir.includes('north')) dz = -d;
  else if (dir.includes('south')) dz = d;
  return { ...item, posX: item.posX + dx, posZ: item.posZ + dz };
}

// ─── Lookahead validation ───────────────────────────────────────────────────
function getLookaheadWarnings(
  items: FurnitureItem[],
  itemId: string,
  ghost: FurnitureItem,
  roomWidthCm: number,
  roomLengthCm: number,
): string[] {
  const candidate = withMovedItem(items, itemId, ghost.posX, ghost.posZ);
  if (!isFeasible(candidate, roomWidthCm, roomLengthCm)) return ['Overlaps other furniture or walls.'];

  const before = runClearanceAnalysis(items, roomWidthCm, roomLengthCm);
  const after = runClearanceAnalysis(candidate, roomWidthCm, roomLengthCm);
  const baseKeys = new Set(before.violations.map(stableViolationKey));
  const warnings: string[] = [];

  for (const v of after.violations) {
    if (!baseKeys.has(stableViolationKey(v))) {
      warnings.push(`New issue: ${v.ruleLabel} near ${v.furnitureLabel}`);
    }
  }
  return warnings;
}

// ─── Tab enum ───────────────────────────────────────────────────────────────
type Tab = 'plan' | 'issues' | 'checklist';

// ─── Main Component ─────────────────────────────────────────────────────────
export default function WorkspaceScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const updatePosition = useFurnitureStore((s) => s.updatePosition);
  const refreshViolations = useViolationStore((s) => s.refreshViolations);
  const setSpaceScoreBefore = useViolationStore((s) => s.setSpaceScoreBefore);
  const setSpaceScoreAfter = useViolationStore((s) => s.setSpaceScoreAfter);
  const recommendations = useViolationStore((s) => s.recommendations);

  const roomWidthCm = useMemo(() => {
    if (!roomDimensions) return 360;
    return Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm);
  }, [roomDimensions]);

  const roomLengthCm = useMemo(() => {
    if (!roomDimensions) return 520;
    return roomDimensions.livingDepthCm + roomDimensions.diningDepthCm;
  }, [roomDimensions]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [infeasible, setInfeasible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('plan');

  const [preview, setPreview] = useState<FurnitureItem[]>(items);
  const previewRef = useRef<FurnitureItem[]>(items);
  const lastOkRef = useRef<{ x: number; z: number } | null>(null);
  const okRef = useRef(true);

  // ── Normalize once on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (items.length > 0 && !loaded) {
      const outOfBounds = items.some((it) => {
        const hL = it.lengthCm / 200;
        const hW = it.widthCm / 200;
        return it.posX - hL < 0 || it.posZ - hW < 0
          || it.posX + hL > roomWidthCm / 100 || it.posZ + hW > roomLengthCm / 100;
      });
      if (outOfBounds) {
        const norm = normalizeFurniturePositions(items, roomWidthCm, roomLengthCm);
        norm.forEach((it) => updatePosition(it.id, it.posX, it.posZ, it.rotationY));
        setPreview(norm);
        previewRef.current = norm;
      } else {
        setPreview(items);
        previewRef.current = items;
      }
      setLoaded(true);
    }
  }, [items, roomWidthCm, roomLengthCm, updatePosition, loaded]);

  // ── Keep preview in sync with store ───────────────────────────────────────
  useEffect(() => {
    if (loaded) { setPreview(items); previewRef.current = items; }
  }, [items, loaded]);

  // ── Analysis ──────────────────────────────────────────────────────────────
  const analysis = useMemo(
    () => runClearanceAnalysis(items, roomWidthCm, roomLengthCm),
    [items, roomWidthCm, roomLengthCm],
  );

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

  useEffect(() => {
    if (selectedItem && selectedId !== selectedItem.id) setSelectedId(selectedItem.id);
  }, [selectedItem, selectedId]);

  const activeViolation = useMemo(() => {
    if (!selectedItem) return undefined;
    return analysis.violations.find((v) => v.furnitureId === selectedItem.id);
  }, [selectedItem, analysis.violations]);

  const ghostItem = useMemo(
    () => selectedItem ? getGhostItem(selectedItem, activeViolation) : null,
    [selectedItem, activeViolation],
  );

  const lookaheadWarnings = useMemo(() => {
    if (!selectedItem || !ghostItem) return [];
    return getLookaheadWarnings(preview, selectedItem.id, ghostItem, roomWidthCm, roomLengthCm);
  }, [selectedItem, ghostItem, preview, roomWidthCm, roomLengthCm]);

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

  const handleDragMove = useCallback((xm: number, zm: number) => {
    if (!selectedItem) return;
    const sx = snapCm(xm * 100) / 100;
    const sz = snapCm(zm * 100) / 100;
    const next = withMovedItem(preview, selectedItem.id, sx, sz);
    const ok = isFeasible(next, roomWidthCm, roomLengthCm);
    setPreview(next);
    previewRef.current = next;
    setInfeasible(!ok);
    okRef.current = ok;
    if (ok) lastOkRef.current = { x: sx, z: sz };
  }, [preview, selectedItem, roomWidthCm, roomLengthCm]);

  const handleDragEnd = useCallback(() => {
    if (!selectedItem) return;
    let settled = previewRef.current;

    // Snap back to last feasible if current is infeasible
    if (!okRef.current && lastOkRef.current) {
      settled = withMovedItem(settled, selectedItem.id, lastOkRef.current.x, lastOkRef.current.z);
      previewRef.current = settled;
      setPreview(settled);
      setInfeasible(false);
      okRef.current = true;
    }

    // Auto-snap within 5cm of ghost
    const fin = settled.find((it) => it.id === selectedItem.id);
    if (fin && ghostItem) {
      if (Math.abs(fin.posX - ghostItem.posX) <= 0.05 && Math.abs(fin.posZ - ghostItem.posZ) <= 0.05) {
        settled = withMovedItem(settled, selectedItem.id, ghostItem.posX, ghostItem.posZ);
        setPreview(settled);
        previewRef.current = settled;
      }
    }

    // Commit to store
    const s = settled.find((it) => it.id === selectedItem.id);
    if (s) {
      updatePosition(s.id, s.posX, s.posZ, s.rotationY);
      const fresh = runClearanceAnalysis(useFurnitureStore.getState().items, roomWidthCm, roomLengthCm);
      refreshViolations(fresh.violations);
      setSpaceScoreAfter(fresh.spaceScoreBefore);
    }
  }, [selectedItem, ghostItem, roomWidthCm, roomLengthCm, updatePosition, refreshViolations, setSpaceScoreAfter]);

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
    }
  }, [selectedItem, preview, roomWidthCm, roomLengthCm, updatePosition, refreshViolations, setSpaceScoreAfter]);

  // ── Render ────────────────────────────────────────────────────────────────
  const issueCount = analysis.violations.length;
  const redCount = analysis.violations.filter((v) => v.classification === 'RED').length;
  const yellowCount = analysis.violations.filter((v) => v.classification === 'YELLOW').length;
  const greenCount = preview.length - redCount - yellowCount;

  return (
    <div style={shell}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={header}>
        <button style={backBtn} onClick={() => navigateTo('positionMap')} aria-label="Go back">←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.ink }}>Layout Workspace</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.inkSoft }}>
            {issueCount === 0
              ? '✅ All clearances passed'
              : `${issueCount} clearance issue${issueCount > 1 ? 's' : ''} found`}
          </p>
        </div>
        <button style={finishBtn} onClick={() => navigateTo('report')}>Done</button>
      </header>

      {/* ── STATUS PILLS ───────────────────────────────────────────────────── */}
      <div style={pillRow}>
        {redCount > 0 && <span style={pill(t.attentionBg, t.attentionFg)}>{redCount} Critical</span>}
        {yellowCount > 0 && <span style={pill(t.tightBg, t.tightFg)}>{yellowCount} Tight</span>}
        <span style={pill(t.comfortBg, t.comfortFg)}>{greenCount} Good</span>
      </div>

      {/* ── INTERACTIVE FLOOR PLAN ─────────────────────────────────────────── */}
      <section style={planSection}>
        <FloorPlan2D
          items={preview}
          roomWidthCm={roomWidthCm}
          roomLengthCm={roomLengthCm}
          highlightItemId={selectedItem?.id}
          itemStatuses={itemStatuses}
          ghostItem={ghostItem}
          onSelectItem={setSelectedId}
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

        {/* Inline feedback */}
        <p style={feedbackText}>
          {infeasible
            ? <span style={{ color: t.attentionFg, fontWeight: 700 }}>❌ Can't place here — overlaps furniture or wall</span>
            : selectedItem
              ? <span>👆 Drag <strong>{selectedItem.label}</strong> to move it</span>
              : <span>👆 Tap a block to select it</span>
          }
        </p>

        {/* Action buttons */}
        <div style={actionRow}>
          <button style={actionBtn} onClick={handleRotate} disabled={!selectedItem}>
            🔄 Rotate 90°
          </button>
        </div>
      </section>

      {/* ── BOTTOM DRAWER ──────────────────────────────────────────────────── */}
      <section style={drawer}>
        {/* Tab bar */}
        <div style={tabBar}>
          {(['plan', 'issues', 'checklist'] as Tab[]).map((tab) => (
            <button
              key={tab}
              style={tabBtn(activeTab === tab)}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'plan' ? `📋 Items (${preview.length})`
                : tab === 'issues' ? `⚠️ Issues (${issueCount})`
                : '✅ Checklist'}
            </button>
          ))}
        </div>

        <div style={tabContent}>
          {/* TAB: Items list */}
          {activeTab === 'plan' && (
            <div style={scrollList}>
              {preview.map((item) => {
                const status = itemStatuses[item.id] ?? 'GREEN';
                const sel = selectedItem?.id === item.id;
                const meta = statusMeta(
                  status === 'RED' ? 'needs-attention'
                    : status === 'YELLOW' ? 'tight'
                    : 'comfortable',
                );
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    style={{
                      ...listItem(sel),
                      borderLeftColor: meta.color,
                    }}
                  >
                    <span style={{ fontWeight: 600, color: sel ? t.brand : t.ink, fontSize: 14 }}>
                      {item.label}
                    </span>
                    <span style={{ ...badge, background: meta.bg, color: meta.color }}>
                      {status === 'RED' ? 'Needs Attention'
                        : status === 'YELLOW' ? 'Tight'
                        : 'Good'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: Violation details */}
          {activeTab === 'issues' && (
            <div style={scrollList}>
              {issueCount === 0 ? (
                <p style={{ textAlign: 'center', color: t.comfortFg, fontWeight: 600, padding: 24 }}>
                  🎉 No clearance issues — great layout!
                </p>
              ) : (
                analysis.violations.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      ...violationCard,
                      borderLeftColor: v.classification === 'RED' ? t.attentionFg : t.tightFg,
                    }}
                    onClick={() => setSelectedId(v.furnitureId)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: t.ink, fontSize: 14 }}>{v.furnitureLabel}</span>
                      <span style={{
                        ...badge,
                        background: v.classification === 'RED' ? t.attentionBg : t.tightBg,
                        color: v.classification === 'RED' ? t.attentionFg : t.tightFg,
                      }}>
                        {v.ruleCode}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: t.inkSoft }}>{v.ruleLabel}</p>
                    <div style={metricsRow}>
                      <span>Gap: <strong>{v.measuredCm}cm</strong></span>
                      <span>Need: <strong>{v.requiredCm}cm</strong></span>
                      <span style={{ color: t.attentionFg }}>Short: <strong>{v.shortfallCm}cm</strong></span>
                    </div>
                  </div>
                ))
              )}

              {/* Lookahead validation for selected item */}
              {selectedItem && ghostItem && (
                <div style={lookaheadCard(lookaheadWarnings.length > 0)}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: t.brand, marginBottom: 4 }}>
                    RECOMMENDATION VALIDATION
                  </p>
                  {lookaheadWarnings.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: t.comfortFg, fontWeight: 600 }}>
                      ✅ Suggested move is safe — no new issues created
                    </p>
                  ) : (
                    <>
                      <p style={{ margin: '0 0 4px', fontSize: 13, color: t.attentionFg, fontWeight: 600 }}>
                        ⚠️ Suggested move creates new issues:
                      </p>
                      {lookaheadWarnings.map((w, i) => (
                        <p key={i} style={{ margin: '2px 0', fontSize: 12, color: t.attentionFg }}>• {w}</p>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: Room quality checklist */}
          {activeTab === 'checklist' && (
            <div style={scrollList}>
              {[
                { label: '🚶 Walking Paths', codes: ['L1', 'L3', 'L4'] },
                { label: '🏢 Wall Clearance', codes: ['D1', 'D2', 'D3'] },
                { label: '🍽️ Dining Space', codes: ['D4', 'D5'] },
                { label: '📺 TV Distance', codes: ['L2', 'L5'] },
              ].map(({ label, codes }) => {
                const hasIssue = analysis.violations.some((v) => codes.includes(v.ruleCode));
                return (
                  <div key={label} style={checkRow}>
                    <span style={{ fontSize: 14, color: t.ink }}>{label}</span>
                    <span style={{
                      ...badge,
                      background: hasIssue ? t.tightBg : t.comfortBg,
                      color: hasIssue ? t.tightFg : t.comfortFg,
                    }}>
                      {hasIssue ? 'Needs Work' : 'Good'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── STYLES — MOBILE-FIRST ──────────────────────────────────────────────────

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100dvh',
  width: '100%',
  background: t.ground,
  fontFamily: "'Inter', system-ui, sans-serif",
  overflow: 'hidden',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  background: t.surface,
  borderBottom: `1px solid ${t.line}`,
  flexShrink: 0,
};

const backBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: t.brand,
  fontSize: 18,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '4px 8px',
  minWidth: 36,
  minHeight: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const finishBtn: CSSProperties = {
  background: t.brand,
  color: '#fff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: radius.sm,
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const pillRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '8px 16px',
  background: t.surface,
  flexShrink: 0,
  overflowX: 'auto',
};

const pill = (bg: string, fg: string): CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 20,
  background: bg,
  color: fg,
  whiteSpace: 'nowrap',
});

const planSection: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px 0',
  overflow: 'hidden',
};

const feedbackText: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  color: t.inkSoft,
  textAlign: 'center',
};

const actionRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '8px 0 4px',
};

const actionBtn: CSSProperties = {
  background: t.surface,
  border: `1px solid ${t.line}`,
  color: t.brand,
  padding: '8px 16px',
  borderRadius: radius.sm,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};

const drawer: CSSProperties = {
  background: t.surface,
  borderTop: `1px solid ${t.line}`,
  borderRadius: '16px 16px 0 0',
  boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '40vh',
  flexShrink: 0,
};

const tabBar: CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${t.line}`,
  flexShrink: 0,
};

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '10px 0',
  border: 'none',
  background: 'none',
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 12,
  fontWeight: 700,
  color: active ? t.brand : t.inkMute,
  borderBottom: active ? `2px solid ${t.brand}` : '2px solid transparent',
  cursor: 'pointer',
});

const tabContent: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};

const scrollList: CSSProperties = {
  overflowY: 'auto',
  padding: '8px 16px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 'calc(40vh - 48px)',
};

const listItem = (sel: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: sel ? t.brandTint : t.ground,
  border: `1px solid ${sel ? t.brand : t.line}`,
  borderLeft: '4px solid',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const badge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 20,
};

const violationCard: CSSProperties = {
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: t.ground,
  border: `1px solid ${t.line}`,
  borderLeft: '4px solid',
  cursor: 'pointer',
};

const metricsRow: CSSProperties = {
  display: 'flex',
  gap: 16,
  marginTop: 6,
  fontSize: 12,
  color: t.inkSoft,
};

const checkRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: t.ground,
  border: `1px solid ${t.line}`,
};

const lookaheadCard = (warn: boolean): CSSProperties => ({
  marginTop: 4,
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: warn ? t.attentionBg : t.comfortBg,
  border: `1px solid ${warn ? t.attentionFg : t.comfortFg}`,
});
