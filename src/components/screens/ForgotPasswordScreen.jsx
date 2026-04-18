// src/components/screens/ForgotPasswordScreen.jsx — Password reset request

import { useState, useCallback } from 'react';
import { requestPasswordReset } from '../../services/auth';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import styles from './ForgotPasswordScreen.module.css';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Please enter your email.'); return; }

    setLoading(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setLoading(false);

    if (resetError) { setError(resetError); return; }

    setSent(true);
  }, [email]);

  return (
    <div className={styles.screen}>
      <button className={styles.back} type="button" onClick={() => { window.location.hash = `#${ROUTES.LOGIN}`; }}>
        <span className={styles.backArrow}>&lsaquo;</span> Back to sign in
      </button>

      <div className={styles.logo}>
        <span className={styles.logoShadow}>Shadow</span>
        <span className={styles.logoSpeak}>Speak</span>
      </div>
      <div className={styles.langHint}>CANTONESE &rsaquo;</div>

      {!sent ? (
        <>
          <div className={styles.title}>Reset password</div>
          <div className={styles.subtitle}>
            Enter your email and we&rsquo;ll send you a link to reset your password.
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input className={styles.input} type="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <button className={styles.primaryBtn} type="submit" disabled={loading}>
              {loading ? <LoadingSpinner size={20} /> : 'Send reset link'}
            </button>
          </form>
        </>
      ) : (
        <div className={styles.success}>
          <div className={styles.successIcon}>
            <div className={styles.successCheck}>&#x2713;</div>
          </div>
          <div className={styles.successTitle}>Check your email</div>
          <div className={styles.successText}>
            We sent a reset link to <strong>{email}</strong>. It expires in 30 minutes.
          </div>
          <button className={styles.outlineBtn} type="button"
            onClick={() => { window.location.hash = `#${ROUTES.LOGIN}`; }}>
            Back to sign in
          </button>
          <div className={styles.resend}>
            Didn&rsquo;t get it?{' '}
            <button className={styles.resendLink} type="button" onClick={() => { setSent(false); setError(''); }}>
              Resend
            </button>
          </div>
        </div>
      )}

      <div className={styles.spacer} />
    </div>
  );
}
