import { useState, useCallback } from 'react';
import { signIn, signInWithGoogle, signInWithApple } from '../../services/auth';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import styles from './LoginScreen.module.css';

const AMBIENT_URL = 'https://images.unsplash.com/photo-1536599424071-0b215a388ba7?auto=format&fit=crop&w=800&q=80';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 300);
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      shake();
      return;
    }
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    setLoading(false);
    if (authError) { setError(authError); shake(); return; }
    window.location.hash = `#${ROUTES.HOME}`;
  }, [email, password]);

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    const { error: authError } = await signInWithGoogle();
    setLoading(false);
    if (authError) { setError(authError); return; }
    window.location.hash = `#${ROUTES.HOME}`;
  };

  const handleApple = async () => {
    setError(''); setLoading(true);
    const { error: authError } = await signInWithApple();
    setLoading(false);
    if (authError) { setError(authError); return; }
    window.location.hash = `#${ROUTES.HOME}`;
  };

  return (
    <div className={styles.screen}>
      <div className={styles.ambientBg} style={{ backgroundImage: `url(${AMBIENT_URL})` }} />
      <div className={styles.darkGradient} />

      <div className={styles.content}>
        <div className={styles.brandWrap}>
          <div className={styles.brandTile}>影</div>
          <span className={styles.wordmark}>ShadowHK</span>
        </div>

        <div className={styles.spacer} />

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Gwai2 zoi3 gin3 — ready to shadow?</p>
        </div>

        <form onSubmit={handleSubmit} className={shaking ? styles.shakeError : ''}>
          <div className={styles.field}>
            <input
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <input
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <div className={styles.forgotRow}>
            <a className={styles.forgotLink} href={`#${ROUTES.FORGOT_PASSWORD}`}>Forgot?</a>
          </div>

          {error && (
            <div className={styles.fieldError}>
              <span className={styles.errorDot}>!</span>
              {error}
            </div>
          )}

          <button className={styles.primaryBtn} type="submit" disabled={loading}>
            {loading ? <LoadingSpinner size={20} /> : 'Sign in'}
          </button>
        </form>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>or continue with</span>
          <div className={styles.dividerLine} />
        </div>

        <div className={styles.socialRow}>
          <button className={styles.socialBtn} type="button" onClick={handleApple}>
            <span className={styles.socialIcon + ' ' + styles.socialA}>&#xF8FF;</span>
            Apple
          </button>
          <button className={styles.socialBtn} type="button" onClick={handleGoogle}>
            <span className={styles.socialIcon + ' ' + styles.socialG}>G</span>
            Google
          </button>
          <button className={styles.socialBtn} type="button" onClick={() => window.location.hash = `#${ROUTES.REGISTER}`}>
            <span className={styles.socialMail}>✉</span>
            Email link
          </button>
        </div>

        <div className={styles.spacer} />

        <p className={styles.footer}>
          New here?{' '}
          <a href={`#${ROUTES.REGISTER}`}>Create an account</a>
        </p>
      </div>
    </div>
  );
}

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
