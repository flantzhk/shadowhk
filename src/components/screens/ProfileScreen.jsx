// src/components/screens/ProfileScreen.jsx — Redesigned profile hero + grouped settings

import { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getAllLanguages } from '../../services/languageManager';
import { getCurrentUser, signOut, deleteAccount } from '../../services/auth';
import { DAILY_GOAL_OPTIONS, ROUTES, APP_VERSION } from '../../utils/constants';
import { fbDb, fbAuth } from '../../services/firebase';
import { getSettings, getAllLibraryEntries } from '../../services/storage';
import { ConfirmModal } from '../shared/ConfirmModal';
import { BottomSheet } from '../shared/BottomSheet';
import DownloadAllModal from '../shared/DownloadAllModal';
import styles from './ProfileScreen.module.css';

export default function ProfileScreen({ onBack, onNavigate, showToast }) {
  const { settings, updateSettings } = useAppContext();
  const user = getCurrentUser();
  const languages = getAllLanguages();

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(settings.name || '');
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings.reminderTime || '09:00');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadInBackground, setDownloadInBackground] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const initial = (settings.name || user?.displayName || user?.email || 'U')[0].toUpperCase();
  const displayName = settings.name || user?.displayName || user?.email?.split('@')[0] || 'Learner';
  const joinedDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const totalMinutes = settings.totalPracticeSeconds > 0
    ? Math.round(settings.totalPracticeSeconds / 60)
    : 0;

  const handleSignOut = async () => {
    await signOut();
    window.location.hash = `#${ROUTES.LOGIN}`;
  };

  const handleSaveName = () => {
    const trimmed = editNameValue.trim();
    if (trimmed) {
      updateSettings({ name: trimmed });
      showToast?.('Name updated', 'success');
    }
    setShowEditName(false);
  };

  const handleDownloadClose = (mode) => {
    if (mode === 'background') setDownloadInBackground(true);
    setShowDownloadModal(false);
  };

  const handleDownloadData = async () => {
    setExportLoading(true);
    try {
      const uid = fbAuth.currentUser?.uid;
      let profile = {};
      if (uid) {
        try {
          const doc = await fbDb.collection('users').doc(uid).get();
          if (doc.exists) {
            const d = doc.data();
            profile = {
              email: d.email || '',
              language_choice: d.language_choice || '',
              created_at: d.created_at?.toDate?.()?.toISOString() || null,
              subscription_status: d.subscription_status || 'free',
            };
          }
        } catch (_) { /* non-fatal */ }
      }

      const [localSettings, libraryEntries] = await Promise.all([
        getSettings(),
        getAllLibraryEntries(),
      ]);

      const progress = {
        streak: localSettings?.streakCount ?? 0,
        total_practice_seconds: localSettings?.totalPracticeSeconds ?? 0,
        achievements: localSettings?.achievements ?? [],
        srs_cards: libraryEntries.map((e) => ({
          phrase_id: e.phraseId,
          status: e.status,
          ease: e.ease,
          interval: e.interval,
          next_review_at: e.nextReviewAt,
          practice_count: e.practiceCount ?? 0,
        })),
      };

      const exportData = {
        exported_at: new Date().toISOString(),
        app_version: APP_VERSION,
        profile,
        progress,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shadowspeak-data-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast?.('Your data is ready — check your downloads', 'success');
    } catch (err) {
      showToast?.('Export failed. Please try again.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className={styles.screen}>

      {/* ── Back button ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* ── Hero card ── */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          {/* Avatar */}
          <div className={styles.avatarWrap}>
            {(settings.photoURL || user?.photoURL) ? (
              <img className={styles.avatar} src={settings.photoURL || user?.photoURL} referrerPolicy="no-referrer" alt="Profile" />
            ) : (
              <div className={styles.avatarInitial}>{initial}</div>
            )}
          </div>

          {/* Identity */}
          <div className={styles.identity}>
            <button className={styles.nameBtn} onClick={() => setShowEditName(true)}>
              <span className={styles.name}>{displayName}</span>
              <span className={styles.nameEdit}>Edit</span>
            </button>
            {user?.email && <p className={styles.email}>{user.email}</p>}
            {joinedDate && <p className={styles.joined}>Member since {joinedDate}</p>}
          </div>

          {/* Stats strip inside hero */}
          <div className={styles.heroStats}>
            <div className={styles.heroStat}>
              <span className={styles.heroStatIcon}>🔥</span>
              <span className={styles.heroStatNum}>{settings.streakCount ?? 0}</span>
              <span className={styles.heroStatLabel}>day streak</span>
            </div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}>
              <span className={styles.heroStatIcon}>⏱</span>
              <span className={styles.heroStatNum}>{totalMinutes}</span>
              <span className={styles.heroStatLabel}>min practiced</span>
            </div>
          </div>

          <button className={styles.statsLink} onClick={() => onNavigate?.(ROUTES.STATS)}>
            View detailed stats ›
          </button>
        </div>
      </div>

      {/* ── Learning ── */}
      <p className={styles.sectionLabel}>LEARNING</p>
      <div className={styles.card}>
        {/* Language */}
        <p className={styles.cardInnerLabel}>Language</p>
        <div className={styles.langRow}>
          {languages.map(lang => (
            <button key={lang.id}
              className={`${styles.langPill} ${settings.currentLanguage === lang.id ? styles.langActive : ''}`}
              onClick={() => updateSettings({ currentLanguage: lang.id })}>
              <span className={styles.langName}>{lang.name}</span>
              <span className={styles.langNative}>{lang.nativeName}</span>
            </button>
          ))}
        </div>

        <div className={styles.cardDivider} />

        {/* Daily goal */}
        <p className={styles.cardInnerLabel}>Daily goal</p>
        <div className={styles.goalRow}>
          {DAILY_GOAL_OPTIONS.map(mins => (
            <button key={mins}
              className={`${styles.goalPill} ${settings.dailyGoalMinutes === mins ? styles.goalActive : ''}`}
              onClick={() => updateSettings({ dailyGoalMinutes: mins })}>
              {mins} min
            </button>
          ))}
        </div>
      </div>

      {/* ── Display ── */}
      <p className={styles.sectionLabel}>DISPLAY</p>
      <div className={styles.card}>
        <ToggleRow label="Show characters" checked={settings.showCharacters}
          onChange={(v) => updateSettings({ showCharacters: v })} />
        <ToggleRow label="Show English translation" checked={settings.showEnglish}
          onChange={(v) => updateSettings({ showEnglish: v })} />
        <ToggleRow label="Auto-advance cards" checked={settings.autoAdvance}
          onChange={(v) => updateSettings({ autoAdvance: v })} />

        {/* Theme */}
        <div className={styles.themeRow}>
          <span className={styles.toggleLabel}>Theme</span>
          <div className={styles.themeSegment}>
            {[
              { id: 'system', label: 'Auto' },
              { id: 'light', label: '☀ Light' },
              { id: 'dark', label: '☾ Dark' },
            ].map(opt => (
              <button
                key={opt.id}
                className={`${styles.themeOption} ${(settings.themePreference || 'system') === opt.id ? styles.themeOptionActive : ''}`}
                onClick={() => updateSettings({ themePreference: opt.id })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Playback ── */}
      <p className={styles.sectionLabel}>PLAYBACK</p>
      <div className={styles.card}>
        <button className={styles.cardRow} onClick={() => setShowSpeedPicker(true)}>
          <span className={styles.rowLabel}>Default speed</span>
          <span className={styles.rowValue}>{settings.defaultSpeed === 'slower' ? 'Slower' : 'Natural'} ›</span>
        </button>
        <div className={styles.cardDivider} />
        <button className={styles.cardRow} onClick={() => setShowReminderPicker(true)}>
          <span className={styles.rowLabel}>Daily reminder</span>
          <span className={styles.rowValue}>{settings.reminderTime || 'Off'} ›</span>
        </button>
      </div>

      {/* ── Offline ── */}
      <p className={styles.sectionLabel}>OFFLINE</p>
      <div className={styles.card}>
        <p className={styles.cardHint}>Download all audio so lessons work without internet.</p>
        {downloadInBackground && (
          <p className={styles.cardHint} style={{ color: 'var(--color-brand-dark-text)', fontWeight: 600 }}>
            Downloading in background…
          </p>
        )}
        <button className={styles.downloadBtn} onClick={() => setShowDownloadModal(true)}>
          ↓ Download all audio
        </button>
      </div>

      {/* ── About ── */}
      {onNavigate && (
        <>
          <p className={styles.sectionLabel}>APP</p>
          <div className={styles.card}>
            <button className={styles.cardRow} onClick={() => onNavigate(ROUTES.ABOUT)}>
              <span className={styles.rowLabel}>About ShadowSpeak</span>
              <span className={styles.rowValue}>›</span>
            </button>
            <div className={styles.cardDivider} />
            <button className={styles.cardRow} onClick={() => onNavigate(ROUTES.FAQ)}>
              <span className={styles.rowLabel}>FAQ</span>
              <span className={styles.rowValue}>›</span>
            </button>
            <div className={styles.cardDivider} />
            <button className={styles.cardRow} onClick={() => onNavigate(ROUTES.SUPPORT)}>
              <span className={styles.rowLabel}>Help &amp; Support</span>
              <span className={styles.rowValue}>›</span>
            </button>
            <div className={styles.cardDivider} />
            <button className={styles.cardRow} onClick={() => onNavigate(ROUTES.CONTACT)}>
              <span className={styles.rowLabel}>Contact / Support</span>
              <span className={styles.rowValue}>›</span>
            </button>
            <div className={styles.cardDivider} />
            <button className={styles.cardRow} onClick={() => {
              window.location.href = 'mailto:support@shadowspeak.app?subject=Feedback';
              showToast?.('Opening your email app', 'info');
            }}>
              <span className={styles.rowLabel}>Send feedback</span>
              <span className={styles.rowValue}>›</span>
            </button>
          </div>
        </>
      )}

      {/* ── Danger zone ── */}
      <div className={styles.dangerZone}>
        <button className={styles.signOutBtn} onClick={() => setShowSignOutConfirm(true)}>
          Sign out
        </button>
        <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
          Delete account
        </button>
        <button
          className={styles.exportDataBtn}
          onClick={handleDownloadData}
          disabled={exportLoading}
        >
          {exportLoading ? 'Preparing export...' : 'Download my data'}
        </button>
      </div>

      <p className={styles.versionLabel}>ShadowSpeak v{APP_VERSION}</p>

      {/* ── Modals ── */}
      {showSignOutConfirm && (
        <ConfirmModal
          title="Sign out of ShadowSpeak?"
          body="Your progress is saved. You can sign back in anytime."
          confirmLabel="Sign out"
          destructive
          onConfirm={handleSignOut}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete your account?"
          body="This will permanently delete your account, progress, and all saved data. This cannot be undone."
          confirmLabel={deleting ? 'Deleting…' : 'Delete account'}
          destructive
          onConfirm={async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              const dbs = await window.indexedDB.databases?.() || [];
              for (const db of dbs) { if (db.name) window.indexedDB.deleteDatabase(db.name); }
              window.location.hash = `#${ROUTES.LOGIN}`;
              window.location.reload();
            } catch {
              setDeleting(false);
              showToast?.('Failed to delete account. You may need to sign in again first.', 'error');
              setShowDeleteConfirm(false);
            }
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showEditName && (
        <BottomSheet title="Edit name" onClose={() => setShowEditName(false)} showConfirm confirmLabel="Save" onConfirm={handleSaveName}>
          <label className={styles.fieldLabel}>FIRST NAME</label>
          <input className={styles.nameInput} value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)} maxLength={30} autoFocus />
          <p className={styles.fieldHint}>This is how ShadowSpeak will greet you.</p>
        </BottomSheet>
      )}

      {showSpeedPicker && (
        <BottomSheet title="Default speed" onClose={() => setShowSpeedPicker(false)}>
          <p className={styles.fieldHint}>Which speed should new lessons start with?</p>
          {[
            { id: 'slower', label: 'Slower', desc: 'Native speaker, slowed down. Better for beginners.' },
            { id: 'natural', label: 'Natural (recommended)', desc: 'Normal conversation speed.' },
          ].map(opt => (
            <button key={opt.id}
              className={`${styles.pickerOption} ${settings.defaultSpeed === opt.id ? styles.pickerSelected : ''}`}
              onClick={() => { updateSettings({ defaultSpeed: opt.id }); setShowSpeedPicker(false); }}>
              <span className={styles.pickerRadio}>{settings.defaultSpeed === opt.id ? '◉' : '○'}</span>
              <div className={styles.pickerText}>
                <span className={styles.pickerLabel}>{opt.label}</span>
                <span className={styles.pickerDesc}>{opt.desc}</span>
              </div>
            </button>
          ))}
        </BottomSheet>
      )}

      {showReminderPicker && (
        <BottomSheet title="Reminder time" onClose={() => setShowReminderPicker(false)}
          showConfirm confirmLabel="Save"
          onConfirm={() => { updateSettings({ reminderTime }); setShowReminderPicker(false); }}>
          <p className={styles.fieldHint}>When should we remind you to practice?</p>
          <input type="time" className={styles.timeInput} value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
        </BottomSheet>
      )}

      {showDownloadModal && (
        <DownloadAllModal language={settings.currentLanguage} onClose={handleDownloadClose} />
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <button className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
        <span className={styles.toggleKnob} />
      </button>
    </label>
  );
}
