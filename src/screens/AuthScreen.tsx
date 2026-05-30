import { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { hasSupabaseConfig, loginUser, registerUser } from '../supabase';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

const BUILDINGS = [
  'Bengaline Tower',
  'Cochine Tower',
  'Dui Tower',
  'Marcelline',
];

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const setUserId = useSessionStore((s) => s.setUserId);
  const setUsername = useSessionStore((s) => s.setUsername);
  const setIsAdmin = useSessionStore((s) => s.setIsAdmin);

  const [mode, setMode] = useState<AuthMode>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [building, setBuilding] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function clearForm() {
    setUsernameInput('');
    setPassword('');
    setConfirmPassword('');
    setBuilding('');
    setUnitNumber('');
    setError('');
  }

  function switchMode(next: AuthMode) {
    clearForm();
    setMode(next);
  }

  async function handleLogin() {
    const trimmed = usernameInput.trim();
    if (!trimmed || !password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (trimmed === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        setUsername(ADMIN_USERNAME);
        setIsAdmin(true);
        navigateTo('admin');
        return;
      }

      if (!hasSupabaseConfig) {
        setError('Database not connected. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.');
        return;
      }

      const user = await loginUser(trimmed, password);
      if (!user) {
        setError('Incorrect username or password.');
        return;
      }

      setUserId(user.id);
      setUsername(user.username);
      setIsAdmin(false);
      navigateTo('unitSetup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const trimmed = usernameInput.trim();

    if (!trimmed || !password || !confirmPassword || !building || !unitNumber.trim()) {
      setError('All fields are required.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!hasSupabaseConfig) {
      setError('Database not connected. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await registerUser(trimmed, password, unitNumber.trim(), building);
      setUserId(user.id);
      setUsername(user.username);
      setIsAdmin(false);
      navigateTo('unitSetup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      if (mode === 'login') void handleLogin();
      else void handleRegister();
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
      <p className="entry-subtitle" style={{ marginBottom: 'var(--space-lg)' }}>
        Furniture Spatial Clearance Analysis
        <br />
        for Philippine Condominium Units
      </p>

      {/* Login / Create Account tabs */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab${mode === 'login' ? ' active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Log In
        </button>
        <button
          type="button"
          className={`auth-tab${mode === 'register' ? ' active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Create Account
        </button>
      </div>

      <div className="card entry-card" onKeyDown={handleKeyDown}>
        {/* Username */}
        <div className="form-group">
          <label className="form-label" htmlFor="auth-username">Username</label>
          <input
            id="auth-username"
            className="form-input"
            type="text"
            autoComplete="username"
            placeholder="Enter your username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
        </div>

        {/* Password */}
        <div className="form-group" style={{ marginBottom: mode === 'login' ? 0 : undefined }}>
          <label className="form-label" htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            className="form-input"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? 'Enter your password' : 'Min. 6 characters'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Register-only fields */}
        {mode === 'register' && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="auth-confirm">Confirm Password</label>
              <input
                id="auth-confirm"
                className="form-input"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="auth-building">Building</label>
              <select
                id="auth-building"
                className="form-input form-select"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              >
                <option value="">Select your building</option>
                {BUILDINGS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="auth-unit">
                Unit Number
                <span className="form-sublabel"> (e.g. 12A, 5B)</span>
              </label>
              <input
                id="auth-unit"
                className="form-input"
                type="text"
                placeholder="Enter your unit number"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
              />
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: 'var(--space-md)',
              padding: '10px 14px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        <button
          id={mode === 'login' ? 'login-btn' : 'register-btn'}
          className="btn btn-primary"
          type="button"
          style={{ marginTop: 'var(--space-md)' }}
          disabled={loading}
          onClick={mode === 'login' ? handleLogin : handleRegister}
        >
          {loading
            ? (mode === 'login' ? 'Logging in...' : 'Creating account...')
            : (mode === 'login' ? 'Log In' : 'Create Account')}
        </button>
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={{ maxWidth: 360, marginTop: 'var(--space-sm)', opacity: 0.6, fontSize: '0.875rem' }}
        onClick={() => navigateTo('arDemo')}
      >
        Test AR Capabilities
      </button>
    </div>
  );
}
