import { signInWithGoogle, signInWithApple } from '../../../../services/auth';

const FONT = "'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif";

export default function Screen15_AccountCreation({ advance, answers, onComplete }) {
  const language = answers?.language || 'cantonese';

  const handleGoogle = async () => {
    try {
      await signInWithGoogle(language);
      advance();
    } catch {
      // Auth failed or cancelled — stay on screen
    }
  };

  const handleApple = async () => {
    // Apple Sign-In: Firebase console config pending
    // signInWithApple(language) will be wired once Apple provider is enabled
    advance();
  };

  const handleEmail = () => {
    // Route to paywall / register flow
    advance();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F4EC',
      padding: '48px 24px 48px',
      fontFamily: FONT,
    }}>
      <h1 style={{
        fontSize: "1.625rem",
        fontWeight: 800,
        color: '#1A2A18',
        margin: 0,
        lineHeight: 1.2,
      }}>
        Save your score and start improving.
      </h1>

      <p style={{
        fontSize: "0.9375rem",
        color: '#666',
        marginTop: 10,
        lineHeight: 1.5,
      }}>
        Create a free account to unlock your lesson plan, track your progress, and keep your streak.
      </p>

      {/* What you get */}
      <div style={{
        background: 'white',
        borderRadius: 14,
        padding: '16px 18px',
        marginTop: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {[
          'Your score history and pronunciation analytics',
          'Daily lessons tailored to your goals and language',
          '7-day free trial of ShadowSpeak Pro — no card needed',
        ].map((point) => (
          <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#C5E85A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: "0.625rem",
              color: '#1A2A18',
              fontWeight: 800,
              flexShrink: 0,
              marginTop: 1,
            }}>
              ✓
            </div>
            <span style={{ fontSize: "0.875rem", color: '#1A2A18', lineHeight: 1.5 }}>{point}</span>
          </div>
        ))}
      </div>

      {/* Auth options */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Apple */}
        <button
          onClick={handleApple}
          type="button"
          style={{
            width: '100%',
            padding: '16px 0',
            borderRadius: 12,
            border: 'none',
            background: '#000',
            color: 'white',
            fontSize: "1rem",
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Continue with Apple
        </button>

        {/* Google */}
        <button
          onClick={handleGoogle}
          type="button"
          style={{
            width: '100%',
            padding: '16px 0',
            borderRadius: 12,
            border: '1.5px solid #E8E4D8',
            background: 'white',
            color: '#1A2A18',
            fontSize: "1rem",
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Email */}
        <button
          onClick={handleEmail}
          type="button"
          style={{
            width: '100%',
            padding: '16px 0',
            borderRadius: 12,
            border: '1.5px solid #E8E4D8',
            background: 'white',
            color: '#1A2A18',
            fontSize: "1rem",
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          Continue with email
        </button>
      </div>

      <button
        onClick={() => { window.location.hash = '#login'; }}
        type="button"
        style={{
          display: 'block',
          width: '100%',
          background: 'none',
          border: 'none',
          fontSize: "0.875rem",
          color: '#999',
          marginTop: 16,
          cursor: 'pointer',
          fontFamily: FONT,
          textAlign: 'center',
          padding: '8px 0',
        }}
      >
        Already have an account? Log in
      </button>
    </div>
  );
}
