import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { fontFamily } from './tokens';

interface Props {
  children: ReactNode;
  /** Shown instead of the default error card when a child throws. Pass `null`
   *  to render nothing (e.g. to isolate an optional AR canvas). */
  fallback?: ReactNode | ((error: Error) => ReactNode);
  /** Optional label so a caught error names where it happened. */
  where?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree and shows them ON SCREEN rather
 * than letting React unmount to a blank page. Fail loudly, not silently — this
 * is a diagnostic surface, not a way to hide failures.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Habi3D] error in ${this.props.where ?? 'app'}:`, error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback(error);
    if (fallback !== undefined) return fallback;

    return (
      <div style={wrap}>
        <h2 style={heading}>Something went wrong</h2>
        <p style={{ margin: '0 0 12px', color: '#374151', fontSize: 14 }}>
          {this.props.where ? `in ${this.props.where}` : ''}
        </p>
        <pre style={pre}>{error.message}{'\n\n'}{error.stack}</pre>
        <button style={btn} onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

const wrap = {
  padding: 20,
  maxWidth: 640,
  margin: '0 auto',
  fontFamily,
} as const;

const heading = { color: '#b91c1c', fontSize: 20, margin: '8px 0' } as const;

const pre = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 12,
  lineHeight: 1.5,
  background: '#fef2f2',
  color: '#7f1d1d',
  border: '1px solid #fecaca',
  padding: 12,
  borderRadius: 8,
  overflowX: 'auto',
} as const;

const btn = {
  marginTop: 14,
  padding: '10px 18px',
  borderRadius: 10,
  border: 0,
  background: '#1F3864',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
} as const;
