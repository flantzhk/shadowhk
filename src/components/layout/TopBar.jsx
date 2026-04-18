import styles from './TopBar.module.css';
import { isAuthenticated } from '../../services/auth.js';

export function TopBar({ onNavigate }) {
  const authed = isAuthenticated();

  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        <span className={styles.logoText}>ShadowHK</span>
      </div>
      <div className={styles.actions}>
        {authed ? (
          <button
            className={styles.avatar}
            onClick={() => onNavigate('profile')}
            aria-label="Profile"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        ) : (
          <button className={styles.signIn} onClick={() => onNavigate('login')}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
