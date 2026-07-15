import styles from './TopBar.module.css';
import { isAuthenticated, getCurrentUser } from '../../services/auth.js';
import { useAppContext } from '../../contexts/AppContext';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';

export function TopBar({ onNavigate }) {
  const authed = isAuthenticated();
  const { settings } = useAppContext();
  const user = authed ? getCurrentUser() : null;
  const photoURL = settings.photoURL || user?.photoURL;
  const initial = (settings.name || user?.displayName || user?.email || '')[0]?.toUpperCase();

  return (
    <header className={styles.topbar}>
      <div className={styles.logo} onClick={() => onNavigate('home')} aria-label="ShadowHK home">
        <span className={styles.logoGlyph}>影</span>
      </div>
      <div className={styles.actions}>
        <LanguageSwitcher className={styles.langSwitcher} />
        {authed ? (
          <button
            className={styles.avatar}
            onClick={() => onNavigate('profile')}
            aria-label="Profile"
          >
            {photoURL ? (
              <img className={styles.avatarImg} src={photoURL} referrerPolicy="no-referrer" alt="" />
            ) : initial ? (
              <span className={styles.avatarInitial}>{initial}</span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
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
