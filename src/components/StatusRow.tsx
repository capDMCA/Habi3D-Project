import type { CSSProperties } from 'react';
import type { StatusKey } from './statusVocabulary';
import { statusMeta } from './statusVocabulary';
import { color, type as typeScale } from './designTokens';

/**
 * One finding, presented calmly: a state icon, the plain human consequence
 * ("Not enough room to walk past comfortably") as the primary line, and the
 * measurement as a smaller secondary line below it — never the other way
 * round. The canonical row shared by the drag preview and the Analysis list,
 * so both read identically.
 *
 * `improved` plays a brief colour-transition flash — not a toast, not a
 * modal — when this exact finding just got better than it was a moment ago.
 * It's driven entirely by CSS (a keyframe animation gated on the `improved`
 * prop, colour supplied via a custom property) rather than a JS timer, so
 * there's no setState-in-effect and no risk of a stuck highlight if the
 * component unmounts mid-flash.
 */

export interface StatusRowProps {
  status: StatusKey;
  title: string;
  detail: string;
  /** True for the render right after this finding's status improved. */
  improved?: boolean;
}

function StatusIcon({ status, color }: { status: StatusKey; color: string }) {
  // One distinct glyph per state — never shared between states.
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={10} cy={10} r={9} fill="none" stroke={color} strokeWidth={2} />
      {status === 'comfortable' && (
        <path d="M6 10.5l2.5 2.5L14 7" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === 'tight' && (
        <path d="M6 10h8" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      )}
      {status === 'needs-attention' && (
        <g fill={color}>
          <rect x={9} y={5} width={2} height={6} rx={1} />
          <circle cx={10} cy={14} r={1.2} />
        </g>
      )}
    </svg>
  );
}

export default function StatusRow({ status, title, detail, improved = false }: StatusRowProps) {
  const meta = statusMeta(status);
  const flashStyle: CSSProperties = improved
    ? ({ animation: 'statusRowImprove 0.9s ease', '--status-row-flash-bg': meta.bg } as CSSProperties)
    : {};

  return (
    <div style={{ ...rowStyle, ...flashStyle }}>
      <span style={{ ...iconWrap, background: meta.bg }}>
        <StatusIcon status={status} color={meta.color} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={titleStyle}>{title}</p>
        <p style={{ ...detailStyle, color: meta.color }}>{detail}</p>
      </div>
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 10px',
  borderRadius: 10,
};

const iconWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 10,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  ...typeScale.body,
  margin: 0,
  fontWeight: 600,
  color: color.ink,
};

const detailStyle: CSSProperties = {
  margin: '2px 0 0',
  fontWeight: 600,
  fontSize: 12,
};
