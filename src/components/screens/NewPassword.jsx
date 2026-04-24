import { useState, useEffect } from 'react';
import { fbAuth } from '../../services/firebase';
import { ROUTES } from '../../utils/constants';
import styles from './NewPassword.module.css';

export default function NewPassword({ onBack, showToast }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const user = fbAuth.currentUser;
  const email = user?.email || '';

  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit = hasLength && hasNumber && passwordsMatch;

  // Auto-redirect after success
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => {
      window.location.hash = `#${ROUTES.HOME}`;
    }, 1500);
    return () => clearTimeout(t);
  }, [success]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await fbAuth.currentUser?.updatePassword(password);
      setSuccess(true);
    } catch (e) {
      setError(e.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.screen}>
        <div className={styles.successWrap}>
          <div className={styles.successCircle}>✓</div>
          <h2 className={styles.successTitle}>You're in</h2>
          <p className={styles.successSub}>
            Taking you home…
            <span className={styles.spinner} />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack ?? (() => window.location.hash = `#${ROUTES.LOGIN}`)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className={styles.topTitle}>New password</span>
        <div className={styles.spacerBtn} />
      </div>

      {email && <p className={styles.contextLine}>Signed in as {email}</p>}

      <h1 className={styles.title}>Choose a new password</h1>
      <p className={styles.body}>Make it something you'll remember on the MTR at 7am.</p>

      <label className={styles.fieldLabel}>NEW PASSWORD</label>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <button className={styles.eyeBtn} onClick={() => setShowPw(v => !v)} type="button">
          {showPw ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      <label className={styles.fieldLabel}>CONFIRM PASSWORD</label>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type={showConfirm ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <button className={styles.eyeBtn} onClick={() => setShowConfirm(v => !v)} type="button">
          {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      <ul className={styles.checklist}>
        <CheckItem met={hasLength} label="8 or more characters" />
        <CheckItem met={hasNumber} label="Mix of letters and numbers" />
        <CheckItem met={passwordsMatch} label="Passwords match" />
      </ul>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
      >
        {loading ? 'Saving…' : 'Save and sign in'}
      </button>

      <div className={styles.spacer} />
    </div>
  );
}

function CheckItem({ met, label }) {
  return (
    <li className={`${styles.checkItem} ${met ? styles.checkMet : ''}`}>
      <span className={styles.checkDot}>{met ? '✓' : ''}</span>
      {label}
    </li>
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
