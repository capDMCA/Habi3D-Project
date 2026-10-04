import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FurnitureItem, Violation } from '../types';
import type { WalkwayStatus } from '../engine/walkways';
import { color as t, radius } from './tokens';
import { ruleGuidance } from '../engine/ruleGuidance';
import { CONDO_ROOMS, getRoomForCategory } from '../data/condoLayout';

interface DesignerAssistantProps {
  violations: Violation[];
  items: FurnitureItem[];
  walkwayStatuses: WalkwayStatus[];
  onSelectItem: (id: string) => void;
  selectedId: string | null;
  onLaunchAR?: (item?: FurnitureItem) => void;
  hasARCapability?: boolean;
}

interface AssistantAdvice {
  id: string;
  furnitureId: string;
  furnitureLabel: string;
  severity: 'RED' | 'YELLOW' | 'GREEN';
  whatIsWrong: string;
  whatToDo: string;
  whyItHelps: string;
  roomLabel: string;
}

export default function DesignerAssistant({
  violations,
  items,
  walkwayStatuses,
  onSelectItem,
  selectedId,
  onLaunchAR,
  hasARCapability = false,
}: DesignerAssistantProps) {
  const [adviceIndex, setAdviceIndex] = useState(0);

  // Synthesize resident-friendly recommendations (What is wrong -> What should I do -> Why it helps)
  const adviceList: AssistantAdvice[] = useMemo(() => {
    const list: AssistantAdvice[] = [];

    // 1. Process clearance violations
    for (const v of violations) {
      const item = items.find((it) => it.id === v.furnitureId);
      const roomId = item?.roomId || (item ? getRoomForCategory(item.category, item.label) : 'living');
      const roomLabel = CONDO_ROOMS.find((r) => r.id === roomId)?.label ?? 'Living Room';
      const g = ruleGuidance(v.ruleCode);

      let whatIsWrong = '';
      if (!v.itemBId || v.itemBId === 'wall') {
        const wallText = v.wallSide ? `the ${v.wallSide} wall` : 'the wall';
        whatIsWrong = `Your ${v.furnitureLabel.toLowerCase()} is sitting too close to ${wallText} in the ${roomLabel}.`;
      } else {
        const other = items.find((it) => it.id === v.itemBId);
        const otherLabel = other?.label.toLowerCase() ?? 'another piece';
        whatIsWrong = `Your ${v.furnitureLabel.toLowerCase()} is crowding your ${otherLabel} in the ${roomLabel}.`;
      }

      const dir = v.fixDirectionLabel.toLowerCase();
      const whatToDo = `Slide the ${v.furnitureLabel.toLowerCase()} about ${v.fixDirectionCm} cm ${dir}.`;
      const whyItHelps = g?.consequence
        ? `This ensures that ${g.consequence}.`
        : 'This opens up circulation and keeps walking paths comfortable.';

      list.push({
        id: v.id,
        furnitureId: v.furnitureId,
        furnitureLabel: v.furnitureLabel,
        severity: v.classification,
        whatIsWrong,
        whatToDo,
        whyItHelps,
        roomLabel,
      });
    }

    // 2. Blocked Walkways
    const blockedWalkways = walkwayStatuses.filter((w) => w.status === 'RED');
    for (const w of blockedWalkways) {
      list.push({
        id: `walkway-${w.id}`,
        furnitureId: items[0]?.id ?? '',
        furnitureLabel: 'Main Walkway',
        severity: 'RED',
        whatIsWrong: `The ${w.label} pathway is currently obstructed.`,
        whatToDo: 'Shift furniture away from the entry corridor to keep the transit route open.',
        whyItHelps: 'Ensures safe, effortless movement through the apartment.',
        roomLabel: 'Circulation',
      });
    }

    // Sort: RED first, then YELLOW
    return list.sort((a, b) => {
      const score = (s: string) => (s === 'RED' ? 2 : s === 'YELLOW' ? 1 : 0);
      return score(b.severity) - score(a.severity);
    });
  }, [violations, items, walkwayStatuses]);

  const activeAdvice = adviceList[Math.min(adviceIndex, Math.max(0, adviceList.length - 1))] ?? null;
  const isAllClear = adviceList.length === 0;

  const currentItem = useMemo(
    () => items.find((it) => it.id === (activeAdvice?.furnitureId || selectedId)),
    [items, activeAdvice, selectedId],
  );

  return (
    <div style={containerStyle}>
      {/* Header with Designer Avatar */}
      <div style={headerStyle}>
        <div style={avatarWrapStyle}>
          <div style={avatarBadgeStyle}>
            <span style={{ fontSize: 16 }}>🛋️</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: t.ink, display: 'flex', alignItems: 'center', gap: 6 }}>
              Designer Assistant
              <span style={roleBadgeStyle}>AI Guide</span>
            </div>
            <div style={{ fontSize: 11, color: t.inkSoft }}>Habi3D Interior Advisor</div>
          </div>
        </div>

        <span
          style={{
            ...statusPillStyle,
            background: isAllClear ? t.comfortBg : t.tightBg,
            color: isAllClear ? t.comfortFg : t.tightFg,
          }}
        >
          {isAllClear ? '✓ All Clear' : `${adviceList.length} Suggestion${adviceList.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Main Guidance Bubble */}
      {isAllClear ? (
        <div style={bubbleStyle(t.comfortFg)}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: t.ink }}>
            Your room layout looks fantastic!
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: t.inkSoft, lineHeight: 1.45 }}>
            Every piece has generous breathing room and all major walkways are open and clear.
          </p>
        </div>
      ) : activeAdvice ? (
        <div style={bubbleStyle(activeAdvice.severity === 'RED' ? t.attentionFg : t.tightFg)}>
          {/* What is wrong */}
          <div style={{ marginBottom: 6 }}>
            <span style={labelTagStyle(activeAdvice.severity === 'RED' ? t.attentionFg : t.tightFg)}>
              {activeAdvice.severity === 'RED' ? 'Needs Attention' : 'Recommendation'}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, fontWeight: 650, color: t.ink, lineHeight: 1.4 }}>
              {activeAdvice.whatIsWrong}
            </p>
          </div>

          {/* What should I do */}
          <div style={actionCalloutStyle}>
            <span style={{ fontSize: 11, fontWeight: 750, color: t.inkSoft, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suggested Action
            </span>
            <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: t.brand }}>
              {activeAdvice.whatToDo}
            </p>
          </div>

          {/* Why it helps */}
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: t.inkSoft, lineHeight: 1.4 }}>
            💡 {activeAdvice.whyItHelps}
          </p>

          {/* Action Row */}
          <div style={actionRowStyle}>
            {activeAdvice.furnitureId && (
              <button
                type="button"
                className="wksp-text-btn"
                style={actionBtnStyle}
                onClick={() => onSelectItem(activeAdvice.furnitureId)}
              >
                Highlight Piece
              </button>
            )}

            {onLaunchAR && currentItem && (
              <button
                type="button"
                className="wksp-text-btn"
                style={{ ...actionBtnStyle, color: t.brand, borderColor: t.brand }}
                onClick={() => onLaunchAR(currentItem)}
                title="Adjust this furniture in Augmented Reality"
              >
                {hasARCapability ? '📷 Adjust in AR' : '📷 AR Mode'}
              </button>
            )}
          </div>

          {/* Pagination if multiple suggestions */}
          {adviceList.length > 1 && (
            <div style={paginationRowStyle}>
              <span style={{ fontSize: 11, color: t.inkSoft, fontWeight: 600 }}>
                Tip {adviceIndex + 1} of {adviceList.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  style={navBtnStyle}
                  onClick={() => setAdviceIndex((i) => Math.max(0, i - 1))}
                  disabled={adviceIndex === 0}
                  aria-label="Previous tip"
                >
                  ←
                </button>
                <button
                  type="button"
                  style={navBtnStyle}
                  onClick={() => setAdviceIndex((i) => Math.min(adviceList.length - 1, i + 1))}
                  disabled={adviceIndex === adviceList.length - 1}
                  aria-label="Next tip"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const containerStyle: CSSProperties = {
  background: 'var(--surface, #ffffff)',
  borderRadius: radius.md,
  border: `1px solid ${t.line}`,
  padding: '12px 14px',
  marginBottom: 14,
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 10,
};

const avatarWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const avatarBadgeStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #e0e7ff 0%, #dbeafe 100%)',
  border: `1px solid ${t.line}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const roleBadgeStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  padding: '1px 6px',
  borderRadius: 999,
  background: '#e0f2fe',
  color: '#0369a1',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const statusPillStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 8px',
  borderRadius: 999,
};

const bubbleStyle = (accentColor: string): CSSProperties => ({
  background: t.ground,
  border: `1px solid ${t.line}`,
  borderLeft: `3.5px solid ${accentColor}`,
  borderRadius: 8,
  padding: '10px 12px',
});

const labelTagStyle = (color: string): CSSProperties => ({
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color,
});

const actionCalloutStyle: CSSProperties = {
  background: 'rgba(37, 99, 235, 0.05)',
  borderRadius: 6,
  padding: '6px 8px',
  marginTop: 4,
  border: '1px dashed rgba(37, 99, 235, 0.25)',
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 10,
  flexWrap: 'wrap',
};

const actionBtnStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 6,
  border: `1px solid ${t.line}`,
  background: '#ffffff',
  cursor: 'pointer',
  minHeight: 28,
};

const paginationRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 8,
  paddingTop: 6,
  borderTop: `1px solid ${t.line}`,
};

const navBtnStyle: CSSProperties = {
  width: 24,
  height: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 4,
  border: `1px solid ${t.line}`,
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
};
