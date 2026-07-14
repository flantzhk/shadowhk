import styles from './LanguageSwitcher.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { SUPPORTED_LANGUAGES } from '../../utils/constants.js';

// Always-visible language toggle, rendered in both TopBar and Sidebar so
// switching never requires a trip to Profile/Settings.
export function LanguageSwitcher({ className = '' }) {
  const { settings, updateSettings } = useAppContext();
  const current = settings?.currentLanguage ?? 'cantonese';

  return (
    <div className={`${styles.switcher} ${className}`} role="group" aria-label="Language">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang.id}
          className={`${styles.pill} ${current === lang.id ? styles.active : ''}`}
          onClick={() => updateSettings({ currentLanguage: lang.id })}
          aria-pressed={current === lang.id}
          title={lang.name}
        >
          {lang.nativeName}
        </button>
      ))}
    </div>
  );
}
