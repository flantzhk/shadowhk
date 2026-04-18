// src/components/screens/FAQScreen.jsx — Item 43

import { useState } from 'react';
import styles from './FAQScreen.module.css';

const FAQS = [
  {
    q: 'What is ShadowSpeak?',
    a: 'ShadowSpeak is an audio-first app for learning to speak Cantonese. You listen to native speakers, shadow their pronunciation, and get real-time scoring.',
  },
  {
    q: 'How does pronunciation scoring work?',
    a: 'Your recordings are sent securely to our scoring API which compares your pronunciation to native speaker patterns. Recordings are processed in real-time and never stored.',
  },
  {
    q: 'Do I need an internet connection?',
    a: 'You can download lessons for offline use. Pronunciation scoring requires a connection, but you can still listen to audio and practice without scoring offline.',
  },
  {
    q: 'What languages are supported?',
    a: 'Cantonese (廣東話) and Mandarin (普通話). Both are fully supported with real-time pronunciation scoring and complete lesson plans.',
  },
  {
    q: 'How does the streak work?',
    a: 'Complete at least one practice session per day to maintain your streak. A session is any practice mode — Shadow, Prompt, Speed Run, Tone Gym, or AI Chat.',
  },
  {
    q: 'What is Spaced Repetition (SRS)?',
    a: 'SRS schedules phrases for review at optimal intervals based on how well you know them. Phrases you find hard are shown more often; phrases you know well are shown less.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Profile → scroll to the bottom → "Delete account". This permanently deletes your account and all learning data.',
  },
  {
    q: 'Is my voice data stored?',
    a: 'No. Voice recordings are sent to our API for real-time scoring only and are never stored on our servers.',
  },
];

export default function FAQScreen({ onBack }) {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>‹ Back</button>
      <h1 className={styles.title}>Frequently Asked Questions</h1>
      <p className={styles.subtitle}>Quick answers to common questions.</p>
      <div className={styles.divider} />

      {FAQS.map((faq, i) => (
        <div key={i} className={styles.faqItem}>
          <button
            className={styles.question}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span>{faq.q}</span>
            <span className={`${styles.chevron} ${openIdx === i ? styles.open : ''}`}>›</span>
          </button>
          {openIdx === i && <p className={styles.answer}>{faq.a}</p>}
        </div>
      ))}

      <div className={styles.footer}>
        <p>Still have questions?</p>
        <a className={styles.contactLink} href="mailto:support@shadowspeak.app">Contact support</a>
      </div>
    </div>
  );
}
