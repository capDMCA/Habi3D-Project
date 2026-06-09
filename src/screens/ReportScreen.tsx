import type { CSSProperties } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import type { Violation } from '../types';

export default function ReportScreen() {
  const navigateTo      = useSessionStore((s) => s.navigateTo);
  const recommendations = useViolationStore((s) => s.recommendations);
  const spaceScoreBefore = useViolationStore((s) => s.spaceScoreBefore);
  const spaceScoreAfter  = useViolationStore((s) => s.spaceScoreAfter);

  const completedSteps   = recommendations.filter((v) => v.resolved).length;
  const totalViolations  = recommendations.length;
  const improvement      = spaceScoreAfter - spaceScoreBefore;
  const redRemaining     = recommendations.filter((v) => !v.resolved && v.classification === 'RED').length;
  const yellowRemaining  = recommendations.filter((v) => !v.resolved && v.classification === 'YELLOW').length;

  const sortedViolations = [...recommendations].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    const order: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    return (order[a.classification] ?? 0) - (order[b.classification] ?? 0);
  });

  return (
    <div className="screen" style={{ maxWidth: 640 }}>
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('recommendations')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span style={stepBadgeStyle}>Report</span>
          <h2>Session Results</h2>
        </div>
      </div>

      {/* ── SECTION 1: Space Utilization Score ─────────────────────────────── */}
      <section className="card">
        <span style={stepBadgeStyle}>Space Utilization</span>
        <h3 style={{ margin: '8px 0 14px' }}>Before vs After</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={scoreBoxStyle('#FEF2F2', '#E24B4A')}>
            <p className="info-label" style={{ marginBottom: 4 }}>BEFORE</p>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#E24B4A', lineHeight: 1 }}>
              {spaceScoreBefore.toFixed(1)}%
            </p>
            <BarTrack value={spaceScoreBefore} color="#E24B4A" />
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9CA3AF' }}>free floor area</p>
          </div>

          <div style={scoreBoxStyle('#F0FDF4', '#4CAF50')}>
            <p className="info-label" style={{ marginBottom: 4 }}>AFTER</p>
            <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#4CAF50', lineHeight: 1 }}>
              {spaceScoreAfter.toFixed(1)}%
            </p>
            <BarTrack value={spaceScoreAfter} color="#4CAF50" />
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9CA3AF' }}>free floor area</p>
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          borderRadius: 12,
          background: improvement >= 0 ? '#F0FDF4' : '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: improvement >= 0 ? '#4CAF50' : '#E24B4A' }}>
            {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)} pts
          </span>
          <span style={{ fontSize: 13, color: '#374151' }}>free floor area gained this session</span>
        </div>
      </section>

      {/* ── SECTION 2: Violations Resolved ─────────────────────────────────── */}
      <section className="card">
        <span style={stepBadgeStyle}>Clearance Violations</span>
        <h3 style={{ margin: '8px 0 4px' }}>
          {completedSteps} of {totalViolations} issues resolved
        </h3>
        <p className="card-subtitle" style={{ marginTop: 0, marginBottom: 14 }}>
          {totalViolations === 0
            ? 'No clearance violations were detected.'
            : completedSteps === totalViolations
              ? 'All clearance violations have been addressed.'
              : `${redRemaining > 0 ? `${redRemaining} critical` : ''}${redRemaining > 0 && yellowRemaining > 0 ? ' · ' : ''}${yellowRemaining > 0 ? `${yellowRemaining} moderate` : ''} remaining`}
        </p>

        {totalViolations > 0 && (
          <>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                borderRadius: 99,
                background: completedSteps === totalViolations ? '#4CAF50' : '#1F3864',
                width: `${totalViolations > 0 ? (completedSteps / totalViolations) * 100 : 0}%`,
              }} />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
              {Math.round((completedSteps / totalViolations) * 100)}% complete
            </p>
          </>
        )}
      </section>

      {/* ── SECTION 3: Final Clearance Status ──────────────────────────────── */}
      {totalViolations > 0 && (
        <section className="card">
          <span style={stepBadgeStyle}>Final Clearance Status</span>
          <h3 style={{ margin: '8px 0 4px' }}>Clearance results per rule</h3>
          <p className="card-subtitle" style={{ marginTop: 0, marginBottom: 12 }}>
            Critical issues shown first
          </p>
          <div>
            {sortedViolations.map((v) => (
              <ViolationRow key={v.id} violation={v} />
            ))}
          </div>
        </section>
      )}

      <button
        className="btn btn-secondary"
        type="button"
        onClick={() => navigateTo('analysis')}
        style={{ marginTop: 8 }}
      >
        Back to Analysis
      </button>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BarTrack({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ height: 5, borderRadius: 99, background: '#E5E7EB', marginTop: 10, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%` }} />
    </div>
  );
}

function ViolationRow({ violation: v }: { violation: Violation }) {
  const isResolved = v.resolved;
  const badgeLabel = isResolved ? 'CLEAR' : v.classification;
  const badgeColor = isResolved ? '#4CAF50' : v.classification === 'RED' ? '#E24B4A' : '#F0A500';
  const badgeBg    = isResolved ? '#DCFCE7' : v.classification === 'RED' ? '#FEF2F2' : '#FFFBEB';
  const dotColor   = isResolved ? '#4CAF50' : v.classification === 'RED' ? '#E24B4A' : '#F0A500';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1F3864', minWidth: 30, flexShrink: 0 }}>
        {v.ruleCode}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {v.furnitureLabel}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: badgeColor, background: badgeBg,
        padding: '3px 10px', borderRadius: 20, flexShrink: 0,
      }}>
        {badgeLabel}
      </span>
    </div>
  );
}

function scoreBoxStyle(bg: string, border: string): CSSProperties {
  return { padding: 14, borderRadius: 16, background: bg, border: `1px solid ${border}22` };
}

const stepBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 600,
  color: '#1F3864',
  backgroundColor: '#e6edf8',
  padding: '3px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
