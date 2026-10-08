import type { CSSProperties } from 'react';
import type { WorkspaceRecommendation } from '../engine/recommendations';
import { color as t, radius } from './tokens';

interface RecommendationCardProps {
  recommendation: WorkspaceRecommendation;
  isResolved: boolean;
  onDone: () => void;
}

export default function RecommendationCard({
  recommendation,
  isResolved,
  onDone,
}: RecommendationCardProps) {
  const isRed = recommendation.severity === 'RED';
  const accentColor = isResolved ? t.comfortFg : isRed ? t.attentionFg : t.tightFg;

  return (
    <div className="wksp-contextual-card" style={cardContainer}>
      <div style={{ ...accentBar, background: accentColor }} />

      <div style={contentWrap}>
        <div style={headerRow}>
          <span style={itemTitle}>{recommendation.furnitureLabel}</span>
          {isResolved ? (
            <span style={resolvedBadge}>✓ Looks good</span>
          ) : (
            <span style={statusBadge(isRed)}>
              {isRed ? 'Needs Attention' : 'Recommendation'}
            </span>
          )}
        </div>

        <p style={actionText}>
          {isResolved ? 'Clearance is now comfortable!' : recommendation.actionText}
        </p>

        {recommendation.fixDirectionLabel && !isResolved && (
          <div style={directionHint}>
            <span style={{ fontWeight: 700 }}>Correction:</span>{' '}
            Shift {recommendation.fixDirectionLabel.toLowerCase()} by ~{recommendation.fixDirectionCm} cm
          </div>
        )}
      </div>

      <button
        type="button"
        className="wksp-solid-btn"
        style={doneBtn(isResolved)}
        onClick={onDone}
        aria-label="Dismiss focused recommendation"
      >
        {isResolved ? 'Next' : 'Done'}
      </button>
    </div>
  );
}

const cardContainer: CSSProperties = {
  position: 'absolute',
  bottom: 60,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 30,
  width: 'min(420px, calc(100vw - 32px))',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: radius.md,
  background: 'rgba(255, 255, 255, 0.96)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${t.line}`,
  boxShadow: '0 8px 30px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(0, 0, 0, 0.04)',
  animation: 'fadeInUpCard 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
};

const accentBar: CSSProperties = {
  width: 4,
  alignSelf: 'stretch',
  borderRadius: 2,
  flexShrink: 0,
  transition: 'background 0.25s ease',
};

const contentWrap: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const headerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 2,
};

const itemTitle: CSSProperties = {
  fontSize: 14.5,
  fontWeight: 750,
  color: t.ink,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const statusBadge = (isRed: boolean): CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 7px',
  borderRadius: 8,
  background: isRed ? t.attentionBg : t.tightBg,
  color: isRed ? t.attentionFg : t.tightFg,
  whiteSpace: 'nowrap',
});

const resolvedBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 7px',
  borderRadius: 8,
  background: t.comfortBg,
  color: t.comfortFg,
  whiteSpace: 'nowrap',
};

const actionText: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: t.inkSoft,
  lineHeight: 1.35,
  fontWeight: 500,
};

const directionHint: CSSProperties = {
  marginTop: 4,
  fontSize: 11.5,
  color: t.brand,
  lineHeight: 1.3,
};

const doneBtn = (isResolved: boolean): CSSProperties => ({
  minHeight: 36,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: isResolved ? t.comfortFg : t.ink,
  color: '#ffffff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'background 0.2s ease, transform 0.1s ease',
});
