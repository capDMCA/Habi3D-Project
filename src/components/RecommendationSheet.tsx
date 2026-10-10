import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { WorkspaceRecommendation } from '../engine/recommendations';
import type { FurnitureItem } from '../types';
import { color as t, radius } from './tokens';
import { ALL_RULE_GUIDANCE } from '../engine/ruleGuidance';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';

export type PanelTab = 'recommendations' | 'items' | 'rules';

interface RecommendationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab?: PanelTab;
  onTabChange?: (tab: PanelTab) => void;
  recommendations: WorkspaceRecommendation[];
  selectedId: string | null;
  onSelectRecommendation: (rec: WorkspaceRecommendation) => void;
  items?: FurnitureItem[];
  itemStatuses?: Record<string, 'RED' | 'YELLOW' | 'GREEN'>;
  onSelectItem?: (id: string) => void;
  onLaunchAR?: (item?: FurnitureItem) => void;
}

export default function RecommendationSheet({
  isOpen,
  onClose,
  activeTab = 'recommendations',
  onTabChange,
  recommendations,
  selectedId,
  onSelectRecommendation,
  items = [],
  itemStatuses = {},
  onSelectItem,
  onLaunchAR,
}: RecommendationSheetProps) {
  const [internalTab, setInternalTab] = useState<PanelTab>('recommendations');
  const currentTab = activeTab ?? internalTab;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const count = recommendations.length;
  const itemCount = items.length;

  const handleTabSelect = (tab: PanelTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div
      className="wksp-sheet-backdrop"
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="wksp-sheet-content"
        style={sheetContainerStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-sheet-title"
      >
        {/* Drag handle */}
        <div style={handleBarWrap} onClick={onClose} title="Close sheet">
          <div style={handleBar} />
        </div>

        {/* Top Header */}
        <div style={sheetHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 id="rec-sheet-title" style={sheetTitle}>
              {currentTab === 'recommendations'
                ? 'Actionable Improvements'
                : currentTab === 'items'
                ? 'Placed Furniture'
                : 'Design Standards'}
            </h2>
            <span style={countBadge(currentTab === 'recommendations' ? count > 0 : true)}>
              {currentTab === 'recommendations'
                ? count > 0
                  ? `${count} to review`
                  : '✓ All Clear'
                : currentTab === 'items'
                ? `${itemCount} pieces`
                : '12 rules'}
            </span>
          </div>

          <button
            type="button"
            style={closeBtn}
            onClick={onClose}
            aria-label="Close sheet"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Mobile Tab Switcher Bar */}
        <div style={tabSwitcherBar} role="tablist" aria-label="Layout information tabs">
          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'recommendations'}
            style={tabBtnStyle(currentTab === 'recommendations')}
            onClick={() => handleTabSelect('recommendations')}
          >
            <span style={{ fontSize: 14 }}>💡</span>
            <span>Improvements</span>
            <span style={tabCounterBadge(count > 0, currentTab === 'recommendations')}>
              {count > 0 ? count : '✓'}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'items'}
            style={tabBtnStyle(currentTab === 'items')}
            onClick={() => handleTabSelect('items')}
          >
            <span style={{ fontSize: 14 }}>🛋️</span>
            <span>Items</span>
            <span style={tabCounterBadge(false, currentTab === 'items')}>
              {itemCount}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={currentTab === 'rules'}
            style={tabBtnStyle(currentTab === 'rules')}
            onClick={() => handleTabSelect('rules')}
          >
            <span style={{ fontSize: 14 }}>📐</span>
            <span>Rules</span>
            <span style={tabCounterBadge(false, currentTab === 'rules')}>
              12
            </span>
          </button>
        </div>

        {/* Sheet Body Content */}
        <div style={sheetBody}>
          {/* ── TAB 1: RECOMMENDATIONS / ACTIONABLE IMPROVEMENTS ── */}
          {currentTab === 'recommendations' && (
            <div>
              {count === 0 ? (
                <div style={emptyStateWrap}>
                  <div style={emptyIcon}>✓</div>
                  <div style={emptyTitle}>Layout Looks Great</div>
                  <p style={emptyDesc}>
                    Every piece has comfortable clearance and trafficways are clear.
                  </p>
                </div>
              ) : (
                <div style={cardListWrap}>
                  <div style={tabSubtitleRow}>
                    <span style={sectionTag}>Ergonomic Clearance Guidance</span>
                    <span style={{ fontSize: 12, color: t.inkSoft }}>
                      Tap any card to focus and adjust on floor plan
                    </span>
                  </div>

                  {recommendations.map((rec) => {
                    const isSelected = selectedId === rec.furnitureId;
                    const isRed = rec.severity === 'RED';
                    const accentColor = isRed ? t.attentionFg : t.tightFg;

                    return (
                      <div
                        key={rec.id}
                        className="wksp-sheet-card"
                        style={{
                          ...cardStyle,
                          borderLeftColor: accentColor,
                          background: isSelected ? '#F8FAFC' : '#ffffff',
                        }}
                        onClick={() => {
                          onSelectRecommendation(rec);
                          onClose();
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectRecommendation(rec);
                            onClose();
                          }
                        }}
                      >
                        <div style={cardContentWrap}>
                          <div style={cardTopRow}>
                            <span style={cardItemLabel}>{rec.furnitureLabel}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  ...severityDot,
                                  background: accentColor,
                                }}
                                title={isRed ? 'High priority' : 'Moderate priority'}
                              />
                              <span style={cardChevron}>›</span>
                            </div>
                          </div>

                          <div style={cardActionText}>{rec.actionText}</div>

                          <div style={cardMetaRow}>
                            <span style={cardRoomBadge}>{rec.roomLabel}</span>
                            {rec.fixDirectionLabel && (
                              <span style={cardDirectionBadge}>
                                Shift {rec.fixDirectionLabel.toLowerCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: PLACED FURNITURE ITEMS LIST ── */}
          {currentTab === 'items' && (
            <div style={cardListWrap}>
              <div style={tabSubtitleRow}>
                <span style={sectionTag}>Inventory in Condo Layout</span>
                <span style={{ fontSize: 12, color: t.inkSoft }}>
                  Tap piece to select on plan
                </span>
              </div>

              {items.length === 0 ? (
                <div style={emptyStateWrap}>
                  <div style={{ ...emptyIcon, background: 'rgba(100, 116, 139, 0.12)', color: t.inkSoft }}>🛋️</div>
                  <div style={emptyTitle}>No Furniture Placed Yet</div>
                  <p style={emptyDesc}>
                    Add items from the furniture input screen or place pieces in AR.
                  </p>
                </div>
              ) : (
                items.map((item) => {
                  const status = itemStatuses[item.id] ?? 'GREEN';
                  const isSel = selectedId === item.id;
                  const isRed = status === 'RED';
                  const isYellow = status === 'YELLOW';
                  const statusColor = isRed ? t.attentionFg : isYellow ? t.tightFg : t.comfortFg;
                  const statusBg = isRed ? t.attentionBg : isYellow ? t.tightBg : t.comfortBg;
                  const statusLabel = isRed ? 'Needs Attention' : isYellow ? 'Tight' : 'Comfortable';
                  const roomName = CONDO_ROOMS.find(
                    (r) => r.id === (item.roomId || getRoomForCategory(item.category, item.label)),
                  )?.label ?? 'Unassigned Room';

                  return (
                    <div
                      key={item.id}
                      className="wksp-item-card"
                      style={{
                        ...itemCardStyle(isSel),
                        borderLeftColor: statusColor,
                      }}
                      onClick={() => {
                        onSelectItem?.(item.id);
                        onClose();
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 750, color: t.ink, fontSize: 14.5 }}>
                            {item.label}
                          </span>
                          {item.placementType === 'wall' && (
                            <span style={wallBadge}>Wall ({item.mountHeightCm ?? 120}cm)</span>
                          )}
                          {item.shape && item.shape !== 'rectangle' && (
                            <span style={shapeBadge}>{item.shape}</span>
                          )}
                        </div>

                        <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 3 }}>
                          {roomName} · {item.lengthCm} × {item.widthCm} × {item.heightCm} cm
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...itemBadge, background: statusBg, color: statusColor }}>
                          {statusLabel}
                        </span>
                        {onLaunchAR && (
                          <button
                            type="button"
                            className="wksp-icon-btn"
                            style={arSmallBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onLaunchAR(item);
                            }}
                            title="Adjust in AR"
                            aria-label={`Adjust ${item.label} in AR`}
                          >
                            📷 AR
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB 3: DESIGN RULES REFERENCE ── */}
          {currentTab === 'rules' && (
            <div style={cardListWrap}>
              <div style={tabSubtitleRow}>
                <span style={sectionTag}>Interior Design Standards</span>
                <span style={{ fontSize: 12, color: t.inkSoft }}>
                  Time-Saver Standards Reference
                </span>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: t.inkSoft, lineHeight: 1.45 }}>
                Codified architectural clearance and circulation standards for 2-bedroom condominium living.
              </p>

              {ALL_RULE_GUIDANCE.map((g) => {
                const isLiving = g.area === 'Living area' || g.area === 'Circulation';
                const isDining = g.area === 'Dining area';
                const areaBadge = isLiving ? 'Living' : isDining ? 'Dining' : 'Bedroom';
                const areaBg = isLiving ? 'rgba(59, 130, 246, 0.1)' : isDining ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)';
                const areaFg = isLiving ? '#2563eb' : isDining ? '#d97706' : '#4f46e5';

                return (
                  <div key={g.code} style={ruleCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={ruleCodeBadge}>{g.code}</span>
                        <span style={{ fontWeight: 750, fontSize: 13.5, color: t.ink }}>{g.title}</span>
                      </div>
                      <span style={{ ...roomTagSmall, background: areaBg, color: areaFg }}>
                        {areaBadge}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: t.inkSoft, lineHeight: 1.45 }}>
                      {g.requirement}
                    </p>

                    <div style={{ marginTop: 6, fontSize: 11.5, color: t.inkMute, fontWeight: 500 }}>
                      Minimum: {g.violationThresholdCm} cm · Comfortable: {g.warningThresholdCm} cm
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  background: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  animation: 'backdropFadeIn 0.2s ease',
};

const sheetContainerStyle: CSSProperties = {
  background: '#ffffff',
  borderTopLeftRadius: 22,
  borderTopRightRadius: 22,
  boxShadow: '0 -10px 40px rgba(15, 23, 42, 0.25)',
  maxHeight: '82dvh',
  minHeight: '360px',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
  paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
};

const handleBarWrap: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingTop: 10,
  paddingBottom: 6,
  cursor: 'pointer',
};

const handleBar: CSSProperties = {
  width: 40,
  height: 4.5,
  borderRadius: 3,
  background: '#CBD5E1',
};

const sheetHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 20px 12px',
  borderBottom: `1px solid ${t.line}`,
};

const sheetTitle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 800,
  color: t.ink,
  letterSpacing: '-0.02em',
};

const countBadge = (hasItems: boolean): CSSProperties => ({
  fontSize: 12,
  fontWeight: 750,
  padding: '2px 8px',
  borderRadius: 12,
  background: hasItems ? t.attentionBg : t.comfortBg,
  color: hasItems ? t.attentionFg : t.comfortFg,
});

const closeBtn: CSSProperties = {
  border: 'none',
  background: 'rgba(0, 0, 0, 0.05)',
  width: 32,
  height: 32,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  fontWeight: 700,
  color: t.inkSoft,
  cursor: 'pointer',
};

const tabSwitcherBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 16px',
  background: '#F8FAFC',
  borderBottom: `1px solid ${t.line}`,
  gap: 8,
};

const tabBtnStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 38,
  borderRadius: radius.sm,
  border: active ? `1.5px solid ${t.ink}` : '1.5px solid transparent',
  background: active ? '#ffffff' : 'transparent',
  color: active ? t.ink : t.inkSoft,
  fontSize: 13,
  fontWeight: active ? 750 : 600,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none',
});

const tabCounterBadge = (isAttention: boolean, active: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  borderRadius: 9,
  fontSize: 11,
  fontWeight: 800,
  background: isAttention ? t.attentionBg : active ? 'rgba(15, 23, 42, 0.1)' : 'rgba(100, 116, 139, 0.12)',
  color: isAttention ? t.attentionFg : active ? t.ink : t.inkMute,
});

const sheetBody: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '14px 18px',
  WebkitOverflowScrolling: 'touch',
};

const tabSubtitleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
};

const sectionTag: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: t.inkMute,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const cardListWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: radius.md,
  border: `1px solid ${t.line}`,
  borderLeftWidth: 4,
  cursor: 'pointer',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
};

const cardContentWrap: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const cardTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const cardItemLabel: CSSProperties = {
  fontSize: 14.5,
  fontWeight: 750,
  color: t.ink,
};

const severityDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
};

const cardChevron: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: t.inkMute,
};

const cardActionText: CSSProperties = {
  fontSize: 13,
  color: t.inkSoft,
  lineHeight: 1.4,
  fontWeight: 500,
};

const cardMetaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 4,
};

const cardRoomBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 650,
  color: t.inkMute,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const cardDirectionBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 650,
  color: t.brand,
  background: 'rgba(37, 99, 235, 0.08)',
  padding: '2px 7px',
  borderRadius: 6,
};

const itemCardStyle = (selected: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px',
  borderRadius: radius.md,
  border: selected ? `1.5px solid ${t.ink}` : `1px solid ${t.line}`,
  borderLeftWidth: 4,
  background: selected ? '#F8FAFC' : '#ffffff',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
});

const itemBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 10,
  whiteSpace: 'nowrap',
};

const wallBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 750,
  padding: '1px 6px',
  borderRadius: 4,
  background: 'rgba(59, 130, 246, 0.1)',
  color: '#2563eb',
  border: '1px solid rgba(59, 130, 246, 0.25)',
};

const shapeBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 4,
  background: 'rgba(100, 116, 139, 0.1)',
  color: '#475569',
  textTransform: 'capitalize',
};

const arSmallBtn: CSSProperties = {
  height: 28,
  padding: '0 8px',
  fontSize: 11.5,
  fontWeight: 700,
  borderRadius: 6,
  border: `1px solid ${t.line}`,
  background: '#ffffff',
  color: t.ink,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
};

const ruleCard: CSSProperties = {
  padding: '12px 14px',
  borderRadius: radius.md,
  border: `1px solid ${t.line}`,
  background: '#ffffff',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
};

const ruleCodeBadge: CSSProperties = {
  fontWeight: 800,
  fontSize: 11.5,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(30, 41, 59, 0.08)',
  color: t.ink,
};

const roomTagSmall: CSSProperties = {
  fontSize: 11,
  fontWeight: 750,
  padding: '2px 7px',
  borderRadius: 6,
};

const emptyStateWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '36px 16px',
  textAlign: 'center',
};

const emptyIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 24,
  background: t.comfortBg,
  color: t.comfortFg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 22,
  fontWeight: 800,
  marginBottom: 12,
};

const emptyTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: t.ink,
  marginBottom: 4,
};

const emptyDesc: CSSProperties = {
  fontSize: 13,
  color: t.inkSoft,
  maxWidth: 280,
  margin: 0,
  lineHeight: 1.45,
};
