import { useState, useCallback, useEffect } from 'react';
import { requestPasswordReset } from '../../services/auth';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import styles from './ForgotPasswordScreen.module.css';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Drop your email address.'); return; }
    setLoading(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (resetError) { setError(resetError); return; }
    setSent(true);
    setCountdown(30);
  }, [email]);

  const handleResend = async () => {
    if (countdown > 0) return;
    await requestPasswordReset(email.trim()).catch(() => {});
    setCountdown(30);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => window.location.hash = `#${ROUTES.LOGIN}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className={styles.topTitle}>Reset password</span>
        <div className={styles.spacerBtn} />
      </div>

      {!sent ? (
        <>
          <div className={styles.illustrationWrap}>
            <div className={styles.illustrationCircle}>↺</div>
          </div>

          <h1 className={styles.title}>We'll send a magic link</h1>
          <p className={styles.body}>
            Enter the email you signed up with. Check your inbox — it'll land in ~30 seconds.
          </p>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <input
                className={styles.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
              {error && (
                <div className={styles.fieldError}>
                  <span className={styles.errorDot}>!</span>
                  {error}
                </div>
              )}
            </div>

            <button className={styles.primaryBtn} type="submit" disabled={loading}>
              {loading ? <LoadingSpinner size={20} /> : 'Send reset link'}
            </button>
          </form>

          <div className={styles.spacer} />

          <button className={styles.backToSignIn} onClick={() => window.location.hash = `#${ROUTES.LOGIN}`}>
            Back to sign in
          </button>
        </>
      ) : (
        <div className={styles.sentWrap}>
          <div className={styles.sentCircle}>✓</div>
          <h2 className={styles.sentTitle}>Check your email</h2>
          <p className={styles.sentBody}>
            We sent a link to <strong style={{ color: 'var(--fg-0)' }}>{email}</strong>. Open it on this device to continue.
          </p>

          <button className={styles.resendBtn} onClick={handleResend} disabled={countdown > 0}>
            {countdown > 0
              ? <>Didn't get it? <span>Resend in {countdown}s</span></>
              : <>Didn't get it? <span>Resend</span></>
            }
          </button>

          <button className={styles.altEmailBtn} onClick={() => { setSent(false); setEmail(''); }}>
            Use a different email
          </button>

          <button className={styles.backToSignIn} onClick={() => window.location.hash = `#${ROUTES.LOGIN}`}>
            Back to sign in
          </button>
        </div>
      )}
    </div>
  );
}
