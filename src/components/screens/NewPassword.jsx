// src/components/screens/NewPassword.jsx — Item 7

import { useState } from 'react';
import { fbAuth } from '../../services/firebase';
import styles from './NewPassword.module.css';

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Medium', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#D04040', '#E8A030', '#8BB82B', '#2A5A10'];

export default function NewPassword({ onBack, showToast }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = getStrength(password);
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const matches = password === confirm && confirm.length > 0;
  const canSubmit = hasLength && hasNumber && matches;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await fbAuth.currentUser?.updatePassword(password);
      showToast?.('Password updated. Sign in with your new password.', 'success');
      onBack?.();
    } catch (e) {
      setError(e.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>‹ Back to sign in</button>

      <div className={styles.logoMark}>S</div>

      <h1 className={styles.title}>Set a new password</h1>
      <p className={styles.body}>Choose a strong password for your account.</p>

      <label className={styles.fieldLabel}>NEW PASSWORD</label>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <button className={styles.eyeBtn} onClick={() => setShowPw(!showPw)} type="button">
          {showPw ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {password.length > 0 && (
        <>
          <div className={styles.strengthBar}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={styles.segment}
                style={{ background: i <= strength ? STRENGTH_COLORS[strength] : '#EEE8D8' }}
              />
            ))}
          </div>
          <p className={styles.strengthLabel} style={{ color: STRENGTH_COLORS[strength] }}>
            {STRENGTH_LABELS[strength]}
          </p>
        </>
      )}

      <label className={styles.fieldLabel} style={{ marginTop: 20 }}>CONFIRM PASSWORD</label>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          type={showConfirm ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <button className={styles.eyeBtn} onClick={() => setShowConfirm(!showConfirm)} type="button">
          {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      <ul className={styles.requirements}>
        <Req met={hasLength} label="Be at least 8 characters" />
        <Req met={hasNumber} label="Include a number" />
        <Req met={hasSpecial} label="Include a special character (recommended)" />
        {confirm.length > 0 && <Req met={matches} label="Passwords match" />}
      </ul>

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={`${styles.submitBtn} ${!canSubmit ? styles.disabled : ''}`}
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
      >
        {loading ? 'Updating...' : 'Update password'}
      </button>
    </div>
  );
}

function Req({ met, label }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: "0.75rem", color: 'var(--color-text-muted)', marginBottom: 6 }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%',
        border: met ? 'none' : '1.5px solid var(--color-border-strong)',
        background: met ? 'var(--color-success)' : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: "0.625rem", color: 'white'
      }}>
        {met ? '✓' : ''}
      </span>
      {label}
    </li>
  );
}

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
