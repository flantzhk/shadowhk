import styles from './Sidebar.module.css';
import { isAuthenticated } from '../../services/auth.js';

const TABS = [
  {
    id: 'home',
    label: 'Today',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="12" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="3" y="12" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="12" y="12" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    id: 'scenes',
    label: 'Scenes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <path d="M3 5a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 11l2.5 2.5L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'library',
    label: 'Library',
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
        <path d="M4 4h4v14H4zM9 4h4v14H9zM14 4l4 1v12l-4-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export function Sidebar({ activeTab, onNavigate }) {
  const authed = isAuthenticated();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo} onClick={() => onNavigate('home')}>
        <span className={styles.logoText}>ShadowHK</span>
      </div>

      <nav className={styles.nav}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
              onClick={() => onNavigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.icon}>{tab.icon}</span>
              <span className={styles.label}>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={styles.bottom}>
        {authed ? (
          <button className={styles.profileBtn} onClick={() => onNavigate('profile')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Profile</span>
          </button>
        ) : (
          <button className={styles.signInBtn} onClick={() => onNavigate('login')}>
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}
