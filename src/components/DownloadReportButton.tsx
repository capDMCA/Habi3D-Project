import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { downloadRoomAssessmentPdf } from './pdfReport';
import { color as t, radius } from './designTokens';
import type { FurnitureItem, Violation } from '../types';

/**
 * The "Download my report" action, as its own small state machine:
 * idle → working → success → idle (auto-settles after a couple of seconds),
 * or idle → working → error (a plain inline retry, never a modal or toast).
 *
 * Shared by ReportScreen and RecommendationScreen so both get the same
 * polish rather than two hand-rolled copies drifting apart.
 */

type DownloadState = 'idle' | 'working' | 'success' | 'error';

export interface DownloadReportButtonProps {
  items: FurnitureItem[];
  violations: Violation[];
  /** 'primary' for a screen where this is the main action; 'secondary' when
   *  it sits alongside another primary button. */
  variant?: 'primary' | 'secondary';
}

function DownloadIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v7.5M8 9.5 5 6.5M8 9.5l3-3" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12.5v.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ animation: 'dlSpin 0.8s linear infinite' }}>
      <circle cx={8} cy={8} r={6.25} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.6} />
      <path d="M14.25 8a6.25 6.25 0 0 0-6.25-6.25" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DownloadReportButton({ items, violations, variant = 'secondary' }: DownloadReportButtonProps) {
  const [state, setState] = useState<DownloadState>('idle');

  async function handleDownload() {
    setState('working');
    try {
      await downloadRoomAssessmentPdf({ items, violations });
      setState('success');
    } catch {
      setState('error');
    }
  }

  // Settle back to idle a couple of seconds after a successful download —
  // the setState here runs inside the timer callback, not synchronously in
  // the effect body, so this is the same subscribe-and-clean-up shape
  // effects are meant for.
  useEffect(() => {
    if (state !== 'success') return;
    const timer = window.setTimeout(() => setState('idle'), 2200);
    return () => window.clearTimeout(timer);
  }, [state]);

  const isPrimary = variant === 'primary';
  const busy = state === 'working';

  return (
    <div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        style={{
          ...(isPrimary ? primaryBtnStyle : secondaryBtnStyle),
          ...(state === 'success' ? successBtnStyle : null),
        }}
      >
        <span style={iconSlotStyle}>
          {state === 'working' && <Spinner />}
          {state === 'success' && <CheckIcon />}
          {(state === 'idle' || state === 'error') && <DownloadIcon />}
        </span>
        <span style={labelStyle}>
          {state === 'working' ? 'Preparing your report…' : state === 'success' ? 'Downloaded' : 'Download my report'}
        </span>
      </button>
      {state === 'error' && (
        <p style={errorTextStyle}>
          Couldn&rsquo;t build the report just now.{' '}
          <button type="button" onClick={handleDownload} style={retryLinkStyle}>
            Try again
          </button>
        </p>
      )}
    </div>
  );
}

const baseBtnStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: radius.md,
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.25s ease, border-color 0.25s ease, color 0.25s ease, transform 0.15s ease',
};

const primaryBtnStyle: CSSProperties = {
  ...baseBtnStyle,
  border: 'none',
  background: t.brand,
  color: t.surface,
  boxShadow: '0 4px 12px rgba(31, 56, 100, 0.18)',
};

const secondaryBtnStyle: CSSProperties = {
  ...baseBtnStyle,
  border: `1px solid ${t.line}`,
  background: t.surface,
  color: t.brand,
};

const successBtnStyle: CSSProperties = {
  background: t.comfortBg,
  color: t.comfortFg,
  border: `1px solid ${t.comfortFg}`,
  boxShadow: 'none',
};

const iconSlotStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  whiteSpace: 'nowrap',
};

const errorTextStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 13,
  color: t.attentionFg,
  textAlign: 'center',
};

const retryLinkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: t.attentionFg,
  fontWeight: 700,
  textDecoration: 'underline',
  cursor: 'pointer',
  font: 'inherit',
};
