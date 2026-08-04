import { useSessionStore } from '../stores/sessionStore';

/**
 * Defensive fallback only — every value in the ScreenName union is handled
 * directly in App.tsx's switch, so this only renders if currentScreen ever
 * holds something outside that union (e.g. corrupted state).
 */
export default function PlaceholderScreen({ screenName }: { screenName: string }) {
  const navigateTo = useSessionStore((s) => s.navigateTo);

  return (
    <div className="screen">
      <div className="placeholder-content">
        <div
          className="placeholder-icon"
          style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-alt)' }}
        >
          ?
        </div>
        <h3>Unknown Screen</h3>
        <p className="card-subtitle" style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
          Screen <code>{screenName}</code> is not recognised.
        </p>
        <button className="btn btn-secondary" style={{ maxWidth: 240 }} onClick={() => navigateTo('sessionStart')}>
          Back to Start
        </button>
      </div>
    </div>
  );
}
