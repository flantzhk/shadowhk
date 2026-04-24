import { useState, useEffect } from 'react';
import { fbAuth } from '../../services/firebase';
import { ROUTES } from '../../utils/constants';
import styles from './EmailVerification.module.css';

export default function EmailVerification({ onVerified, onBack }) {
  const [resendCountdown, setResendCountdown] = useState(0);
  const user = fbAuth.currentUser;
  const email = user?.email || '';

  // Poll every 3s per spec
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!fbAuth.currentUser) return;
      await fbAuth.currentUser.reload();
      if (fbAuth.currentUser.emailVerified) {
        clearInterval(timer);
        onVerified?.();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [onVerified]);

  // Countdown for resend
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleResend = async () => {
    if (!fbAuth.currentUser || resendCountdown > 0) return;
    try {
      await fbAuth.currentUser.sendEmailVerification();
      setResendCountdown(42);
    } catch {}
  };

  const handleSwitchAccount = () => {
    fbAuth.signOut().then(() => {
      window.location.hash = `#${ROUTES.LOGIN}`;
    });
  };

  return (
    <div className={styles.screen}>
      <div className={styles.brandMark}>影</div>

      {/* Hero illustration */}
      <div className={styles.heroWrap}>
        <div className={styles.envelope + ' ' + styles.envelopeBack} />
        <div className={styles.envelope + ' ' + styles.envelopeMid} />
        <div className={styles.envelope + ' ' + styles.envelopeFront}>
          <div className={styles.envelopeFlap} />
          <div className={styles.envelopeLines}>
            <div className={styles.envelopeLine} style={{ width: 64 }} />
            <div className={styles.envelopeLine} style={{ width: 48 }} />
          </div>
        </div>
      </div>

      <h1 className={styles.title}>Verify your email</h1>
      <p className={styles.body}>
        Tap the link we sent to
      </p>
      <p className={styles.emailDisplay}>{email}</p>
      <p className={styles.body}>
        This page will update automatically when you're verified.
      </p>

      {/* Listening dots */}
      <div className={styles.dotsRow}>
        <div className={styles.dot} />
        <div className={styles.dot} />
        <div className={styles.dot} />
      </div>

      <button className={styles.resendBtn} onClick={handleResend} disabled={resendCountdown > 0}>
        <MailIcon />
        {resendCountdown > 0 ? `Resend in 0:${String(resendCountdown).padStart(2, '0')}` : 'Resend email'}
      </button>

      <button className={styles.switchBtn} onClick={handleSwitchAccount}>
        Switch account
      </button>

      <div className={styles.spacer} />

      <p className={styles.helpLink}>
        Need help?{' '}
        <a href={`#${ROUTES.SUPPORT}`}>Contact support</a>
      </p>
    </div>
  );
}

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="3"/>
    <polyline points="2,4 12,13 22,4"/>
  </svg>
);
