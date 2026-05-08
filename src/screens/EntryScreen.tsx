import { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { insertParticipant } from '../supabase';

export default function EntryScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setParticipantCode = useSessionStore((s) => s.setParticipantCode);
  const setParticipantId = useSessionStore((s) => s.setParticipantId);
  const navigateTo = useSessionStore((s) => s.navigateTo);

  const isValidCode = /^P(0[1-9]|[12]\d|30)$/i.test(code.trim());

  async function handleBegin() {
    const trimmed = code.trim().toUpperCase();
    if (!isValidCode) {
      setError('Enter a valid participant code (P01–P30)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const id = await insertParticipant(
        trimmed,
        'Mulberry Place',
        '2-Bedroom Mid-Rise',
        'TBD', // captured later or during session
      );
      setParticipantCode(trimmed);
      setParticipantId(id);
      navigateTo('preSurvey');
    } catch (err) {
      console.error('Supabase insert error:', err);
      // Allow offline/demo usage — proceed without DB
      setParticipantCode(trimmed);
      navigateTo('preSurvey');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen entry-screen">
      {/* Logo */}
      <div className="entry-logo">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="18" width="28" height="16" rx="2" stroke="white" strokeWidth="2.5" fill="none" />
          <path d="M12 18V10a8 8 0 0 1 16 0v8" stroke="white" strokeWidth="2.5" fill="none" />
          <rect x="14" y="22" width="5" height="8" rx="1" fill="white" opacity="0.6" />
          <rect x="21" y="22" width="5" height="8" rx="1" fill="white" opacity="0.6" />
        </svg>
      </div>

      <h1 className="entry-title">Habi3D</h1>
      <p className="entry-subtitle">
        Furniture Spatial Clearance Analysis for Philippine Condominium Units
      </p>

      {/* Participant Code Card */}
      <div className="card entry-card" id="entry-card">
        <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
          <label className="form-label" htmlFor="participant-code">
            Participant Code
          </label>
          <input
            id="participant-code"
            className="form-input"
            type="text"
            placeholder="e.g. P01"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleBegin()}
            maxLength={3}
            autoComplete="off"
            style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.1em' }}
          />
          {error && <p className="form-error">{error}</p>}
        </div>

        <button
          id="begin-session-btn"
          className="btn btn-primary"
          onClick={handleBegin}
          disabled={!code.trim() || loading}
        >
          {loading ? 'Setting up…' : 'Begin Session'}
        </button>
      </div>

      {/* Demo Mode — quick test without Supabase */}
      <button
        id="demo-session-btn"
        className="btn btn-secondary"
        style={{ maxWidth: 360, marginTop: 'var(--space-sm)', opacity: 0.7 }}
        onClick={() => {
          setParticipantCode('P00');
          navigateTo('unitSetup');
        }}
      >
        🧪 Start Demo Session
      </button>

      {/* AR Test — verify WebXR works on device */}
      <button
        id="ar-test-btn"
        className="btn btn-secondary"
        style={{ maxWidth: 360, marginTop: 'var(--space-xs)', opacity: 0.7 }}
        onClick={() => navigateTo('arDemo')}
      >
        📱 Test AR Capabilities
      </button>

      <p className="entry-footer">
        Mulberry Place · Acacia Estates · Taguig City
        <br />
        Researcher-administered evaluation session
      </p>
    </div>
  );
}
