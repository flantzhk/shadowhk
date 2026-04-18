// src/components/screens/AboutScreen.jsx — Item 21

import { ROUTES, APP_VERSION } from '../../utils/constants';
import styles from './AboutScreen.module.css';

export default function AboutScreen({ onBack, onNavigate }) {
  const handleLink = (href) => {
    window.open(href, '_blank', 'noopener');
  };

  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>‹ Back</button>

      <div className={styles.logoWrap}>
        <span className={styles.logoS}>S</span>
      </div>
      <p className={styles.wordmark}><span className={styles.shadow}>Shadow</span><span className={styles.speak}>Speak</span></p>
      <p className={styles.version}>Version {APP_VERSION}</p>

      <p className={styles.credit}>Made with care in Hong Kong<br />by Faith Lantz and family.</p>

      <div className={styles.divider} />

      <LinkRow label="Privacy Policy" onClick={() => onNavigate?.(ROUTES.PRIVACY)} />
      <LinkRow label="Terms of Service" onClick={() => onNavigate?.(ROUTES.TERMS)} />
      <LinkRow label="Open Source Licenses" onClick={() => onNavigate?.(ROUTES.LICENSES)} />

      <div className={styles.divider} />

      <LinkRow label="Support" onClick={() => handleLink('mailto:support@shadowspeak.app')} />
      <LinkRow label="Send feedback" onClick={() => handleLink('mailto:feedback@shadowspeak.app')} />

      <div className={styles.divider} />

      <p className={styles.partnerCredit}>Built with cantonese.ai</p>
      <p className={styles.copyright}>© 2026 ShadowSpeak</p>
    </div>
  );
}

function LinkRow({ label, onClick }) {
  return (
    <button className={styles.linkRow} onClick={onClick}>
      <span>{label}</span>
      <span className={styles.chevron}>›</span>
    </button>
  );
}
