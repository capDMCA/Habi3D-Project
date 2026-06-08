import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { MULBERRY_PLACE_2BR } from '../data/roomData';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';
import { useViolationStore } from '../stores/violationStore';
import { hasSupabaseConfig, insertParticipant, supabase, supabaseConfigMessage } from '../supabase';
import type { RoomDimensions } from '../types';
import { drawFloorPlan } from '../utils/floorPlan';
import { generateReport } from '../utils/pdfExport';

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

function getRoomDimensions(roomDimensions: RoomDimensions | null) {
  if (!roomDimensions) return { roomWidthCm: 360, roomLengthCm: 520 };
  return {
    roomWidthCm: Math.max(roomDimensions.livingWidthCm, roomDimensions.diningWidthCm),
    roomLengthCm: roomDimensions.livingDepthCm + roomDimensions.diningDepthCm,
  };
}

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
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const participantId = useSessionStore((s) => s.participantId);
  const participantCode = useSessionStore((s) => s.participantCode);
  const setParticipantId = useSessionStore((s) => s.setParticipantId);
  const setParticipantCode = useSessionStore((s) => s.setParticipantCode);
  const roomDimensions = useSessionStore((s) => s.roomDimensions);
  const items = useFurnitureStore((s) => s.items);
  const recommendations = useViolationStore((s) => s.recommendations);
  const spaceScoreBefore = useViolationStore((s) => s.spaceScoreBefore);
  const spaceScoreAfter = useViolationStore((s) => s.spaceScoreAfter);
  const [susResponses, setSusResponses] = useState<number[]>(Array(10).fill(0));
  const [postResponses, setPostResponses] = useState<number[]>(Array(5).fill(0));
  const [debrief, setDebrief] = useState({ q1: '', q2: '', q3: '', q4: '' });
  const [intendsToRearrange, setIntendsToRearrange] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAfterRef = useRef<HTMLCanvasElement>(null);
  const [floorPlanDataUrl, setFloorPlanDataUrl] = useState('');
  const [floorPlanAfterDataUrl, setFloorPlanAfterDataUrl] = useState('');
  const { roomWidthCm, roomLengthCm } = getRoomDimensions(roomDimensions);
  const completedSteps = recommendations.filter((violation) => violation.resolved).length;
  const improvement = spaceScoreAfter - spaceScoreBefore;
  const susComplete = susResponses.every((value) => value >= 1 && value <= 5);
  const postComplete = postResponses.every((value) => value >= 1 && value <= 5);
  const missingSusCount = susResponses.filter((value) => value < 1 || value > 5).length;
  const missingPostCount = postResponses.filter((value) => value < 1 || value > 5).length;
  const susScore = susComplete ? computeSusScore(susResponses) : 0;

  useEffect(() => {
    if (!canvasRef.current) return;
    drawFloorPlan(canvasRef.current, items, recommendations, roomWidthCm, roomLengthCm);
    setFloorPlanDataUrl(canvasRef.current.toDataURL('image/png'));

    if (!canvasAfterRef.current) return;
    const unresolvedViolations = recommendations.filter((v) => !v.resolved);
    drawFloorPlan(canvasAfterRef.current, items, unresolvedViolations, roomWidthCm, roomLengthCm);
    setFloorPlanAfterDataUrl(canvasAfterRef.current.toDataURL('image/png'));
  }, [items, recommendations, roomLengthCm, roomWidthCm]);

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
        confidence_improvement: postResponses[1],
        recommendation_satisfaction: postResponses[2],
        report_clarity: postResponses[3],
        overall_satisfaction: postResponses[4],
        intends_to_rearrange: intendsToRearrange,
        debrief_q1: debrief.q1,
        debrief_q2: debrief.q2,
        debrief_q3: debrief.q3,
        debrief_q4: debrief.q4,
      });
      if (postError) throwSupabaseError('Post-survey save failed', postError);

      setSubmitStatus('Updating space utilization score...');
      const { data: updatedRows, error: updateError } = await supabase
        .from('space_utilization_scores')
        .update({
          score_after: spaceScoreAfter,
          improvement_points: improvement,
        })
        .eq('participant_id', participant.id)
        .select('id');
      if (updateError) throwSupabaseError('Space score update failed', updateError);

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertScoreError } = await supabase.from('space_utilization_scores').insert({
          participant_id: participant.id,
          score_before: spaceScoreBefore,
          score_after: spaceScoreAfter,
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

  function handleDownload() {
    generateReport({
      participantCode: participantCode || 'SESSION',
      building: MULBERRY_PLACE_2BR.building,
      unitType: MULBERRY_PLACE_2BR.unitType,
      sessionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      spaceScoreBefore,
      spaceScoreAfter,
      violations: recommendations,
      stepsCompleted: completedSteps,
      totalViolations: recommendations.length,
      floorPlanDataUrl,
      floorPlanAfterDataUrl,
    });
  }

  return (
    <div className="screen" style={{ maxWidth: 640 }}>
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('recommendations')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span style={stepBadgeStyle}>Evaluation</span>
          <h2>Session Survey</h2>
        </div>
      </div>

      <section className="card">
        <p className="card-title">Results</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <ScoreBox label="Before" value={spaceScoreBefore} color="#E24B4A" />
          <ScoreBox label="After" value={spaceScoreAfter} color="#4CAF50" />
        </div>
        <p style={{ margin: '14px 0 0', color: '#166534', fontWeight: 800 }}>
          {improvement >= 0 ? '+' : ''}{improvement.toFixed(1)}% free floor area gained
        </p>
        <p className="card-subtitle" style={{ marginTop: 8 }}>
          {completedSteps} of {recommendations.length} violations resolved
        </p>
      </section>

      <button
        className="btn btn-secondary"
        type="button"
        onClick={handleDownload}
        style={{ marginTop: 4, width: '100%' }}
      >
        Download PDF Report
      </button>

      {!hasSupabaseConfig && (
        <div className="card" style={{ borderLeft: '5px solid #F0A500', color: '#92400E' }}>
          <p style={{ margin: 0, color: '#92400E', fontWeight: 800 }}>Supabase is not connected</p>
          <p style={{ margin: '6px 0 0', color: '#92400E', fontSize: 13 }}>{supabaseConfigMessage}</p>
        </div>
      )}

      <SurveySection
        title="Please rate Habi3D — System Usability Scale"
        subtitle="1 = strongly disagree, 5 = strongly agree"
        questions={SUS_QUESTIONS}
        values={susResponses}
        onChange={(index, value) =>
          setSusResponses((prev) => prev.map((entry, i) => (i === index ? value : entry)))
        }
      />

      <SurveySection
        title="Post-survey"
        subtitle="1 = strongly disagree, 5 = strongly agree"
        questions={POST_QUESTIONS}
        values={postResponses}
        onChange={(index, value) =>
          setPostResponses((prev) => prev.map((entry, i) => (i === index ? value : entry)))
        }
      />

      <section className="card" style={{ background: '#F8FAFC' }}>
        <p className="card-title">Researcher: transcribe verbal responses below</p>
        <TextArea label="D1: Was there any step that confused you?" value={debrief.q1} onChange={(value) => setDebrief((prev) => ({ ...prev, q1: value }))} />
        <TextArea label="D2: Which was more useful — the AR guide or the report?" value={debrief.q2} onChange={(value) => setDebrief((prev) => ({ ...prev, q2: value }))} />
        <TextArea label="D3: Do you plan to physically rearrange your furniture?" value={debrief.q3} onChange={(value) => setDebrief((prev) => ({ ...prev, q3: value }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <button className={intendsToRearrange ? 'btn btn-primary' : 'btn btn-secondary'} type="button" onClick={() => setIntendsToRearrange(true)}>
            Intends to rearrange: Yes
          </button>
          <button className={!intendsToRearrange ? 'btn btn-primary' : 'btn btn-secondary'} type="button" onClick={() => setIntendsToRearrange(false)}>
            No
          </button>
        </div>
        <TextArea label="D4: What would you want the app to do differently?" value={debrief.q4} onChange={(value) => setDebrief((prev) => ({ ...prev, q4: value }))} />
      </section>

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
          {submitStatus && <p style={{ margin: '8px 0 0', color: '#1F3864', fontWeight: 800 }}>{submitStatus}</p>}
        </div>
      )}

      {submitted && (
        <div className="card" style={{ borderLeft: '5px solid #4CAF50', background: '#ECFDF5', color: '#166534', fontWeight: 800 }}>
          Session saved
        </div>
      )}

      <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={submitting || submitted}>
        {submitting ? submitStatus || 'Submitting evaluation...' : 'Submit evaluation'}
      </button>

      <canvas ref={canvasRef} style={{ display: 'none' }} width={720} height={520} />
      <canvas ref={canvasAfterRef} style={{ display: 'none' }} width={720} height={520} />
    </div>
  );
}

function ScoreBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 16, border: '1px solid var(--border)' }}>
      <p className="info-label">{label}</p>
      <p style={{ margin: 0, fontSize: 28, color, fontWeight: 800 }}>{value.toFixed(1)}%</p>
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
                  color: values[index] === value ? '#ffffff' : '#1F3864',
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ marginTop: 16 }}>
      <label className="form-label">{label}</label>
      <textarea className="form-input form-textarea" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
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
