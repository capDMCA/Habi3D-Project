import { useState } from 'react';
import type { CSSProperties } from 'react';
import { MULBERRY_PLACE_2BR } from '../data/roomData';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { hasSupabaseConfig, insertParticipant, supabase, supabaseConfigMessage } from '../supabase';
import type { Violation } from '../types';

const SUS_QUESTIONS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
];

const POST_QUESTIONS = [
  'After using Habi3D, I have a better understanding of which furniture needs to be moved.',
  'After using Habi3D, I feel more confident about rearranging my furniture.',
  'I was satisfied with the step-by-step recommendations.',
  'The clearance violation information was clear and easy to understand.',
  'Overall, I am satisfied with Habi3D.',
];

function computeSusScore(values: number[]) {
  const odd = [0, 2, 4, 6, 8].reduce((sum, index) => sum + (values[index] - 1), 0);
  const even = [1, 3, 5, 7, 9].reduce((sum, index) => sum + (5 - values[index]), 0);
  return (odd + even) * 2.5;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.error_description ?? record.details ?? record.hint;
    if (typeof message === 'string') return message;

    try {
      return JSON.stringify(error);
    } catch {
      return 'An unexpected submission error occurred.';
    }
  }

  return 'An unexpected submission error occurred.';
}

function throwSupabaseError(context: string, error: unknown): never {
  throw new Error(`${context}: ${getErrorMessage(error)}`);
}

export default function EndSurveyScreen() {
  const navigateTo     = useSessionStore((s) => s.navigateTo);
  const participantId  = useSessionStore((s) => s.participantId);
  const participantCode = useSessionStore((s) => s.participantCode);
  const setParticipantId   = useSessionStore((s) => s.setParticipantId);
  const setParticipantCode = useSessionStore((s) => s.setParticipantCode);
  const recommendations = useViolationStore((s) => s.recommendations);
  const spaceScoreBefore = useViolationStore((s) => s.spaceScoreBefore);
  const spaceScoreAfter  = useViolationStore((s) => s.spaceScoreAfter);

  const [susResponses,  setSusResponses]  = useState<number[]>(Array(10).fill(0));
  const [postResponses, setPostResponses] = useState<number[]>(Array(5).fill(0));
  const [debrief, setDebrief] = useState({ q1: '', q2: '', q3: '', q4: '' });
  const [intendsToRearrange, setIntendsToRearrange] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [submitStatus, setSubmitStatus] = useState('');

  const completedSteps   = recommendations.filter((v) => v.resolved).length;
  const totalViolations  = recommendations.length;
  const improvement      = spaceScoreAfter - spaceScoreBefore;
  const susComplete      = susResponses.every((v) => v >= 1 && v <= 5);
  const postComplete     = postResponses.every((v) => v >= 1 && v <= 5);
  const missingSusCount  = susResponses.filter((v) => v < 1 || v > 5).length;
  const missingPostCount = postResponses.filter((v) => v < 1 || v > 5).length;
  const susScore         = susComplete ? computeSusScore(susResponses) : 0;
  const redRemaining     = recommendations.filter((v) => !v.resolved && v.classification === 'RED').length;
  const yellowRemaining  = recommendations.filter((v) => !v.resolved && v.classification === 'YELLOW').length;

  const sortedViolations = [...recommendations].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    const order: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    return (order[a.classification] ?? 0) - (order[b.classification] ?? 0);
  });

  async function getParticipantForSubmit() {
    if (participantId) return { id: participantId, code: participantCode || 'SESSION' };

    const generatedCode = `SESSION-${Date.now()}`;
    const id = await insertParticipant(
      generatedCode,
      MULBERRY_PLACE_2BR.building,
      MULBERRY_PLACE_2BR.unitType,
      'Android WebXR',
    );
    setParticipantId(id);
    setParticipantCode(generatedCode);
    return { id, code: generatedCode };
  }

  async function handleSubmit() {
    if (!susComplete || !postComplete) {
      setSubmitError(
        `Complete all ratings before submitting. Missing: ${missingSusCount} SUS item${missingSusCount === 1 ? '' : 's'} and ${missingPostCount} post-survey item${missingPostCount === 1 ? '' : 's'}.`,
      );
      return;
    }

    if (!hasSupabaseConfig) {
      setSubmitError(supabaseConfigMessage);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setSubmitStatus('Preparing participant record...');

    try {
      const participant = await getParticipantForSubmit();
      setSubmitStatus('Saving SUS responses...');
      const susPayload = susResponses.reduce<Record<string, number>>((payload, value, index) => {
        payload[`q${index + 1}`] = value;
        return payload;
      }, {});

      const { error: susError } = await supabase.from('sus_responses').insert({
        participant_id: participant.id,
        ...susPayload,
        sus_score: susScore,
      });
      if (susError) throwSupabaseError('SUS survey save failed', susError);

      setSubmitStatus('Saving post-survey responses...');
      const { error: postError } = await supabase.from('post_survey_responses').insert({
        participant_id: participant.id,
        spatial_awareness_improvement: postResponses[0],
        confidence_improvement:        postResponses[1],
        recommendation_satisfaction:   postResponses[2],
        report_clarity:                postResponses[3],
        overall_satisfaction:          postResponses[4],
        intends_to_rearrange:          intendsToRearrange,
        debrief_q1: debrief.q1,
        debrief_q2: debrief.q2,
        debrief_q3: debrief.q3,
        debrief_q4: debrief.q4,
      });
      if (postError) throwSupabaseError('Post-survey save failed', postError);

      setSubmitStatus('Updating space utilization score...');
      const { data: updatedRows, error: updateError } = await supabase
        .from('space_utilization_scores')
        .update({ score_after: spaceScoreAfter, improvement_points: improvement })
        .eq('participant_id', participant.id)
        .select('id');
      if (updateError) throwSupabaseError('Space score update failed', updateError);

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertScoreError } = await supabase.from('space_utilization_scores').insert({
          participant_id:    participant.id,
          score_before:      spaceScoreBefore,
          score_after:       spaceScoreAfter,
          improvement_points: improvement,
        });
        if (insertScoreError) throwSupabaseError('Space score insert failed', insertScoreError);
      }

      setSubmitted(true);
      setSubmitStatus('Session saved.');
    } catch (error) {
      console.error('Evaluation submit error:', error);
      setSubmitError(getErrorMessage(error));
      setSubmitStatus('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen" style={{ maxWidth: 640 }}>
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('recommendations')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span style={stepBadgeStyle}>Evaluation</span>
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
                transition: 'width 0.4s ease',
              }} />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9CA3AF', textAlign: 'right' }}>
              {totalViolations > 0 ? Math.round((completedSteps / totalViolations) * 100) : 0}% complete
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

      {/* ── Supabase warning ───────────────────────────────────────────────── */}
      {!hasSupabaseConfig && (
        <div className="card" style={{ borderLeft: '5px solid #F0A500', color: '#92400E' }}>
          <p style={{ margin: 0, color: '#92400E', fontWeight: 800 }}>Supabase is not connected</p>
          <p style={{ margin: '6px 0 0', color: '#92400E', fontSize: 13 }}>{supabaseConfigMessage}</p>
        </div>
      )}

      {/* ── SUS Survey ────────────────────────────────────────────────────── */}
      <SurveySection
        title="Please rate Habi3D — System Usability Scale"
        subtitle="1 = strongly disagree, 5 = strongly agree"
        questions={SUS_QUESTIONS}
        values={susResponses}
        onChange={(index, value) =>
          setSusResponses((prev) => prev.map((entry, i) => (i === index ? value : entry)))
        }
      />

      {/* ── Post-survey ───────────────────────────────────────────────────── */}
      <SurveySection
        title="Post-survey"
        subtitle="1 = strongly disagree, 5 = strongly agree"
        questions={POST_QUESTIONS}
        values={postResponses}
        onChange={(index, value) =>
          setPostResponses((prev) => prev.map((entry, i) => (i === index ? value : entry)))
        }
      />

      {/* ── Researcher debrief ────────────────────────────────────────────── */}
      <section className="card" style={{ background: '#F8FAFC' }}>
        <p className="card-title">Researcher: transcribe verbal responses below</p>
        <TextArea
          label="D1: Was there any step that confused you?"
          value={debrief.q1}
          onChange={(value) => setDebrief((prev) => ({ ...prev, q1: value }))}
        />
        <TextArea
          label="D2: Which was more useful — the AR guide or the on-screen summary?"
          value={debrief.q2}
          onChange={(value) => setDebrief((prev) => ({ ...prev, q2: value }))}
        />
        <TextArea
          label="D3: Do you plan to physically rearrange your furniture?"
          value={debrief.q3}
          onChange={(value) => setDebrief((prev) => ({ ...prev, q3: value }))}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <button
            className={intendsToRearrange ? 'btn btn-primary' : 'btn btn-secondary'}
            type="button"
            onClick={() => setIntendsToRearrange(true)}
          >
            Intends to rearrange: Yes
          </button>
          <button
            className={!intendsToRearrange ? 'btn btn-primary' : 'btn btn-secondary'}
            type="button"
            onClick={() => setIntendsToRearrange(false)}
          >
            No
          </button>
        </div>
        <TextArea
          label="D4: What would you want the app to do differently?"
          value={debrief.q4}
          onChange={(value) => setDebrief((prev) => ({ ...prev, q4: value }))}
        />
      </section>

      {/* ── Submit feedback ───────────────────────────────────────────────── */}
      {submitError && (
        <div className="card" style={{ borderLeft: '5px solid #E24B4A', color: '#991B1B' }}>
          {submitError}
        </div>
      )}

      {!submitted && (
        <div className="card card-sm" style={{ background: '#F8FAFC' }}>
          <p className="card-title">Submission checklist</p>
          <p className="card-subtitle">
            SUS: {susComplete ? 'complete' : `${missingSusCount} unanswered`} | Post-survey:{' '}
            {postComplete ? 'complete' : `${missingPostCount} unanswered`} | Supabase:{' '}
            {hasSupabaseConfig ? 'configured' : 'missing env vars'}
          </p>
          {submitStatus && (
            <p style={{ margin: '8px 0 0', color: '#1F3864', fontWeight: 800 }}>{submitStatus}</p>
          )}
        </div>
      )}

      {submitted && (
        <div className="card" style={{
          borderLeft: '5px solid #4CAF50',
          background: '#ECFDF5',
          color: '#166534',
          fontWeight: 800,
        }}>
          Session saved
        </div>
      )}

      <button
        className="btn btn-primary"
        type="button"
        onClick={handleSubmit}
        disabled={submitting || submitted}
      >
        {submitting ? submitStatus || 'Submitting evaluation...' : 'Submit evaluation'}
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
      <div style={{
        width: 9, height: 9, borderRadius: '50%',
        background: dotColor, flexShrink: 0,
      }} />
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

function SurveySection({
  title,
  subtitle,
  questions,
  values,
  onChange,
}: {
  title: string;
  subtitle: string;
  questions: string[];
  values: number[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <section className="card">
      <span style={stepBadgeStyle}>{title.includes('System') ? 'System Usability Scale' : 'Post-survey'}</span>
      <h3>{title}</h3>
      <p className="card-subtitle">{subtitle}</p>
      {questions.map((question, index) => (
        <div key={question} style={{ marginTop: 18 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 650 }}>{index + 1}. {question}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange(index, value)}
                style={{
                  minHeight: 42,
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: values[index] === value ? '#1F3864' : '#ffffff',
                  color:      values[index] === value ? '#ffffff' : '#1F3864',
                  fontWeight: 800,
                }}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function TextArea({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <label className="form-label">{label}</label>
      <textarea
        className="form-input form-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function scoreBoxStyle(bg: string, border: string): CSSProperties {
  return {
    padding: 14,
    borderRadius: 16,
    background: bg,
    border: `1px solid ${border}22`,
  };
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
