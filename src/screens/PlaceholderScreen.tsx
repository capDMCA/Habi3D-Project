import { useSessionStore } from '../stores/sessionStore';
import type { ScreenName } from '../types';

interface ScreenMeta {
  title: string;
  step: number;
  description: string;
  prev: ScreenName;
  next: ScreenName | null;
}

const SCREEN_META: Record<string, ScreenMeta> = {
  roomScan: {
    title: 'Room Scan',
    step: 3,
    description:
      'WebXR plane detection will scan your room to create a floor plane for furniture placement.',
    prev: 'dimensionVerification',
    next: 'positionMap',
  },
  positionMap: {
    title: 'Position Furniture',
    step: 4,
    description:
      'Tap to place each furniture item on the AR floor plane at its current real-world position.',
    prev: 'roomScan',
    next: 'analysis',
  },
  analysis: {
    title: 'Clearance Analysis',
    step: 5,
    description:
      'The clearance engine will analyze all 10 rules and display RED / YELLOW / GREEN color zones on the AR floor.',
    prev: 'positionMap',
    next: 'recommendations',
  },
  recommendations: {
    title: 'Recommendations',
    step: 6,
    description:
      'Step-by-step sequential recommendations to fix violations, ranked by Priority Score.',
    prev: 'analysis',
    next: 'end_survey',
  },
  end_survey: {
    title: 'Post-Session Survey',
    step: 6,
    description:
      'Complete the SUS usability questionnaire and post-session survey. Responses are saved to Supabase.',
    prev: 'recommendations',
    next: 'report',
  },
  report: {
    title: 'Session Report',
    step: 6,
    description:
      'Generate and download a PDF report with all clearance findings, scores, and recommendations.',
    prev: 'end_survey',
    next: null,
  },
};

export default function PlaceholderScreen({ screenName }: { screenName: string }) {
  const navigateTo = useSessionStore((s) => s.navigateTo);
  const meta = SCREEN_META[screenName];

  if (!meta) {
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
          <button className="btn btn-secondary" style={{ maxWidth: 240 }} onClick={() => navigateTo('auth')}>
            Back to Start
          </button>
        </div>
      </div>
    );
  }

  const completedSteps = meta.step - 1;

  return (
    <div className="screen">
      {/* Header */}
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigateTo(meta.prev)} aria-label="Go back">
          ←
        </button>
        <div className="screen-header-info">
          <span className="step-label">Step {meta.step} of 6</span>
          <h2>{meta.title}</h2>
        </div>
      </div>

      {/* Progress */}
      <div className="progress-bar">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`progress-step ${
              i < completedSteps ? 'completed' : i === completedSteps ? 'active' : ''
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="placeholder-content">
        <div
          className="placeholder-icon"
          style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(31,56,100,0.08)' }}
        >
          {meta.step}
        </div>
        <h3 style={{ marginBottom: 'var(--space-sm)' }}>Coming Soon</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 280 }}>
          {meta.description}
        </p>
      </div>

      {/* Navigation */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {meta.next && (
          <button className="btn btn-primary" onClick={() => navigateTo(meta.next!)}>
            Continue
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigateTo(meta.prev)}>
          Back
        </button>
      </div>
    </div>
  );
}
