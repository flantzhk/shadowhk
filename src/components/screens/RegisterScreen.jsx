import { useState, useCallback, useMemo } from 'react';
import { signUp, signInWithGoogle, signInWithApple } from '../../services/auth';
import { useAppContext } from '../../contexts/AppContext';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import styles from './RegisterScreen.module.css';

const AMBIENT_URL = 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=800&q=80';

export default function RegisterScreen() {
  const { settings } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const language = settings?.currentLanguage || 'cantonese';
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const filledPips = [hasLength, hasNumber, password.length >= 12, /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length;
  const canSubmit = name.trim() && email.trim() && hasLength && hasNumber && agreed;

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('What should we call you?'); return; }
    if (!email.trim()) { setError('Drop your email.'); return; }
    if (!hasLength) { setError('Password needs 8+ characters.'); return; }
    if (!hasNumber) { setError('Add a number to your password.'); return; }
    if (!agreed) { setError('Agree to the terms to continue.'); return; }
    setLoading(true);
    const { error: authError } = await signUp(email.trim(), password, name.trim(), language);
    setLoading(false);
    if (authError) { setError(authError); return; }
    window.location.hash = `#${ROUTES.HOME}`;
  }, [name, email, password, agreed, hasLength, hasNumber, language]);

  return (
    <div className={styles.screen}>
      <div className={styles.ambientBg} style={{ backgroundImage: `url(${AMBIENT_URL})` }} />
      <div className={styles.darkGradient} />

      <div className={styles.content}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => window.location.hash = `#${ROUTES.LOGIN}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Start shadowing</h1>
          <p className={styles.subtitle}>One account, all scenes. No lesson plans, just real HK situations.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <input
              className={styles.input}
              type="text"
              placeholder="What should we call you?"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="given-name"
            />
          </div>

          <div className={styles.field}>
            <input
              className={styles.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <input
              className={`${styles.input} ${styles.inputWithEye}`}
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
            {password && (
              <>
                <div className={styles.strengthPips}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`${styles.pip} ${filledPips >= i ? styles.pipActive : ''}`} />
                  ))}
                </div>
                <div className={styles.rules}>
                  <span className={`${styles.rule} ${hasLength ? styles.ruleMet : ''}`}>
                    <span className={styles.ruleDot}>{hasLength ? '✓' : ''}</span>
                    8+ characters
                  </span>
                  <span className={`${styles.rule} ${hasNumber ? styles.ruleMet : ''}`}>
                    <span className={styles.ruleDot}>{hasNumber ? '✓' : ''}</span>
                    A number
                  </span>
                </div>
              </>
            )}
          </div>

          <div className={styles.checkRow}>
            <button
              type="button"
              className={`${styles.checkbox} ${agreed ? styles.checkboxOn : ''}`}
              onClick={() => setAgreed(v => !v)}
            >
              {agreed ? '✓' : ''}
            </button>
            <span className={styles.checkText}>
              I agree to the{' '}
              <a href="#terms" onClick={e => e.stopPropagation()}>Terms</a>
              {' '}and{' '}
              <a href="#privacy" onClick={e => e.stopPropagation()}>Privacy Policy</a>.
            </span>
          </div>

          {error && (
            <div className={styles.fieldError}>
              <span className={styles.errorDot}>!</span>
              {error}
            </div>
          )}

          <button className={styles.primaryBtn} type="submit" disabled={!canSubmit || loading}>
            {loading ? <LoadingSpinner size={20} /> : 'Create account'}
          </button>
        </form>

        <div className={styles.spacer} />

        <p className={styles.footer}>
          Already have one?{' '}
          <a href={`#${ROUTES.LOGIN}`}>Sign in</a>
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
