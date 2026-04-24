// src/components/screens/LoginScreen.jsx — Sign in screen

import { useState, useCallback } from 'react';
import { signIn, signInWithGoogle, signInWithApple } from '../../services/auth';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import styles from './LoginScreen.module.css';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);

    if (authError) {
      setError(authError);
      return;
    }

    window.location.hash = `#${ROUTES.HOME}`;
  }, [email, password]);

  return (
    <div className={styles.screen}>
      <div className={styles.logo}>
        <span className={styles.logoShadow}>Shadow</span>
        <span className={styles.logoSpeak}>Speak</span>
      </div>
      <div className={styles.langHint}>CANTONESE &rsaquo;</div>

      <div className={styles.title}>Welcome back</div>
      <div className={styles.subtitle}>Sign in to continue your streak.</div>

      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <input
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div className={styles.forgot}>
          <a className={styles.forgotLink} href={`#${ROUTES.FORGOT_PASSWORD}`}>
            Forgot password?
          </a>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <button className={styles.primaryBtn} type="submit" disabled={loading}>
          {loading ? <LoadingSpinner size={20} /> : 'Sign in'}
        </button>
      </form>

      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <div className={styles.dividerText}>or</div>
        <div className={styles.dividerLine} />
      </div>

      <div className={styles.socialRow}>
        <button className={styles.socialBtn} type="button" onClick={async () => {
          setError('');
          setLoading(true);
          const { error: authError } = await signInWithGoogle();
          setLoading(false);
          if (authError) { setError(authError); return; }
          window.location.hash = `#${ROUTES.HOME}`;
        }}>
          <div className={`${styles.socialIcon} ${styles.socialG}`}>G</div>
          Google
        </button>
        <button className={styles.socialBtn} type="button" onClick={async () => {
          setError('');
          setLoading(true);
          const { error: authError } = await signInWithApple();
          setLoading(false);
          if (authError) { setError(authError); return; }
          window.location.hash = `#${ROUTES.HOME}`;
        }}>
          <div className={`${styles.socialIcon} ${styles.socialA}`}>&#xF8FF;</div>
          Apple
        </button>
      </div>

      <div className={styles.spacer} />

      <div className={styles.footerLink}>
        Don&rsquo;t have an account?{' '}
        <a href={`#${ROUTES.REGISTER}`}>Create one</a>
      </div>
    </div>
  );
}
