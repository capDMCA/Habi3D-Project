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
        for Mulberry Place residents
      </p>

      {/* Start Session Card */}
      <div className="card entry-card" id="entry-card">
        <button
          id="begin-session-btn"
          className="btn btn-primary"
          onClick={handleBegin}
        >
          Begin Session
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 2px' }}>
          Try it now — nothing is saved unless you have an account
        </p>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            id="login-btn"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleLogIn}
          >
            Log in
          </button>
          <button
            id="create-account-btn"
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleCreateAccount}
          >
            Create account
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>
          An account lets you leave and pick up where you left off
        </p>
      </div>


      <p className="entry-footer">
        A Thesis project by AAC from Mapua University - BSIT <a target="_blank" rel="noopener noreferrer">
         </a>
        <br />
        © 2026 Habi3D. All rights reserved.
      </p>
    </div>
  );
}
