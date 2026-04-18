// src/components/shared/EmailCaptureModal.jsx
// Shown when a user hits a 3-day or 7-day streak milestone.
// Skipped entirely if the user is already signed in with an email address.
//
// On submit: saves email to Firestore users/{uid}.email and to a
// 'waitlist' collection for later Mailchimp sync.
//
// Dismissal: if closed without submitting, don't re-show for 7 days
// (persisted to localStorage under 'ss_email_capture_dismissed').

import { useState } from 'react';
import { fbAuth, fbDb } from '../../services/firebase';
import { logger } from '../../utils/logger';
import styles from './EmailCaptureModal.module.css';

const DISMISS_KEY = 'ss_email_capture_dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Returns true if the modal has been dismissed recently (within 7 days).
 */
export function isEmailCaptureSnoozed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Record a dismissal so we don't show the modal again for 7 days.
 */
export function snoozeEmailCapture() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage blocked — silent
  }
}

/**
 * @param {{ streakCount: number, onClose: () => void }} props
 */
export function EmailCaptureModal({ streakCount, onClose }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function handleDismiss() {
    snoozeEmailCapture();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError('');

    const user = fbAuth.currentUser;

    try {
      // Save to users/{uid}.email if there's an authenticated user
      if (user) {
        await fbDb.collection('users').doc(user.uid).set(
          { email: trimmed },
          { merge: true }
        );
      }

      // Save to waitlist collection for Mailchimp sync
      await fbDb.collection('waitlist').add({
        email: trimmed,
        uid: user?.uid || null,
        source: 'streak_milestone',
        streakCount,
        createdAt: new Date().toISOString(),
      });

      // Mark as submitted so we never show it again
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
      } catch {
        // silent
      }

      setDone(true);
      setTimeout(() => onClose(), 2200);
    } catch (err) {
      logger.error('Email capture submit failed', err);
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Email submitted">
        <div className={styles.modal}>
          <div className={styles.successIcon}>✓</div>
          <p className={styles.successText}>You're in. First report lands next week.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Weekly pronunciation report"
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
    >
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={handleDismiss} aria-label="Dismiss">
          ✕
        </button>

        <div className={styles.flame}></div>

        <h2 className={styles.title}>
          {streakCount}-day streak!
        </h2>
        <p className={styles.subtitle}>
          Get your weekly pronunciation report — drop your email and we will send you a breakdown of your progress.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <input
            className={styles.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            autoComplete="email"
            inputMode="email"
            disabled={submitting}
            aria-label="Email address"
          />
          {error && <p className={styles.errorMsg} role="alert">{error}</p>}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting}
          >
            {submitting ? 'Sending...' : 'Send my report'}
          </button>
        </form>

        <button className={styles.skipLink} onClick={handleDismiss}>
          No thanks
        </button>
      </div>
    </div>
  );
}
