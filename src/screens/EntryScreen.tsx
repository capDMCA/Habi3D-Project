import { useSessionStore } from '../stores/sessionStore';

export default function EntryScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const startNewSession = useSessionStore((s) => s.startNewSession);
  const setAuthMode = useSessionStore((s) => s.setAuthMode);

  function handleBegin() {
    // Anonymous session — no account, no login, nothing saved but an id.
    // Single-unit scope: dimensions come from the fixed Mulberry Place
    // config, no picker screen.
    startNewSession();
    navigateTo('furnitureInput');
  }

  function handleLogIn() {
    setAuthMode('login');
    navigateTo('auth');
  }

  function handleCreateAccount() {
    setAuthMode('signup');
    navigateTo('auth');
  }

  return (
    <div className="screen entry-screen">
      <h1 className="entry-title">Habi3D</h1>
      <p className="entry-subtitle">
        Furniture clearance planning, built for Mulberry Place residents
      </p>

      {/* Start Session Card */}
      <div className="card entry-card" id="entry-card">
        <button
          id="begin-session-btn"
          className="btn btn-primary btn-large"
          onClick={handleBegin}
        >
          Begin Session
        </button>
        <p className="entry-hint">
          Try it now — nothing is saved unless you have an account
        </p>

        <div className="entry-divider"><span>or</span></div>

        <button
          id="create-account-btn"
          className="btn btn-secondary"
          onClick={handleCreateAccount}
        >
          Create account
        </button>
        <p className="entry-hint">
          Save your layout and pick up where you left off
        </p>

        <button
          id="login-btn"
          className="entry-link"
          onClick={handleLogIn}
        >
          Already have an account? <span className="entry-link-strong">Log in</span>
        </button>
      </div>

      <p className="entry-footer">
        A Thesis project by AAC from Mapua University - BSIT
        <br />
        © 2026 Habi3D. All rights reserved.
      </p>
    </div>
  );
}
