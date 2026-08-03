import type { CSSProperties } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { stableViolationKey } from '../engine/violationKey';
import type { Violation } from '../types';

export default function ReportScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const recommendations = useViolationStore((s) => s.recommendations);
  const violations = useViolationStore((s) => s.violations);
  const spaceScoreBefore = useViolationStore((s) => s.spaceScoreBefore);
  const spaceScoreAfter = useViolationStore((s) => s.spaceScoreAfter);

  const activeKeys = new Set(violations.map(stableViolationKey));

  // An issue is resolved if it was present initially but is no longer in the active violations list
  const completedSteps = recommendations.filter((v) => !activeKeys.has(stableViolationKey(v))).length;
  const totalViolations = recommendations.length;
  const improvement = spaceScoreAfter - spaceScoreBefore;

  const redRemaining = violations.filter((v) => v.classification === 'RED').length;
  const yellowRemaining = violations.filter((v) => v.classification === 'YELLOW').length;

  return (
    <div className="screen" style={{ maxWidth: 640, padding: '24px 16px', margin: '0 auto' }}>
      <div className="screen-header" style={{ marginBottom: 24 }}>
        <button
          className="back-btn"
          onClick={() => navigateTo('analysis')}
          aria-label="Go back"
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', marginRight: 12 }}
        >
          ←
        </button>
        <div className="screen-header-info">
          <span style={stepBadgeStyle}>Report</span>
          <h2 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>Session Results</h2>
        </div>
      </div>

      {/* ── Utilization Score ─────────────────────────────────────────────── */}
      <section className="card" style={cardStyle}>
        <span style={stepBadgeStyle}>Space Utilization</span>
        <h3 style={{ margin: '8px 0 14px', fontSize: 18, fontWeight: 700 }}>Before vs After</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={scoreBoxStyle('#FEF2F2', '#E24B4A')}>
            <p className="info-label" style={infoLabelStyle}>BEFORE</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#E24B4A', lineHeight: 1 }}>
              {spaceScoreBefore.toFixed(1)}%
            </p>
            <BarTrack value={spaceScoreBefore} color="#E24B4A" />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6B7280' }}>free floor area</p>
          </div>

          <div style={scoreBoxStyle('#F0FDF4', '#4CAF50')}>
            <p className="info-label" style={infoLabelStyle}>AFTER</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#4CAF50', lineHeight: 1 }}>
              {spaceScoreAfter.toFixed(1)}%
            </p>
            <BarTrack value={spaceScoreAfter} color="#4CAF50" />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6B7280' }}>free floor area</p>
          </div>
        </div>

        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 12,
          background: improvement >= 0 ? '#F0FDF4' : '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: improvement >= 0 ? '#4CAF50' : '#E24B4A' }}>
            {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)} pts
          </span>
          <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>free floor area gained this session</span>
        </div>
      </section>

      {/* ── Clearance Issues ──────────────────────────────────────────────── */}
      <section className="card" style={cardStyle}>
        <span style={stepBadgeStyle}>Clearance Status</span>
        <h3 style={{ margin: '8px 0 4px', fontSize: 18, fontWeight: 700 }}>
          {completedSteps} of {totalViolations} issues resolved
        </h3>
        <p style={{ marginTop: 4, marginBottom: 16, color: '#4B5563', fontSize: 14 }}>
          {totalViolations === 0
            ? 'No clearance violations were detected.'
            : completedSteps === totalViolations
              ? 'All clearance violations have been addressed.'
              : `${redRemaining > 0 ? `${redRemaining} critical` : ''}${redRemaining > 0 && yellowRemaining > 0 ? ' and ' : ''}${yellowRemaining > 0 ? `${yellowRemaining} moderate` : ''} issues remaining`}
        </p>

        {totalViolations > 0 && (
          <div style={{ height: 8, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              borderRadius: 99,
              background: completedSteps === totalViolations ? '#4CAF50' : '#1F3864',
              width: `${(completedSteps / totalViolations) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        )}
      </section>

      {/* ── Final Status per Rule ────────────────────────────────────────── */}
      {totalViolations > 0 && (
        <section className="card" style={cardStyle}>
          <span style={stepBadgeStyle}>Rule Analysis</span>
          <h3 style={{ margin: '8px 0 4px', fontSize: 18, fontWeight: 700 }}>Clearance results per rule</h3>
          <p style={{ marginTop: 0, marginBottom: 16, color: '#6B7280', fontSize: 13 }}>
            Unresolved issues shown first
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recommendations.map((v) => {
              const isResolved = !activeKeys.has(stableViolationKey(v));
              return (
                <ViolationRow key={v.id} violation={v} isResolved={isResolved} />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => {
            navigateTo('entry');
          }}
          style={primaryBtnStyle}
        >
          Finish and Exit
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => navigateTo('analysis')}
          style={secondaryBtnStyle}
        >
          Back to Layout Workspace
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BarTrack({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div style={{ height: 6, borderRadius: 99, background: '#E5E7EB', marginTop: 12, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%` }} />
    </div>
  );
}

function ViolationRow({ violation: v, isResolved }: { violation: Violation; isResolved: boolean }) {
  const badgeLabel = isResolved ? 'CLEAR' : v.classification;
  const badgeColor = isResolved ? '#047857' : v.classification === 'RED' ? '#DC2626' : '#B45309';
  const badgeBg = isResolved ? '#E7F4EF' : v.classification === 'RED' ? '#FEECEC' : '#FBF1E4';
  const dotColor = isResolved ? '#047857' : v.classification === 'RED' ? '#DC2626' : '#B45309';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid #E2E8F0',
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1F3864', minWidth: 40, flexShrink: 0 }}>
        {v.ruleCode}
      </span>
      <span style={{ flex: 1, fontSize: 14, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {v.furnitureLabel}
      </span>
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: badgeColor,
        background: badgeBg,
        padding: '4px 12px',
        borderRadius: 20,
        flexShrink: 0,
      }}>
        {badgeLabel}
      </span>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 16,
  padding: 20,
  marginBottom: 20,
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
};

const infoLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7280',
  letterSpacing: '0.05em',
  margin: '0 0 6px',
};

const primaryBtnStyle: CSSProperties = {
  background: '#1F3864',
  color: '#FFFFFF',
  border: 'none',
  padding: '14px 24px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 16,
  cursor: 'pointer',
  textAlign: 'center',
  boxShadow: '0 4px 12px rgba(31, 56, 100, 0.15)',
};

const secondaryBtnStyle: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #CBD5E1',
  color: '#4B5563',
  padding: '14px 24px',
  borderRadius: 12,
  fontWeight: 600,
  fontSize: 16,
  cursor: 'pointer',
  textAlign: 'center',
};

function scoreBoxStyle(bg: string, border: string): CSSProperties {
  return {
    padding: 16,
    borderRadius: 16,
    background: bg,
    border: `1px solid ${border}22`,
    display: 'flex',
    flexDirection: 'column',
  };
}

const stepBadgeStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  color: '#1F3864',
  backgroundColor: '#E6EDF8',
  padding: '4px 12px',
  borderRadius: 20,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
