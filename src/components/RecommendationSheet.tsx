import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { WorkspaceRecommendation } from '../engine/recommendations';
import { color as t, radius } from './tokens';

interface RecommendationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: WorkspaceRecommendation[];
  selectedId: string | null;
  onSelectRecommendation: (rec: WorkspaceRecommendation) => void;
}

export default function RecommendationSheet({
  isOpen,
  onClose,
  recommendations,
  selectedId,
  onSelectRecommendation,
}: RecommendationSheetProps) {
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
        <div style={handleBarWrap} onClick={onClose}>
          <div style={handleBar} />
        </div>

        {/* Header */}
        <div style={sheetHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 id="rec-sheet-title" style={sheetTitle}>
              Recommendations
            </h2>
            <span style={countBadge(count > 0)}>
              {count > 0 ? count : '✓'}
            </span>
          </div>

          <button
            type="button"
            style={closeBtn}
            onClick={onClose}
            aria-label="Close recommendations"
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div style={sheetBody}>
          {count === 0 ? (
            <div style={emptyStateWrap}>
              <div style={emptyIcon}>✓</div>
              <div style={emptyTitle}>All Clear</div>
              <p style={emptyDesc}>
                Every piece has comfortable clearance and walkways are open.
              </p>
            </div>
          ) : (
            <div style={cardListWrap}>
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
                            {rec.fixDirectionLabel}
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
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 60,
  background: 'rgba(15, 23, 42, 0.42)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  animation: 'backdropFadeIn 0.2s ease',
};

const sheetContainerStyle: CSSProperties = {
  background: '#ffffff',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  boxShadow: '0 -10px 40px rgba(15, 23, 42, 0.25)',
  maxHeight: '80dvh',
  minHeight: '260px',
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
  width: 38,
  height: 4.5,
  borderRadius: 3,
  background: '#CBD5E1',
};

const sheetHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 20px 14px',
  borderBottom: `1px solid ${t.line}`,
};

const sheetTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: t.ink,
  letterSpacing: '-0.02em',
};

const countBadge = (hasItems: boolean): CSSProperties => ({
  fontSize: 12,
  fontWeight: 800,
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

const sheetBody: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 18px',
};

const cardListWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '14px 16px',
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
  fontSize: 15,
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
  fontSize: 13.5,
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
  fontWeight: 600,
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
