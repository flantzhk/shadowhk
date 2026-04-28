import React from 'react';
import { logger } from '../../utils/logger.js';

export class ErrorBoundary extends React.Component {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(err, info) {
    logger.error('[ErrorBoundary] render crash', err?.message, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.crashed) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', padding: 40,
          color: 'var(--fg-0)', fontFamily: 'var(--font-ui)', textAlign: 'center', gap: 16,
        }}>
          <p style={{ fontSize: 17, margin: 0 }}>Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', background: 'var(--accent)', color: 'var(--accent-dark)',
              border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
