// src/components/screens/ContactScreen.jsx — Item 44

import { useState } from 'react';
import styles from './ContactScreen.module.css';

export default function ContactScreen({ onBack, showToast }) {
  const [type, setType] = useState('support');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    const subject = type === 'feedback' ? 'Feedback' : type === 'bug' ? 'Bug report' : 'Support request';
    window.location.href = `mailto:support@shadowspeak.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    setSent(true);
    showToast?.('Message opened in your email app', 'info');
  };

  return (
    <div className={styles.screen}>
      <button className={styles.backBtn} onClick={onBack}>‹ Back</button>
      <h1 className={styles.title}>Contact us</h1>
      <p className={styles.subtitle}>We typically reply within 1 business day.</p>

      <div className={styles.typeRow}>
        {[['support', 'Support'], ['feedback', 'Feedback'], ['bug', 'Bug report']].map(([val, label]) => (
          <button
            key={val}
            className={`${styles.typePill} ${type === val ? styles.typeActive : ''}`}
            onClick={() => setType(val)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className={styles.fieldLabel}>MESSAGE</label>
      <textarea
        className={styles.textarea}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe your issue or question..."
        rows={6}
      />

      <div className={styles.contactOptions}>
        <p className={styles.contactLabel}>Or reach us directly:</p>
        <a className={styles.contactLink} href="mailto:support@shadowspeak.app">support@shadowspeak.app</a>
      </div>

      <button
        className={`${styles.sendBtn} ${!message.trim() ? styles.disabled : ''}`}
        onClick={handleSend}
        disabled={!message.trim()}
      >
        Open in email app
      </button>
    </div>
  );
}
