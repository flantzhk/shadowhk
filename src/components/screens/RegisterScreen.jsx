// src/components/screens/RegisterScreen.jsx — Create account screen

import { useState, useCallback, useMemo } from 'react';
import { signUp, signInWithGoogle, signInWithApple } from '../../services/auth';
import { useAppContext } from '../../contexts/AppContext';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import styles from './RegisterScreen.module.css';

function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

export default function RegisterScreen() {
  const { settings } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const language = settings?.currentLanguage || 'cantonese';

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    const { error: authError } = await signUp(email.trim(), password, name.trim(), language);
    setLoading(false);

    if (authError) { setError(authError); return; }

    window.location.hash = `#${ROUTES.WELCOME}`;
  }, [name, email, password]);

  return (
    <div className={styles.screen}>
      <div className={styles.logo}>
        <span className={styles.logoShadow}>Shadow</span>
        <span className={styles.logoSpeak}>Speak</span>
      </div>
      <div className={styles.langHint}>CANTONESE &rsaquo;</div>

      <div className={styles.title}>Start speaking</div>
      <div className={styles.subtitle}>Create your account. Takes 30 seconds.</div>

      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label}>First name</label>
          <input className={styles.input} type="text" placeholder="Your first name"
            value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input className={styles.input} type="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <input className={styles.input} type="password" placeholder="At least 8 characters"
            value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          {password && (
            <div className={styles.strengthBars}>
              {[1, 2, 3, 4].map((level) => (
                <div key={level} className={`${styles.strengthBar} ${strength >= level ? styles[`strength${strength}`] : ''}`} />
              ))}
            </div>
          )}
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <button className={styles.primaryBtn} type="submit" disabled={loading}>
          {loading ? <LoadingSpinner size={20} /> : 'Create account'}
        </button>
      </form>

      <div className={styles.terms}>
        By creating an account, you agree to our{' '}
        <a href="https://[app-domain]/terms" target="_blank" rel="noopener noreferrer">Terms</a>
        {' '}and{' '}
        <a href="https://[app-domain]/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </div>

      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <div className={styles.dividerText}>or</div>
        <div className={styles.dividerLine} />
      </div>

      <div className={styles.socialRow}>
        <button className={styles.socialBtn} type="button" onClick={async () => {
          setError('');
          setLoading(true);
          const { error: authError } = await signInWithGoogle(language);
          setLoading(false);
          if (authError) { setError(authError); return; }
          window.location.hash = `#${ROUTES.WELCOME}`;
        }}>
          <div className={`${styles.socialIcon} ${styles.socialG}`}>G</div>
          Google
        </button>
        <button className={styles.socialBtn} type="button" onClick={async () => {
          setError('');
          setLoading(true);
          const { error: authError } = await signInWithApple(language);
          setLoading(false);
          if (authError) { setError(authError); return; }
          window.location.hash = `#${ROUTES.WELCOME}`;
        }}>
          <div className={`${styles.socialIcon} ${styles.socialA}`}>&#xF8FF;</div>
          Apple
        </button>
      </div>

      <div className={styles.spacer} />

      <div className={styles.footerLink}>
        Already have an account?{' '}
        <a href={`#${ROUTES.LOGIN}`}>Sign in</a>
      </div>
    </div>
  );
}
