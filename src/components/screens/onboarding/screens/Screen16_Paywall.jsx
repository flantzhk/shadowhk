import { useState } from 'react';
import { createCheckoutSession } from '../../../../services/api';
import { isAuthenticated } from '../../../../services/auth';
import { ROUTES } from '../../../../utils/constants';

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";

const PLANS = [
  {
    id: 'annual',
    label: 'Annual',
    price: '£54.99',
    period: 'per year',
    sub: '7-day free trial, then £4.58/month. Cancel anytime.',
    badge: 'Most popular',
    cta: 'Start 7-day free trial',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '£9.99',
    period: 'per month',
    sub: 'Billed monthly. Cancel anytime.',
    badge: null,
    cta: 'Get Monthly',
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    price: '£149',
    period: 'one time',
    sub: 'Pay once, own it forever. Limited launch pricing.',
    badge: 'Launch offer',
    cta: 'Get Lifetime Access',
  },
  {
    id: 'family',
    label: 'Family',
    price: '£79.99',
    period: 'per year',
    sub: 'Up to 5 members. Shared subscription.',
    badge: null,
    cta: 'Get Family Plan',
  },
];

const FEATURES = [
  'Real-time pronunciation scoring on every phrase',
  'Tone accuracy feedback with instant correction',
  'Cantonese and Mandarin lesson plans',
  'AI conversation practice',
  'Spaced repetition review system',
  'Streak tracking and gamified progress',
  'Offline mode for downloaded phrases',
];

export default function Screen16_Paywall({ onComplete, answers, updateSettings }) {
  const [selected, setSelected] = useState('annual');
  const [showFeatures, setShowFeatures] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedPlan = PLANS.find((p) => p.id === selected);

  const handlePay = async () => {
    if (loading) return;
    setError(null);

    // If not authenticated (email path without account creation), route to register first
    if (!isAuthenticated()) {
      localStorage.setItem('ss_pending_plan', selected);
      window.location.hash = `#${ROUTES.REGISTER}?plan=${selected}`;
      return;
    }

    setLoading(true);
    try {
      // Write onboarding answers before leaving the app
      if (updateSettings) {
        await updateSettings({
          currentLanguage: answers?.language || 'cantonese',
          dailyGoalMinutes: answers?.dailyGoalMinutes || 20,
          onboardingCompleted: true,
        });
      }
      // Persist the selected plan so the success screen knows which plan was purchased
      localStorage.setItem('ss_pending_plan', selected);

      const { url, error: apiError } = await createCheckoutSession(selected);

      if (apiError || !url) {
        throw new Error(apiError || 'No checkout URL returned');
      }

      // Leave the app — Stripe handles payment, returns to ?checkout=success|cancel
      window.location.href = url;
    } catch (err) {
      console.error('Stripe checkout error:', err);
      setError('Unable to start checkout. Please check your connection and try again.');
      setLoading(false);
    }
  };

  const handleFree = () => {
    if (onComplete) onComplete('free');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F4EC',
      padding: '40px 24px 56px',
      fontFamily: FONT,
    }}>
      {/* Wordmark */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1A2A18' }}>Shadow</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8BB82B' }}>Speak</span>
      </div>

      <h1 style={{
        fontSize: '1.625rem',
        fontWeight: 800,
        color: '#1A2A18',
        margin: 0,
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        Your Chinese, properly scored.
      </h1>

      <p style={{
        fontSize: '0.9375rem',
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 1.5,
      }}>
        Everything you just experienced, every day. Real pronunciation feedback, real progress.
      </p>

      {/* Featured review */}
      <div style={{
        background: '#C5E85A',
        borderRadius: 14,
        padding: '16px 18px',
        marginTop: 20,
      }}>
        <div style={{ fontSize: '0.875rem', color: '#1A2A18', letterSpacing: 1 }}>
          {'★★★★★'}
        </div>
        <p style={{
          fontSize: '0.875rem',
          fontStyle: 'italic',
          color: '#1A2A18',
          margin: '8px 0 0',
          lineHeight: 1.5,
        }}>
          "The AI coaching is unlike anything else out there. I've been studying for 3 years and
          this is the first time I've known exactly what to fix."
        </p>
        <div style={{ fontSize: '0.75rem', color: '#3A6A1A', fontWeight: 600, marginTop: 8 }}>
          David K. — Cantonese learner
        </div>
      </div>

      {/* Plan selector */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PLANS.map((plan) => {
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => { setSelected(plan.id); setError(null); }}
              style={{
                width: '100%',
                background: isSelected ? '#1A2A18' : 'white',
                borderRadius: 14,
                padding: '16px 18px',
                border: `2px solid ${isSelected ? '#C5E85A' : '#E8E4D8'}`,
                cursor: 'pointer',
                fontFamily: FONT,
                textAlign: 'left',
                position: 'relative',
                transition: 'all 150ms ease',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: -10,
                  right: 14,
                  background: '#C5E85A',
                  color: '#1A2A18',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  borderRadius: 20,
                  padding: '3px 10px',
                }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div>
                  <div style={{
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: isSelected ? '#C5E85A' : '#999',
                    marginBottom: 2,
                  }}>
                    {plan.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: isSelected ? 'white' : '#1A2A18',
                    }}>
                      {plan.price}
                    </span>
                    <span style={{
                      fontSize: '0.8125rem',
                      color: isSelected ? 'rgba(255,255,255,0.6)' : '#999',
                    }}>
                      {plan.period}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#C5E85A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    color: '#1A2A18',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    {'✓'}
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: isSelected ? 'rgba(255,255,255,0.5)' : '#BBB',
                marginTop: 4,
              }}>
                {plan.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          background: '#FFF0F0',
          border: '1px solid #FFD0D0',
          borderRadius: 10,
          fontSize: '0.8125rem',
          color: '#D04040',
          lineHeight: 1.4,
        }}>
          {error}
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={handlePay}
        type="button"
        disabled={loading}
        style={{
          width: '100%',
          marginTop: 16,
          padding: '17px 0',
          borderRadius: 12,
          border: 'none',
          background: loading ? '#D4E87A' : '#C5E85A',
          color: '#1A2A18',
          fontSize: '1.0625rem',
          fontWeight: 800,
          cursor: loading ? 'wait' : 'pointer',
          fontFamily: FONT,
          transition: 'background 200ms ease',
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 18,
              height: 18,
              border: '2px solid rgba(26,42,24,0.3)',
              borderTop: '2px solid #1A2A18',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Redirecting to checkout...
          </>
        ) : (
          selectedPlan?.cta || 'Continue'
        )}
      </button>

      {/* Secondary links */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 20,
        marginTop: 12,
      }}>
        <button
          type="button"
          onClick={handleFree}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '0.8125rem',
            color: '#AAA',
            cursor: 'pointer',
            fontFamily: FONT,
            padding: '8px 4px',
            minHeight: 44,
          }}
        >
          Continue with free plan
        </button>
        <button
          type="button"
          onClick={() => setShowFeatures((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '0.8125rem',
            color: '#AAA',
            cursor: 'pointer',
            fontFamily: FONT,
            padding: '8px 4px',
            minHeight: 44,
          }}
        >
          {showFeatures ? 'Hide features' : "See what's included"}
        </button>
      </div>

      {/* Feature list accordion */}
      {showFeatures && (
        <div style={{
          background: 'white',
          borderRadius: 14,
          padding: '16px 18px',
          marginTop: 4,
        }}>
          {FEATURES.map((feature) => (
            <div key={feature} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 10,
            }}>
              <span style={{ color: '#C5E85A', fontWeight: 800, flexShrink: 0 }}>{'✓'}</span>
              <span style={{ fontSize: '0.8125rem', color: '#1A2A18', lineHeight: 1.4 }}>{feature}</span>
            </div>
          ))}
        </div>
      )}

      {/* Legal */}
      <p style={{
        fontSize: '0.6875rem',
        color: '#CCC',
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 1.6,
      }}>
        Cancel anytime before trial ends. Payment taken at end of trial period.
        Annual billing charged in full. Family plan covers up to 5 members.
        Processed securely by Stripe.
      </p>
    </div>
  );
}
