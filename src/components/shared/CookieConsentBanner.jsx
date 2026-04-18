// src/components/shared/CookieConsentBanner.jsx
// GDPR / UK-PECR cookie consent banner.
//
// Shows on first visit (web only) at the bottom of the screen.
// Non-blocking — user can interact with the app while it's visible.
//
// "Manage preferences" opens an inline panel with an analytics toggle.
// Consent decision is persisted to localStorage via consent.js.

import { useState } from 'react';
import { acceptAll, declineAll, saveConsent, getConsent } from '../../services/consent';
import styles from './CookieConsentBanner.module.css';

/**
 * @param {{ onConsent: () => void }} props
 *   onConsent — called after the user makes any choice, so App can hide the banner
 */
export function CookieConsentBanner({ onConsent }) {
  const [showPrefs, setShowPrefs] = useState(false);
  // Pre-fill the analytics toggle from any existing (partial) saved value,
  // defaulting to true so the UX feels like "opt-out" rather than "opt-in".
  const existing = getConsent();
  const [analyticsOn, setAnalyticsOn] = useState(existing?.analytics ?? true);

  function handleAcceptAll() {
    acceptAll();
    onConsent();
  }

  function handleSavePrefs() {
    saveConsent({ analytics: analyticsOn });
    onConsent();
  }

  return (
    <div className={styles.banner} role="region" aria-label="Cookie preferences">
      {!showPrefs ? (
        <>
          <p className={styles.text}>
            We use cookies to improve your experience and track app performance.
            See our <a href="#privacy" className={styles.link}>Privacy Policy</a>.
          </p>
          <div className={styles.actions}>
            <button
              className={styles.manageBtn}
              onClick={() => setShowPrefs(true)}
            >
              Manage preferences
            </button>
            <button
              className={styles.acceptBtn}
              onClick={handleAcceptAll}
            >
              Accept all
            </button>
          </div>
        </>
      ) : (
        <div className={styles.prefsPanel}>
          <p className={styles.prefsTitle}>Cookie preferences</p>

          <div className={styles.toggleRow}>
            <div>
              <span className={styles.toggleLabel}>Essential cookies</span>
              <span className={styles.toggleSub}>Required for the app to work</span>
            </div>
            <span className={styles.alwaysOn}>Always on</span>
          </div>

          <div className={styles.toggleRow}>
            <div>
              <span className={styles.toggleLabel}>Analytics</span>
              <span className={styles.toggleSub}>Helps us understand how you use ShadowSpeak</span>
            </div>
            <button
              role="switch"
              aria-checked={analyticsOn}
              className={`${styles.toggle} ${analyticsOn ? styles.toggleActive : ''}`}
              onClick={() => setAnalyticsOn(v => !v)}
              aria-label="Toggle analytics cookies"
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          <div className={styles.prefsActions}>
            <button className={styles.backBtn} onClick={() => setShowPrefs(false)}>
              Back
            </button>
            <button className={styles.acceptBtn} onClick={handleSavePrefs}>
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
