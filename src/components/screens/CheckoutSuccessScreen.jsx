// src/components/screens/CheckoutSuccessScreen.jsx
// Shown when user returns from Stripe with ?checkout=success

import { useEffect, useState } from 'react';
import { ROUTES } from '../../utils/constants';
import { logEvent } from '../../services/analytics';
import { phCapture } from '../../services/posthog';

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";

const PLAN_LABELS = {
  monthly:  'Monthly Pro',
  annual:   'Annual Pro',
  lifetime: 'Lifetime Access',
  family:   'Family Plan',
};

export default function CheckoutSuccessScreen({ onDone }) {
  const [visible, setVisible] = useState(false);

  const planId    = localStorage.getItem('ss_pending_plan') || 'annual';
  const planLabel = PLAN_LABELS[planId] || 'Pro';

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 80);
    // Log subscription event before clearing the plan key
    logEvent('subscription_started', { plan: planId });
    phCapture('subscription_started', { plan: planId });
    // Clean up pending plan key
    localStorage.removeItem('ss_pending_plan');
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = () => {
    if (onDone) {
      onDone();
    } else {
      window.location.hash = `#${ROUTES.HOME}`;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A2A18',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 28px',
      fontFamily: FONT,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(16px)',
      transition: 'opacity 400ms ease, transform 400ms ease',
    }}>
      {/* Checkmark */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: '#C5E85A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
        fontSize: '2rem',
      }}>
        {'✓'}
      </div>

      {/* Wordmark */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>Shadow</span>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#C5E85A' }}>Speak</span>
      </div>

      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 800,
        color: 'white',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        You're in.
      </h1>

      <p style={{
        fontSize: '1rem',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 1.6,
      }}>
        {planLabel} is active on your account.
        Start your first lesson and hear the difference.
      </p>

      {/* Plan badge */}
      <div style={{
        marginTop: 24,
        background: 'rgba(197,232,90,0.15)',
        border: '1.5px solid rgba(197,232,90,0.4)',
        borderRadius: 12,
        padding: '12px 24px',
        display: 'inline-block',
      }}>
        <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#C5E85A' }}>
          {planLabel}
        </span>
      </div>

      {/* What's unlocked */}
      <div style={{
        marginTop: 28,
        width: '100%',
        maxWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {[
          'Unlimited pronunciation scoring',
          'All 5 practice modes',
          'AI conversation partner',
          'Spaced repetition review',
          'Offline access',
        ].map((feat) => (
          <div key={feat} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ color: '#C5E85A', fontSize: '0.875rem', fontWeight: 800, flexShrink: 0 }}>
              {'✓'}
            </span>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>{feat}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={handleContinue}
        type="button"
        style={{
          marginTop: 36,
          width: '100%',
          maxWidth: 340,
          padding: '17px 0',
          borderRadius: 12,
          border: 'none',
          background: '#C5E85A',
          color: '#1A2A18',
          fontSize: '1.0625rem',
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: FONT,
          minHeight: 56,
        }}
      >
        Start learning
      </button>

      <p style={{
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.35)',
        marginTop: 16,
        textAlign: 'center',
      }}>
        A confirmation email is on its way from Stripe.
      </p>
    </div>
  );
}
