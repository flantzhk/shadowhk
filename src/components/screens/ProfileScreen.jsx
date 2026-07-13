// src/components/screens/ProfileScreen.jsx — Redesigned profile hero + grouped settings

import { useState, useEffect } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { getCurrentUser, signOut, deleteAccount } from '../../services/auth';
import { DAILY_GOAL_OPTIONS, ROUTES, APP_VERSION } from '../../utils/constants';
import { fbDb, fbAuth } from '../../services/firebase';
import { getSettings, getAllLibraryEntries, getAllSessions } from '../../services/storage';
import { ConfirmModal } from '../shared/ConfirmModal';
import { BottomSheet } from '../shared/BottomSheet';
import DownloadAllModal from '../shared/DownloadAllModal';
import { getOfflineAudioStatus, subscribeAudioDownload } from '../../services/audioDownload';
import StatsPanel from './StatsScreen';
import styles from './ProfileScreen.module.css';

function getJoinMonths(user) {
  if (!user?.metadata?.creationTime) return null;
  const created = new Date(user.metadata.creationTime);
  const now = new Date();
  return Math.max(1, Math.round((now - created) / (1000 * 60 * 60 * 24 * 30)));
}

function getLast90Days(sessions) {
  const days = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const daySessions = sessions.filter(s => s.date === key);
    const mins = daySessions.reduce((acc, s) => acc + Math.round((s.durationSeconds ?? 0) / 60), 0);
    const intensity = mins === 0 ? 0 : mins < 5 ? 1 : mins < 15 ? 2 : mins < 30 ? 3 : 4;
    days.push({ key, mins, intensity });
  }
  return days;
}

export default function ProfileScreen({ onBack, onNavigate, navigate, goBack, showToast }) {
  const nav = onNavigate ?? navigate;
  const back = onBack ?? goBack;
  const { settings, updateSettings } = useAppContext();
  const user = getCurrentUser();

  const [activeTab, setActiveTab] = useState('you');
  const [last90, setLast90] = useState([]);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(settings.name || '');
  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderTime, setReminderTime] = useState(settings.reminderTime || '09:00');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState(null);

  const isGuest = !user;

  useEffect(() => {
    getAllSessions().catch(() => []).then(sessions => setLast90(getLast90Days(sessions)));
  }, []);

  useEffect(() => {
    let mounted = true;
    const refresh = () => getOfflineAudioStatus().then(s => { if (mounted) setOfflineStatus(s); });
    const unsubscribe = subscribeAudioDownload(s => { if (s.status === 'complete') refresh(); });
    refresh();
    return () => { mounted = false; unsubscribe(); };
  }, []);

  const initial = (settings.name || user?.displayName || user?.email || 'U')[0].toUpperCase();
  const displayName = settings.name || user?.displayName || user?.email?.split('@')[0] || 'Learner';
  const joinMonths = getJoinMonths(user);

  const handleSignOut = async () => {
    await signOut();
    window.location.hash = `#${ROUTES.LOGIN}`;
  };

  const handleSaveName = () => {
    const trimmed = editNameValue.trim();
    if (trimmed) { updateSettings({ name: trimmed }); showToast?.('Name updated', 'success'); }
    setShowEditName(false);
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
            profile = { email: d.email || '', language_choice: d.language_choice || '', created_at: d.created_at?.toDate?.()?.toISOString() || null, subscription_status: d.subscription_status || 'free' };
          }
        } catch (_) {}
      }
      const [localSettings, libraryEntries] = await Promise.all([getSettings(), getAllLibraryEntries()]);
      const exportData = {
        exported_at: new Date().toISOString(),
        app_version: APP_VERSION,
        profile,
        progress: {
          streak: localSettings?.streakCount ?? 0,
          total_practice_seconds: localSettings?.totalPracticeSeconds ?? 0,
          achievements: localSettings?.achievements ?? [],
          srs_cards: libraryEntries.map(e => ({ phrase_id: e.phraseId, status: e.status, ease: e.ease, interval: e.interval, next_review_at: e.nextReviewAt, practice_count: e.practiceCount ?? 0 })),
        },
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'shadowspeak-data-export.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast?.('Your data is ready, check your downloads', 'success');
    } catch (_) {
      showToast?.('Export failed. Please try again.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className={styles.screen}>

      {/* Guest hero: no fake identity, just the one thing an account adds */}
      {isGuest ? (
        <div className={styles.guestHero}>
          <p className={styles.guestHeroTitle}>Keep your progress</p>
          <p className={styles.guestHeroBody}>
            Practice works without an account and stays on this device. Sign in to
            back it up, sync across devices, and keep your streak safe.
          </p>
          <button className={styles.guestSignInBtn} onClick={() => nav?.(ROUTES.LOGIN)}>
            Sign in or create account
          </button>
        </div>
      ) : (
      <div className={styles.profileRow}>
        <div className={styles.avatar}>
          {(settings.photoURL || user?.photoURL) ? (
            <img className={styles.avatarImg} src={settings.photoURL || user?.photoURL} referrerPolicy="no-referrer" alt="Profile" />
          ) : (
            <span className={styles.avatarInitial}>{initial}</span>
          )}
        </div>
        <div>
          <div className={styles.nameRow}>
            <span className={styles.name}>{displayName}</span>
            <button className={styles.editBtn} onClick={() => setShowEditName(true)}>
              <span className={styles.editBtnText}>EDIT →</span>
            </button>
          </div>
          <span className={styles.heroBrow}>
            {joinMonths ? `${joinMonths} MO MEMBER` : 'NEW MEMBER'}
            {' · '}{(settings.currentLanguage ?? 'cantonese').toUpperCase()}
          </span>
        </div>
      </div>
      )}

      {/* Tabs — Progress folded into You: one continuous scroll, no dead page.
          Guests skip straight to settings; there are no stats to show. */}
      {!isGuest && (
      <div className={styles.tabs}>
        {[['you', 'You'], ['settings', 'Settings']].map(([id, label]) => (
          <button
            key={id}
            className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      )}

      {/* You tab: streak, today/week, lifetime stats, level, achievements, heatmap */}
      {!isGuest && activeTab === 'you' && (
        <div className={styles.tabContent}>
          <StatsPanel />

          {last90.length > 0 && (
            <div className={styles.heatmapSection}>
              <p className={styles.heatmapTitle}>LAST 13 WEEKS</p>
              <div className={styles.heatmapGrid}>
                {last90.slice(-91).map((day, i) => (
                  <div
                    key={i}
                    className={`${styles.heatCell} ${styles[`heat${day.intensity}`]}`}
                    title={`${day.key}: ${day.mins} min`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings tab (guests always see it; it's their whole page) */}
      {(isGuest || activeTab === 'settings') && (
      <div className={styles.tabContent}>
      {/* Learning. The app is Cantonese only, so there is no language picker. */}
      <p className={styles.sectionLabel}>LEARNING</p>
      <div className={styles.card}>
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

      {/* Display */}
      <p className={styles.sectionLabel}>DISPLAY</p>
      <div className={styles.card}>
        <ToggleRow label="Show characters" checked={settings.showCharacters} onChange={v => updateSettings({ showCharacters: v })} />
        <ToggleRow label="Show English translation" checked={settings.showEnglish} onChange={v => updateSettings({ showEnglish: v })} />
        <ToggleRow label="Auto-advance cards" checked={settings.autoAdvance} onChange={v => updateSettings({ autoAdvance: v })} />
        <div className={styles.themeRow}>
          <span className={styles.toggleLabel}>Theme</span>
          <div className={styles.themeSegment}>
            {[{ id: 'system', label: 'Auto' }, { id: 'light', label: '☀ Light' }, { id: 'dark', label: '☾ Dark' }].map(opt => (
              <button key={opt.id}
                className={`${styles.themeOption} ${(settings.themePreference || 'system') === opt.id ? styles.themeOptionActive : ''}`}
                onClick={() => updateSettings({ themePreference: opt.id })}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings */}
      <p className={styles.sectionLabel}>SETTINGS</p>
      <div className={styles.card}>
        <button className={styles.settingsRow} onClick={() => setShowSpeedPicker(true)}>
          <span className={styles.rowLabel}>Default speed</span>
          <span className={styles.rowValue}>{settings.defaultSpeed === 'slower' ? 'Slower' : 'Natural'} ›</span>
        </button>
        {!isGuest && (
          <button className={styles.settingsRow} onClick={() => setShowReminderPicker(true)}>
            <span className={styles.rowLabel}>Daily reminder</span>
            <span className={styles.rowValue}>{settings.reminderTime || 'Off'} ›</span>
          </button>
        )}
        <button className={styles.settingsRow} onClick={() => setShowDownloadModal(true)}>
          <span className={styles.rowLabel}>Offline audio</span>
          <span className={styles.rowValue}>
            {offlineStatus === null ? '›'
              : offlineStatus.ready ? 'Ready ✓ ›'
              : offlineStatus.cachedCount > 0 ? 'Incomplete ›'
              : 'Download all ›'}
          </span>
        </button>
      </div>

      {/* App */}
      {nav && (
        <>
          <p className={styles.sectionLabel}>APP</p>
          <div className={styles.card}>
            <button className={styles.settingsRow} onClick={() => nav(ROUTES.FAQ)}>
              <span className={styles.rowLabel}>FAQ</span>
              <span className={styles.rowValue}>›</span>
            </button>
            <button className={styles.settingsRow} onClick={() => nav(ROUTES.SUPPORT)}>
              <span className={styles.rowLabel}>Help &amp; Support</span>
              <span className={styles.rowValue}>›</span>
            </button>
            <button className={styles.settingsRow} onClick={() => {
              window.location.href = 'mailto:support@shadowspeak.app?subject=Feedback';
            }}>
              <span className={styles.rowLabel}>Send feedback</span>
              <span className={styles.rowValue}>›</span>
            </button>
          </div>
        </>
      )}

      {/* Danger zone (account actions; nothing here applies to guests) */}
      {!isGuest && (
      <div className={styles.dangerZone}>
        <button className={styles.signOutBtn} onClick={() => setShowSignOutConfirm(true)}>Sign out</button>
        <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>Delete account</button>
        <button className={styles.exportDataBtn} onClick={handleDownloadData} disabled={exportLoading}>
          {exportLoading ? 'Preparing export...' : 'Download my data'}
        </button>
      </div>
      )}

      <p className={styles.versionLabel}>ShadowSpeak v{APP_VERSION}</p>
      </div>
      )}

      {/* Modals */}
      {showSignOutConfirm && (
        <ConfirmModal title="Sign out of ShadowSpeak?" body="Your progress is saved. You can sign back in anytime." confirmLabel="Sign out" destructive onConfirm={handleSignOut} onCancel={() => setShowSignOutConfirm(false)} />
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
          <input className={styles.nameInput} value={editNameValue} onChange={e => setEditNameValue(e.target.value)} maxLength={30} autoFocus />
        </BottomSheet>
      )}

      {showSpeedPicker && (
        <BottomSheet title="Default speed" onClose={() => setShowSpeedPicker(false)}>
          {[{ id: 'slower', label: 'Slower', desc: 'Native speaker, slowed down.' }, { id: 'natural', label: 'Natural (recommended)', desc: 'Normal conversation speed.' }].map(opt => (
            <button key={opt.id}
              className={`${styles.pickerOption} ${settings.defaultSpeed === opt.id ? styles.pickerSelected : ''}`}
              onClick={() => { updateSettings({ defaultSpeed: opt.id }); setShowSpeedPicker(false); }}>
              <span className={styles.pickerRadio}>{settings.defaultSpeed === opt.id ? '◉' : '○'}</span>
              <div>
                <span className={styles.pickerLabel}>{opt.label}</span>
                <span className={styles.pickerDesc}>{opt.desc}</span>
              </div>
            </button>
          ))}
        </BottomSheet>
      )}

      {showReminderPicker && (
        <BottomSheet title="Reminder time" onClose={() => setShowReminderPicker(false)} showConfirm confirmLabel="Save" onConfirm={() => { updateSettings({ reminderTime }); setShowReminderPicker(false); }}>
          <input type="time" className={styles.timeInput} value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
        </BottomSheet>
      )}

      {showDownloadModal && (
        <DownloadAllModal language={settings.currentLanguage} onClose={() => setShowDownloadModal(false)} />
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className={styles.toggleRow}>
      <span className={styles.toggleLabel}>{label}</span>
      <button className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
        <span className={styles.toggleKnob} />
      </button>
    </label>
  );
}
