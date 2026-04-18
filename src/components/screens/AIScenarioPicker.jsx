// src/components/screens/AIScenarioPicker.jsx — Item 23

import styles from './AIScenarioPicker.module.css';

const SCENARIOS = [
  { id: 'cha-chaan-teng', emoji: '☕', title: 'Ordering at a cha chaan teng', role: 'You: customer. AI: staff.', duration: '~3 min', difficulty: 'Easy' },
  { id: 'taxi', emoji: '🚕', title: 'Taking a taxi to Central', role: 'You: passenger. AI: driver.', duration: '~4 min', difficulty: 'Easy' },
  { id: 'school-gate', emoji: '🏫', title: 'School gate chat', role: 'You: parent. AI: teacher.', duration: '~5 min', difficulty: 'Medium' },
  { id: 'dim-sum', emoji: '🥟', title: 'Dim sum with friends', role: 'You: guest. AI: host + staff.', duration: '~6 min', difficulty: 'Medium' },
  { id: 'wet-market', emoji: '🛒', title: 'Wet market bargaining', role: 'You: buyer. AI: vendor.', duration: '~4 min', difficulty: 'Medium' },
  { id: 'pharmacy', emoji: '💊', title: 'At the pharmacy', role: 'You: patient. AI: pharmacist.', duration: '~4 min', difficulty: 'Easy' },
  { id: 'mtr', emoji: '🚇', title: 'Asking for directions on the MTR', role: 'You: tourist. AI: local.', duration: '~3 min', difficulty: 'Easy' },
  { id: 'doctor', emoji: '🏥', title: 'Visiting the doctor', role: 'You: patient. AI: doctor.', duration: '~7 min', difficulty: 'Hard' },
];

const SUGGESTED = SCENARIOS.slice(0, 2);
const ALL = SCENARIOS.slice(2);

export default function AIScenarioPicker({ onBack, onNavigate, onSelectScenario }) {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <ChevronIcon />
        </button>
        <span className={styles.onlineIndicator}>Online ●</span>
      </div>

      <h1 className={styles.title}>AI Practice</h1>
      <p className={styles.subtitle}>Have a real conversation with an AI that speaks Cantonese.</p>

      <div className={styles.divider} />

      <p className={styles.sectionLabel}>SUGGESTED FOR YOU</p>
      {SUGGESTED.map(s => (
        <ScenarioCard key={s.id} scenario={s} onSelect={() => onSelectScenario?.(s)} featured />
      ))}

      <div className={styles.divider} />

      <p className={styles.sectionLabel}>ALL SCENARIOS</p>
      {ALL.map(s => (
        <ScenarioCard key={s.id} scenario={s} onSelect={() => onSelectScenario?.(s)} />
      ))}
    </div>
  );
}

function ScenarioCard({ scenario, onSelect, featured }) {
  return (
    <button className={`${styles.card} ${featured ? styles.featured : styles.compact}`} onClick={onSelect}>
      <span className={styles.emoji}>{scenario.emoji}</span>
      <div className={styles.cardContent}>
        <p className={styles.cardTitle}>{scenario.title}</p>
        {featured && <p className={styles.cardRole}>{scenario.role}</p>}
        {featured && (
          <p className={styles.cardMeta}>{scenario.duration} · {scenario.difficulty}</p>
        )}
      </div>
    </button>
  );
}

const ChevronIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
