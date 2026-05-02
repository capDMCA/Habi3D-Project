import { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { insertPreSurvey } from '../supabase';
import type { PreSurveyData } from '../types';

const RESIDENCY_OPTIONS = [
  'Less than 6 months',
  '6 months – 1 year',
  '1–2 years',
  '2–3 years',
  'More than 3 years',
];

const FREQUENCY_OPTIONS = [
  'Never',
  'Rarely (once a year or less)',
  'Sometimes (2–3 times a year)',
  'Often (monthly or more)',
];

const PRIOR_APP_OPTIONS = [
  'Yes, I have used a furniture/interior design app',
  'No, I have never used one',
];

export default function PreSurveyScreen() {
  const participantId = useSessionStore((s) => s.participantId);
  const navigateTo = useSessionStore((s) => s.navigateTo);

  const [form, setForm] = useState<PreSurveyData>({
    residencyLength: '',
    rearrangementFrequency: '',
    priorAppUse: '',
    baselineConfidence: 0,
    baselineStandardAwareness: 0,
    mainFrustration: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isComplete =
    form.residencyLength &&
    form.rearrangementFrequency &&
    form.priorAppUse &&
    form.baselineConfidence > 0 &&
    form.baselineStandardAwareness > 0;

  function update<K extends keyof PreSurveyData>(key: K, value: PreSurveyData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!isComplete) return;
    setLoading(true);
    setError('');

    try {
      if (participantId) {
        await insertPreSurvey(participantId, form);
      }
      navigateTo('unitSetup');
    } catch (err) {
      console.error('Pre-survey save error:', err);
      // Proceed anyway for offline/demo usage
      navigateTo('unitSetup');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('entry')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step 1 of 7</span>
          <h2>Pre-Session Survey</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        <div className="progress-step active" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
        <div className="progress-step" />
      </div>

      {/* Q1: Residency Length */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">
            How long have you been living in your current unit?
          </label>
          <div className="option-group">
            {RESIDENCY_OPTIONS.map((opt) => (
              <div
                key={opt}
                className={`option-item ${form.residencyLength === opt ? 'selected' : ''}`}
                onClick={() => update('residencyLength', opt)}
              >
                <input
                  type="radio"
                  name="residency"
                  checked={form.residencyLength === opt}
                  onChange={() => update('residencyLength', opt)}
                />
                <label>{opt}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Q2: Rearrangement Frequency */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">
            How often do you rearrange furniture in your living/dining area?
          </label>
          <div className="option-group">
            {FREQUENCY_OPTIONS.map((opt) => (
              <div
                key={opt}
                className={`option-item ${form.rearrangementFrequency === opt ? 'selected' : ''}`}
                onClick={() => update('rearrangementFrequency', opt)}
              >
                <input
                  type="radio"
                  name="frequency"
                  checked={form.rearrangementFrequency === opt}
                  onChange={() => update('rearrangementFrequency', opt)}
                />
                <label>{opt}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Q3: Prior App Use */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">
            Have you previously used a furniture or interior design app?
          </label>
          <div className="option-group">
            {PRIOR_APP_OPTIONS.map((opt) => (
              <div
                key={opt}
                className={`option-item ${form.priorAppUse === opt ? 'selected' : ''}`}
                onClick={() => update('priorAppUse', opt)}
              >
                <input
                  type="radio"
                  name="priorApp"
                  checked={form.priorAppUse === opt}
                  onChange={() => update('priorAppUse', opt)}
                />
                <label>{opt}</label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Q4: Baseline Confidence */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">
            How confident are you in your current furniture arrangement?
          </label>
          <div className="likert-labels">
            <span>Not at all</span>
            <span>Very confident</span>
          </div>
          <div className="likert-group">
            {[1, 2, 3, 4, 5].map((val) => (
              <div className="likert-item" key={val}>
                <input
                  type="radio"
                  name="confidence"
                  checked={form.baselineConfidence === val}
                  onChange={() => update('baselineConfidence', val)}
                />
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Q5: Baseline Standard Awareness */}
      <div className="card">
        <div className="form-group">
          <label className="form-label">
            How aware are you of interior design clearance standards?
          </label>
          <div className="likert-labels">
            <span>Not at all</span>
            <span>Very aware</span>
          </div>
          <div className="likert-group">
            {[1, 2, 3, 4, 5].map((val) => (
              <div className="likert-item" key={val}>
                <input
                  type="radio"
                  name="awareness"
                  checked={form.baselineStandardAwareness === val}
                  onChange={() => update('baselineStandardAwareness', val)}
                />
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Q6: Main Frustration (optional) */}
      <div className="card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">
            What is your main frustration with furniture arrangement?{' '}
            <span className="form-sublabel">(optional)</span>
          </label>
          <textarea
            className="form-input form-textarea"
            placeholder="e.g. Not enough space between the sofa and the wall…"
            value={form.mainFrustration}
            onChange={(e) => update('mainFrustration', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}>
          <p style={{ color: 'var(--danger)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        id="pre-survey-submit-btn"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={!isComplete || loading}
        style={{ marginTop: 'var(--space-sm)' }}
      >
        {loading ? 'Saving…' : 'Submit & Continue'}
      </button>
    </div>
  );
}
