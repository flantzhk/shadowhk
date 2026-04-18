// src/components/screens/LegalPage.jsx — Privacy Policy & Terms of Service

import styles from './LegalPage.module.css';

export function PrivacyPolicy({ onBack }) {
  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>&lsaquo; Back</button>
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.updated}>Last updated: April 2026</p>
      <div className={styles.divider} />

      <h2 className={styles.sectionTitle}>1. What we collect</h2>
      <p className={styles.body}>
        ShadowSpeak collects only the information needed to provide the service. This includes:
      </p>
      <ul className={styles.list}>
        <li>Your email address and name</li>
        <li>Your learning progress and streak</li>
        <li>Voice recordings (sent to cantonese.ai for scoring, never stored)</li>
        <li>Anonymous usage analytics</li>
      </ul>

      <h2 className={styles.sectionTitle}>2. How we use it</h2>
      <p className={styles.body}>
        We use your data to personalize your learning experience, track your progress,
        and improve the app. Voice recordings are processed in real-time for pronunciation
        scoring and are never saved.
      </p>

      <h2 className={styles.sectionTitle}>3. Who we share it with</h2>
      <p className={styles.body}>
        We share pronunciation audio with cantonese.ai solely for scoring purposes.
        We do not sell your data to third parties. Anonymous analytics may be processed
        by standard analytics providers.
      </p>

      <h2 className={styles.sectionTitle}>4. Your rights</h2>
      <p className={styles.body}>
        You can request deletion of your account and all associated data at any time
        by contacting us. You can export your learning data from Settings.
      </p>

      <h2 className={styles.sectionTitle}>5. Children</h2>
      <p className={styles.body}>
        ShadowSpeak is not intended for children under 13. We do not knowingly
        collect data from children under 13.
      </p>

      <div className={styles.divider} />
      <p className={styles.footer}>
        Questions? Email us at <strong>privacy@shadowspeak.app</strong>
      </p>
    </div>
  );
}

export function TermsOfService({ onBack }) {
  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>&lsaquo; Back</button>
      <h1 className={styles.title}>Terms of Service</h1>
      <p className={styles.updated}>Last updated: April 2026</p>
      <div className={styles.divider} />

      <h2 className={styles.sectionTitle}>1. Acceptance</h2>
      <p className={styles.body}>
        By using ShadowSpeak, you agree to these terms. If you don't agree, please
        don't use the app.
      </p>

      <h2 className={styles.sectionTitle}>2. The service</h2>
      <p className={styles.body}>
        ShadowSpeak is a language learning app focused on speaking Cantonese. We provide
        audio lessons, pronunciation scoring, and spaced repetition practice.
      </p>

      <h2 className={styles.sectionTitle}>3. Your account</h2>
      <p className={styles.body}>
        You're responsible for keeping your account credentials secure. One account
        per person. Don't share your account.
      </p>

      <h2 className={styles.sectionTitle}>4. Acceptable use</h2>
      <p className={styles.body}>
        Use ShadowSpeak for personal language learning. Don't attempt to reverse-engineer
        the app, scrape content, or use it for automated purposes.
      </p>

      <h2 className={styles.sectionTitle}>5. Intellectual property</h2>
      <p className={styles.body}>
        All content, audio, and design elements are owned by ShadowSpeak. Your learning
        data belongs to you.
      </p>

      <h2 className={styles.sectionTitle}>6. Limitation of liability</h2>
      <p className={styles.body}>
        ShadowSpeak is provided as-is. We're not liable for any damages arising from
        use of the app. We don't guarantee fluency in Cantonese.
      </p>

      <div className={styles.divider} />
      <p className={styles.footer}>
        Questions? Email us at <strong>legal@shadowspeak.app</strong>
      </p>
    </div>
  );
}
