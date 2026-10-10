import type { CSSProperties } from 'react';
import type { PanelTab } from './RecommendationSheet';
import { color as t } from './tokens';

interface MobileWorkspaceHubProps {
  recommendationCount: number;
  itemCount: number;
  activeTab: PanelTab;
  isSheetOpen: boolean;
  onOpenTab: (tab: PanelTab) => void;
}

export default function MobileWorkspaceHub({
  recommendationCount,
  itemCount,
  activeTab,
  isSheetOpen,
  onOpenTab,
}: MobileWorkspaceHubProps) {
  const isAttention = recommendationCount > 0;

  return (
    <nav className="wksp-mobile-hub-bar" aria-label="Layout insights and controls">
      {/* 1. Improvements / Recommendations Tab */}
      <button
        type="button"
        className={`wksp-mobile-hub-btn ${isSheetOpen && activeTab === 'recommendations' ? 'active' : ''}`}
        onClick={() => onOpenTab('recommendations')}
        aria-label={`Actionable improvements: ${recommendationCount} items`}
        title="View actionable improvements"
      >
        <span className="hub-btn-icon">💡</span>
        <span className="hub-btn-label">Improvements</span>
        <span
          className={`hub-btn-badge ${isAttention ? 'badge-attention' : 'badge-good'}`}
          style={badgeStyle(isAttention)}
        >
          {isAttention ? recommendationCount : '✓'}
        </span>
      </button>

      {/* 2. Placed Furniture Items Tab */}
      <button
        type="button"
        className={`wksp-mobile-hub-btn ${isSheetOpen && activeTab === 'items' ? 'active' : ''}`}
        onClick={() => onOpenTab('items')}
        aria-label={`Placed furniture: ${itemCount} items`}
        title="View placed furniture items"
      >
        <span className="hub-btn-icon">🛋️</span>
        <span className="hub-btn-label">Items</span>
        <span className="hub-btn-badge badge-neutral">
          {itemCount}
        </span>
      </button>

      {/* 3. Interior Design Rules Reference Tab */}
      <button
        type="button"
        className={`wksp-mobile-hub-btn ${isSheetOpen && activeTab === 'rules' ? 'active' : ''}`}
        onClick={() => onOpenTab('rules')}
        aria-label="View interior design rules and standards"
        title="View design rules and standards"
      >
        <span className="hub-btn-icon">📐</span>
        <span className="hub-btn-label">Rules</span>
        <span className="hub-btn-badge badge-neutral">
          12
        </span>
      </button>
    </nav>
  );
}

const badgeStyle = (isAttention: boolean): CSSProperties => ({
  background: isAttention ? t.attentionBg : t.comfortBg,
  color: isAttention ? t.attentionFg : t.comfortFg,
});
