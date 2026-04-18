// src/components/screens/SupportScreen.jsx
// Route: #support — help & support page linked from Settings.

import { useState } from 'react';
import styles from './SupportScreen.module.css';

const FAQS = [
  {
    q: 'How do I cancel my subscription?',
    a: 'To cancel your subscription, go to Profile then tap "Manage subscription". On iOS, manage it via Settings > Apple ID > Subscriptions. On Android, manage via Google Play > Subscriptions. On web, use the billing portal link on your profile. Cancellations take effect at the end of your current billing period.',
  },
  {
    q: 'Which languages does ShadowSpeak support?',
    a: 'ShadowSpeak currently supports Cantonese (廣東話) and Mandarin (普通話), both with full pronunciation scoring, TTS, and structured lesson plans. More languages are on the roadmap.',
  },
  {
    q: 'How does pronunciation scoring work?',
    a: 'When you record yourself, your audio is sent securely to our scoring API, which compares your pronunciation against native speaker patterns and returns a score from 0 to 100. Recordings are never stored — they are processed in real time and discarded immediately.',
  },
  {
    q: 'How do I delete my account and data?',
    a: 'Go to Settings (or Profile), scroll to the bottom, and tap "Delete account". This permanently deletes your Firebase account, your Firestore user record, and all locally stored learning data. This action cannot be undone.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email us at support@shadowspeak.app. We aim to respond within 48 hours. For faster help, describe your issue and include the app version (shown at the bottom of the Settings screen).',
  },
];

export default function SupportScreen({ onBack }) {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (i) => setOpenIdx(openIdx === i ? null : i);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>Help & Support</h1>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
        {FAQS.map((faq, i) => (
          <div key={i} className={styles.faqItem}>
            <button
              className={styles.question}
              onClick={() => toggle(i)}
              aria-expanded={openIdx === i}
            >
              <span>{faq.q}</span>
              <span className={`${styles.chevron} ${openIdx === i ? styles.open : ''}`}>›</span>
            </button>
            {openIdx === i && <p className={styles.answer}>{faq.a}</p>}
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Contact Us</h2>
        <div className={styles.contactCard}>
          <p className={styles.contactText}>
            Couldn't find what you needed? Our support team is here to help.
          </p>
          <a
            href="mailto:support@shadowspeak.app"
            className={styles.emailBtn}
          >
            support@shadowspeak.app
          </a>
          <p className={styles.sla}>We aim to respond within 48 hours.</p>
        </div>
      </section>
    </div>
  );
}
