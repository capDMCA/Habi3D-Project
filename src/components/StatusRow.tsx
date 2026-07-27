import type { CSSProperties } from 'react';
import type { StatusKey } from './statusVocabulary';
import { statusMeta } from './statusVocabulary';

/**
 * One finding, presented calmly: a state icon, a plain-language label, and a
 * one-line detail. The canonical row shared by the drag preview and (later)
 * the Analysis list, so both read identically.
 */

export interface StatusRowProps {
  status: StatusKey;
  title: string;
  detail: string;
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

export default function StatusRow({ status, title, detail }: StatusRowProps) {
  const meta = statusMeta(status);
  return (
    <div style={rowStyle}>
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
  padding: '12px 4px',
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
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: '#1A1A2E',
  lineHeight: 1.3,
};

const detailStyle: CSSProperties = {
  margin: '2px 0 0',
  fontSize: 15,
  fontWeight: 600,
};
