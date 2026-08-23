import { useSessionStore } from '../stores/sessionStore';

export default function EntryScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const setAuthMode = useSessionStore((s) => s.setAuthMode);

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

      {/* Authentication Gateway Card */}
      <div className="card entry-card" id="entry-card">
        <button
          id="login-btn"
          className="btn btn-primary btn-large"
          onClick={handleLogIn}
        >
          Log in
        </button>
        <p className="entry-hint">
          Access your saved layout and continue planning
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
      </div>

      <p className="entry-footer">
        A Thesis project by AAC from Mapua University - BSIT
        <br />
        © 2026 Habi3D. All rights reserved.
      </p>
    </div>
  );
}

