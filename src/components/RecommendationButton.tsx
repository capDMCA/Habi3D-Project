import type { CSSProperties } from 'react';
import { color as t } from './tokens';

interface RecommendationButtonProps {
  count: number;
  onClick: () => void;
  active?: boolean;
}

export default function RecommendationButton({
  count,
  onClick,
  active = false,
}: RecommendationButtonProps) {
  const isZero = count === 0;

  const btnStyle: CSSProperties = {
    position: 'absolute',
    bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    right: 16,
    zIndex: 25,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '0 18px',
    borderRadius: 24,
    border: isZero ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(37, 99, 235, 0.35)',
    background: isZero
      ? 'rgba(255, 255, 255, 0.92)'
      : 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: t.ink,
    fontSize: 13.5,
    fontWeight: 700,
    boxShadow: isZero
      ? '0 6px 20px rgba(16, 185, 129, 0.12), 0 2px 6px rgba(0, 0, 0, 0.05)'
      : '0 6px 24px rgba(37, 99, 235, 0.18), 0 2px 6px rgba(0, 0, 0, 0.06)',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: active ? 'scale(0.97)' : 'none',
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 800,
    background: isZero ? t.comfortBg : t.brand,
    color: isZero ? t.comfortFg : '#ffffff',
  };

  return (
    <button
      type="button"
      className="wksp-rec-float-btn"
      style={btnStyle}
      onClick={onClick}
      aria-label={`${count} Recommendations`}
      title="View design recommendations"
    >
      <span style={badgeStyle}>
        {isZero ? '✓' : count}
      </span>
      <span>
        {isZero ? 'All Clear' : count === 1 ? '1 Recommendation' : `${count} Recommendations`}
      </span>
      <span style={{ fontSize: 13, color: t.inkMute, fontWeight: 600 }}>›</span>
    </button>
  );
}
