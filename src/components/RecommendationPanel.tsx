import type { CSSProperties } from 'react';
import type { WorkspaceRecommendation } from '../engine/recommendations';
import type { FurnitureItem } from '../types';
import { color as t, radius } from './tokens';
import { ALL_RULE_GUIDANCE } from '../engine/ruleGuidance';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';

type PanelTab = 'recommendations' | 'items' | 'rules';

interface RecommendationPanelProps {
  recommendations: WorkspaceRecommendation[];
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  selectedId: string | null;
  onSelectRecommendation: (rec: WorkspaceRecommendation) => void;
  items: FurnitureItem[];
  itemStatuses: Record<string, 'RED' | 'YELLOW' | 'GREEN'>;
  onSelectItem: (id: string) => void;
  onLaunchAR: (item?: FurnitureItem) => void;
}

export default function RecommendationPanel({
  recommendations,
  activeTab,
  onTabChange,
  selectedId,
  onSelectRecommendation,
  items,
  itemStatuses,
  onSelectItem,
  onLaunchAR,
}: RecommendationPanelProps) {
  const count = recommendations.length;

  return (
    <aside style={panelContainer} aria-label="Design recommendations and layout details">
      {/* Tab Header */}
      <div style={tabHeader}>
        <button
          type="button"
          className="wksp-tab-btn"
          style={tabBtn(activeTab === 'recommendations')}
          onClick={() => onTabChange('recommendations')}
        >
          Recommendations{count > 0 ? ` (${count})` : ''}
        </button>
        <button
          type="button"
          className="wksp-tab-btn"
          style={tabBtn(activeTab === 'items')}
          onClick={() => onTabChange('items')}
        >
          Items
        </button>
        <button
          type="button"
          className="wksp-tab-btn"
          style={tabBtn(activeTab === 'rules')}
          onClick={() => onTabChange('rules')}
        >
          Rules
        </button>
      </div>

      {/* Body */}
      <div style={panelBody}>
        {/* TAB 1: RECOMMENDATIONS */}
        {activeTab === 'recommendations' && (
          <div style={scrollList}>
            <div style={sectionHeader}>
              <span style={sectionTitle}>Actionable Improvements</span>
              <span style={countPill(count > 0)}>
                {count === 0 ? '✓ Optimized' : `${count} to review`}
              </span>
            </div>

            {count === 0 ? (
              <div style={emptyBox}>
                <div style={emptyCheck}>✓</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: t.ink }}>Layout Looks Great</div>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: t.inkSoft, lineHeight: 1.45 }}>
                  Every piece has comfortable clearance and trafficways are clear.
                </p>
              </div>
            ) : (
              recommendations.map((rec) => {
                const isSelected = selectedId === rec.furnitureId;
                const isRed = rec.severity === 'RED';
                const accentColor = isRed ? t.attentionFg : t.tightFg;

                return (
                  <div
                    key={rec.id}
                    className="wksp-rec-card"
                    style={{
                      ...cardStyle,
                      borderLeftColor: accentColor,
                      borderColor: isSelected ? t.ink : t.line,
                      background: isSelected ? '#F8FAFC' : '#ffffff',
                    }}
                    onClick={() => onSelectRecommendation(rec)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectRecommendation(rec);
                      }
                    }}
                  >
                    <div style={cardTopRow}>
                      <span style={cardItemName}>{rec.furnitureLabel}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            ...statusDot,
                            background: accentColor,
                          }}
                        />
                        <span style={cardChevron}>›</span>
                      </div>
                    </div>

                    <p style={cardActionText}>{rec.actionText}</p>

                    <div style={cardFooterRow}>
                      <span style={roomTag}>{rec.roomLabel}</span>
                      {rec.fixDirectionLabel && (
                        <span style={directionTag}>
                          Shift {rec.fixDirectionLabel.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ITEMS LIST */}
        {activeTab === 'items' && (
          <div style={scrollList}>
            <div style={sectionHeader}>
              <span style={sectionTitle}>Placed Furniture ({items.length})</span>
            </div>

            {items.map((item) => {
              const status = itemStatuses[item.id] ?? 'GREEN';
              const sel = selectedId === item.id;
              const isRed = status === 'RED';
              const isYellow = status === 'YELLOW';
              const statusColor = isRed ? t.attentionFg : isYellow ? t.tightFg : t.comfortFg;
              const statusBg = isRed ? t.attentionBg : isYellow ? t.tightBg : t.comfortBg;
              const statusLabel = isRed ? 'Needs Attention' : isYellow ? 'Tight' : 'Good';
              const roomName = CONDO_ROOMS.find(
                (r) => r.id === (item.roomId || getRoomForCategory(item.category, item.label)),
              )?.label ?? '';

              return (
                <div
                  key={item.id}
                  className="wksp-list-row"
                  onClick={() => onSelectItem(item.id)}
                  style={{
                    ...itemRowStyle(sel),
                    borderLeftColor: statusColor,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 650, color: t.ink, fontSize: 14 }}>{item.label}</div>
                    <div style={{ fontSize: 11.5, color: t.inkSoft, marginTop: 2 }}>{roomName}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...itemBadge, background: statusBg, color: statusColor }}>
                      {statusLabel}
                    </span>
                    <button
                      type="button"
                      className="wksp-icon-btn"
                      style={arSmallBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLaunchAR(item);
                      }}
                      title="Adjust in AR"
                    >
                      📷 AR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: RULES REFERENCE */}
        {activeTab === 'rules' && (
          <div style={scrollList}>
            <div style={sectionHeader}>
              <span style={sectionTitle}>Interior Design Standards</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: t.inkSoft, lineHeight: 1.45 }}>
              Standard clearance guidelines from Time-Saver Standards for Interior Design.
            </p>

            {ALL_RULE_GUIDANCE.map((g) => (
              <div key={g.code} style={ruleCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: t.ink }}>{g.title}</span>
                  <span style={ruleCodeBadge}>{g.code}</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: t.inkSoft, lineHeight: 1.4 }}>
                  {g.requirement}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

const panelContainer: CSSProperties = {
  flex: '0 1 340px',
  minWidth: 300,
  maxWidth: 380,
  background: '#ffffff',
  borderLeft: `1px solid ${t.line}`,
  boxShadow: '-2px 0 12px rgba(15, 23, 42, 0.03)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  zIndex: 10,
};

const tabHeader: CSSProperties = {
  display: 'flex',
  borderBottom: `1px solid ${t.line}`,
  flexShrink: 0,
};

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '13px 8px',
  border: 'none',
  background: 'none',
  fontSize: 13,
  fontWeight: 750,
  color: active ? t.ink : t.inkMute,
  borderBottom: active ? `3px solid ${t.ink}` : '3px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s ease',
});

const panelBody: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};

const scrollList: CSSProperties = {
  overflowY: 'auto',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  height: '100%',
  boxSizing: 'border-box',
};

const sectionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 4,
};

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: t.inkMute,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const countPill = (hasItems: boolean): CSSProperties => ({
  fontSize: 11,
  fontWeight: 750,
  padding: '2px 8px',
  borderRadius: 10,
  background: hasItems ? t.attentionBg : t.comfortBg,
  color: hasItems ? t.attentionFg : t.comfortFg,
});

const emptyBox: CSSProperties = {
  padding: '32px 16px',
  textAlign: 'center',
  background: t.comfortBg,
  borderRadius: radius.md,
  border: `1px solid ${t.comfortFg}`,
};

const emptyCheck: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  background: t.comfortFg,
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  fontWeight: 800,
  margin: '0 auto 10px',
};

const cardStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: radius.md,
  border: `1px solid ${t.line}`,
  borderLeftWidth: 4,
  cursor: 'pointer',
  transition: 'all 0.18s ease',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
};

const cardTopRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 4,
};

const cardItemName: CSSProperties = {
  fontSize: 14.5,
  fontWeight: 750,
  color: t.ink,
};

const statusDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
};

const cardChevron: CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: t.inkMute,
};

const cardActionText: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 13,
  color: t.inkSoft,
  lineHeight: 1.4,
};

const cardFooterRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const roomTag: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: t.inkMute,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const directionTag: CSSProperties = {
  fontSize: 11,
  fontWeight: 650,
  color: t.brand,
  background: 'rgba(37, 99, 235, 0.08)',
  padding: '2px 7px',
  borderRadius: 6,
};

const itemRowStyle = (sel: boolean): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: sel ? '#F8FAFC' : '#ffffff',
  border: `1px solid ${sel ? t.ink : t.line}`,
  borderLeftWidth: 4,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
});

const itemBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 12,
  whiteSpace: 'nowrap',
};

const arSmallBtn: CSSProperties = {
  padding: '3px 7px',
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 6,
  border: `1px solid ${t.line}`,
  background: '#ffffff',
  color: t.brand,
  cursor: 'pointer',
};

const ruleCard: CSSProperties = {
  padding: '10px 12px',
  borderRadius: radius.sm,
  background: '#F8FAFC',
  border: `1px solid ${t.line}`,
};

const ruleCodeBadge: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 750,
  color: t.inkMute,
  background: '#E2E8F0',
  padding: '1px 6px',
  borderRadius: 4,
};
