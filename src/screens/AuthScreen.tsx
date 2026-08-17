import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useFurnitureStore } from '../stores/furnitureStore';
import { MULBERRY_PLACE_2BR, MULBERRY_PLACE_2BR_ID } from '../data/roomData';
import {
  logIn,
  createAccount,
  fetchSavedSession,
  type SavedSessionRow,
} from '../supabase';

type Mode = 'login' | 'signup';
type Phase = 'form' | 'checking' | 'resumeChoice';

/**
 * Log in / create account via Supabase Auth — the username the resident
 * types is turned into a synthetic `${username}@habi3d.local` email under
 * the hood (see supabase.ts's createAccount/logIn); this screen only ever
 * shows a username field.
 *
 * Login has a second beat: if this account already has a saved layout
 * (saved_sessions, one row per user), the form is replaced by an inline
 * "Resume your last session" / "Start fresh" choice rather than silently
 * picking one — same reasoning as everywhere else the app avoids modals for
 * this kind of decision (see DownloadReportButton's inline retry).
 */
export default function AuthScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const initialMode = useSessionStore((s) => s.authMode);
  const setUser = useSessionStore((s) => s.setUser);
  const startNewSession = useSessionStore((s) => s.startNewSession);
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const setUnitTypeId = useSessionStore((s) => s.setUnitTypeId);
  const setRoomDimensions = useSessionStore((s) => s.setRoomDimensions);
  const setItems = useFurnitureStore((s) => s.setItems);
  const clearAll = useFurnitureStore((s) => s.clearAll);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [error, setError] = useState('');
  const [pendingSaved, setPendingSaved] = useState<SavedSessionRow | null>(null);

  const busy = phase === 'checking';

  /** Fixed-unit scope: dimensions come straight from roomData.ts, no picker,
   *  same source EntryScreen's anonymous path reads from. */
  function startFresh() {
    clearAll();
    startNewSession();
    navigateTo('furnitureInput');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setPhase('checking');

    try {
      if (mode === 'signup') {
        const user = await createAccount(username, password);
        setUser(user.userId, user.username);
        startFresh();
        return;
      }

      const user = await logIn(username, password);
      setUser(user.userId, user.username);

      const saved = await fetchSavedSession(user.userId);
      if (saved && saved.items.length > 0) {
        setPendingSaved(saved);
        setPhase('resumeChoice');
        return;
      }

      startFresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
      setPhase('form');
    }
  }

  function handleResume() {
    if (!pendingSaved) return;
    setItems(pendingSaved.items);
    setSessionId(pendingSaved.sessionId);
    setUnitTypeId(MULBERRY_PLACE_2BR_ID);
    setRoomDimensions({ ...MULBERRY_PLACE_2BR.defaultDimensions });
    navigateTo('recommendations');
  }

  if (phase === 'resumeChoice' && pendingSaved) {
    const savedDate = new Date(pendingSaved.updatedAt).toLocaleDateString('en-PH', {
      month: 'long',
      day: 'numeric',
    });
    return (
      <div className="screen">
        <div className="screen-header">
          <div className="screen-header-info">
            <span className="step-label">Welcome back</span>
            <h2>Pick up where you left off?</h2>
          </div>
        </div>

        <div className="card">
          <p className="card-title">You have a saved layout</p>
          <p className="card-subtitle">
            {pendingSaved.items.length} piece{pendingSaved.items.length === 1 ? '' : 's'} of furniture,
            last updated {savedDate}.
          </p>

          <button className="btn btn-primary" onClick={handleResume} style={{ marginTop: 16 }}>
            Resume your last session
          </button>
          <button className="btn btn-secondary" onClick={startFresh} style={{ marginTop: 10 }}>
            Start fresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo('entry')} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">{mode === 'login' ? 'Log in' : 'Create account'}</span>
          <h2>{mode === 'login' ? 'Welcome back' : 'Set up your account'}</h2>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={mode === 'login' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              className="form-input"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
