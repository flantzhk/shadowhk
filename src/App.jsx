// src/App.jsx — Root: router, context providers, layout shell

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { AudioProvider } from './contexts/AudioContext';
import { TopBar } from './components/layout/TopBar';
import { BottomTabBar } from './components/layout/BottomTabBar';
import { Sidebar } from './components/layout/Sidebar';
import { ROUTES } from './utils/constants';
import { isAuthenticated, waitForAuth, updateLastActive, handleGoogleRedirectResult } from './services/auth';
import { clearAllData } from './services/storage';
import { initOfflineQueueListener } from './services/offlineManager';
import { hasAnalyticsConsent } from './services/consent';
import { initPostHog, phIdentify } from './services/posthog';
import { pullLibraryFromFirestore, pullStreakFromFirestore } from './services/sync';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useToast } from './components/shared/Toast';
import { logger } from './utils/logger';
import './styles/global.css';

// ── Screen imports ─────────────────────────────────────────────────────────
const HomeScreen         = lazy(() => import('./components/screens/HomeScreen'));
const ScenesScreen       = lazy(() => import('./components/screens/ScenesScreen'));
const SceneDetailScreen  = lazy(() => import('./components/screens/SceneDetailScreen'));
const ListenMode         = lazy(() => import('./components/screens/ListenMode'));
const LibraryScreen      = lazy(() => import('./components/screens/LibraryScreen'));
const PracticeScreen     = lazy(() => import('./components/screens/PracticeScreen'));
const ToneTrainer        = lazy(() => import('./components/screens/ToneTrainer'));
const PhraseDetailScreen = lazy(() => import('./components/screens/PhraseDetailScreen'));
const SearchScreen       = lazy(() => import('./components/screens/SearchScreen'));
const ShadowSession      = lazy(() => import('./components/screens/ShadowSession'));
const SessionSummary     = lazy(() => import('./components/screens/SessionSummary'));
const FirstRunFlow       = lazy(() => import('./components/screens/FirstRunFlow'));
const ProfileScreen      = lazy(() => import('./components/screens/ProfileScreen'));
const SettingsScreen     = lazy(() => import('./components/screens/SettingsScreen'));
const DayDetailScreen    = lazy(() => import('./components/screens/DayDetailScreen'));
const LoginScreen        = lazy(() => import('./components/screens/LoginScreen'));
const RegisterScreen     = lazy(() => import('./components/screens/RegisterScreen'));
const ForgotPasswordScreen = lazy(() => import('./components/screens/ForgotPasswordScreen'));
const EmailVerification  = lazy(() => import('./components/screens/EmailVerification'));
const NewPassword        = lazy(() => import('./components/screens/NewPassword'));
const PromptDrill        = lazy(() => import('./components/screens/PromptDrill'));
const SpeedRun           = lazy(() => import('./components/screens/SpeedRun'));
const ToneGym            = lazy(() => import('./components/screens/ToneGym'));
const ToneGymResults     = lazy(() => import('./components/screens/ToneGymResults'));
const DialogueSceneLoader = lazy(() => import('./components/screens/DialogueSceneLoader'));
const SceneSummary       = lazy(() => import('./components/screens/SceneSummary'));
const AIConversation     = lazy(() => import('./components/screens/AIConversation'));
const AIScenarioPicker   = lazy(() => import('./components/screens/AIScenarioPicker'));
const AdminDashboard     = lazy(() => import('./components/screens/AdminDashboard'));
const SupportScreen      = lazy(() => import('./components/screens/SupportScreen'));
const FAQScreen          = lazy(() => import('./components/screens/FAQScreen'));
const ContactScreen      = lazy(() => import('./components/screens/ContactScreen'));
const AboutScreen        = lazy(() => import('./components/screens/AboutScreen'));
const LegalPage          = lazy(() => import('./components/screens/LegalPage'));
const LicensesScreen     = lazy(() => import('./components/screens/LicensesScreen'));
const CheckoutSuccess    = lazy(() => import('./components/screens/CheckoutSuccessScreen'));
const Paywall            = lazy(() => import('./components/screens/onboarding/screens/Screen16_Paywall'));
const IntroduceYourselfForm = lazy(() => import('./components/screens/IntroduceYourselfForm'));
const ReferenceScreen       = lazy(() => import('./components/screens/ReferenceScreen'));
const JyutpingGuide         = lazy(() => import('./components/screens/JyutpingGuide'));

// ── Router ─────────────────────────────────────────────────────────────────

function parseHash(hash) {
  const clean = hash.replace(/^#\/?/, '');
  if (!clean) return { path: ROUTES.HOME, id: null };
  const slash = clean.indexOf('/');
  if (slash === -1) return { path: clean, id: null };
  // Assigning to location.hash auto-encodes non-ASCII characters (our vocab
  // word ids embed raw CJK text, e.g. "wet-market-vocab-斤"), but reading it
  // back never decodes them — every id with non-ASCII characters silently
  // failed every lookup. Decode here, once, at the source.
  let id = clean.slice(slash + 1);
  try { id = decodeURIComponent(id); } catch { /* malformed escape, use as-is */ }
  return { path: clean.slice(0, slash), id };
}

function useRouter() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  const navigate = useCallback((path, id) => {
    window.location.hash = id ? `#${path}/${id}` : `#${path}`;
  }, []);
  const goBack = useCallback(() => {
    window.location.hash = `#${ROUTES.HOME}`;
  }, []);
  return { route, navigate, goBack };
}

function useDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 900px)');
    const h = (e) => setIsDesktop(e.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, []);
  return isDesktop;
}

// ── Route categories ───────────────────────────────────────────────────────

const PUBLIC_ROUTES = new Set([
  ROUTES.LOGIN, ROUTES.REGISTER, ROUTES.FORGOT_PASSWORD,
  ROUTES.NEW_PASSWORD, ROUTES.EMAIL_VERIFY,
  ROUTES.PRIVACY, ROUTES.TERMS, ROUTES.SUPPORT, ROUTES.FIRSTRUN,
]);

// Routes that hide the app chrome (tabs/topbar/sidebar) for immersive experience
const CHROME_HIDDEN_ROUTES = new Set([
  ROUTES.SHADOW, ROUTES.PROMPT_DRILL, ROUTES.SPEED_RUN,
  ROUTES.TONE_GYM, ROUTES.TONE_GYM_RESULTS, ROUTES.DRILL_TONE, ROUTES.DIALOGUE,
  ROUTES.LISTEN, ROUTES.FIRSTRUN,
  ROUTES.SESSION_END, ROUTES.SCENE_END,
]);

// All immersive screens use near-black — set on <html> so body never bleeds cream
const DARK_BG_ROUTES = new Set([
  ROUTES.SHADOW, ROUTES.LISTEN,
  ROUTES.SESSION_END, ROUTES.SCENE_END,
  ROUTES.TONE_GYM, ROUTES.TONE_GYM_RESULTS,
  ROUTES.PROMPT_DRILL, ROUTES.SPEED_RUN, ROUTES.DIALOGUE,
  ROUTES.FIRSTRUN, ROUTES.DRILL_TONE,
]);

// ── Loader ─────────────────────────────────────────────────────────────────

const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1 }}>
    <div className="spin-loader" />
  </div>
);

// ── Screen renderer ────────────────────────────────────────────────────────

function renderScreen(route, navigate, goBack, showToast, updateSettings) {
  const { path, id } = route;
  switch (path) {
    case ROUTES.HOME:            return <HomeScreen onNavigate={navigate} />;
    case ROUTES.SCENES:          return <ScenesScreen onNavigate={navigate} />;
    case ROUTES.SCENE_DETAIL:    return <SceneDetailScreen sceneId={id} onNavigate={navigate} onBack={goBack} />;
    case ROUTES.LISTEN:          return <ListenMode sceneId={id} onNavigate={navigate} onBack={goBack} />;
    case ROUTES.LIBRARY:         return <LibraryScreen onNavigate={navigate} />;
    case ROUTES.PRACTICE:        return <PracticeScreen onNavigate={navigate} onBack={goBack} />;
    case ROUTES.DRILL_TONE:      return <ToneTrainer onNavigate={navigate} onBack={goBack} />;
    case ROUTES.PHRASE_DETAIL:   return <PhraseDetailScreen phraseId={id} onNavigate={navigate} onBack={goBack} />;
    case ROUTES.SEARCH:          return <SearchScreen onNavigate={navigate} onBack={goBack} />;
    case ROUTES.SHADOW:          return <ShadowSession sceneId={id} onNavigate={navigate} onBack={goBack} onComplete={(s) => { try { sessionStorage.setItem('shadowSummary', JSON.stringify(s)); } catch {} navigate(ROUTES.SESSION_END); }} />;
    case ROUTES.SESSION_END:     return <SessionSummary summary={(() => { try { return JSON.parse(sessionStorage.getItem('shadowSummary') || 'null'); } catch { return null; } })()} onDone={() => navigate(ROUTES.HOME)} />;
    case ROUTES.PROFILE:         return <ProfileScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.SETTINGS:        return <SettingsScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.DAY_DETAIL:      return <DayDetailScreen date={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.AI_CHAT:         return <AIConversation onBack={goBack} onNavigate={navigate} />;
    case ROUTES.AI_SCENARIO:     return <AIScenarioPicker onBack={goBack} onNavigate={navigate} onSelectScenario={(s) => { try { sessionStorage.setItem('aiScenario', JSON.stringify(s)); } catch {} navigate(ROUTES.AI_CHAT); }} />;
    case ROUTES.PROMPT_DRILL:    return <PromptDrill onBack={goBack} onComplete={() => navigate(ROUTES.HOME)} />;
    case ROUTES.SPEED_RUN:       return <SpeedRun onBack={goBack} onComplete={() => navigate(ROUTES.HOME)} />;
    case ROUTES.TONE_GYM:        return <ToneGym onBack={goBack} onComplete={(s) => { try { sessionStorage.setItem('toneGymSummary', JSON.stringify(s)); } catch {} navigate(ROUTES.TONE_GYM_RESULTS); }} />;
    case ROUTES.TONE_GYM_RESULTS: return <ToneGymResults summary={(() => { try { return JSON.parse(sessionStorage.getItem('toneGymSummary') || 'null'); } catch { return null; } })()} onDone={() => navigate(ROUTES.HOME)} onPlayAgain={() => navigate(ROUTES.TONE_GYM)} />;
    case ROUTES.DIALOGUE:        return <DialogueSceneLoader sceneId={id} onBack={goBack} onComplete={(s) => { try { sessionStorage.setItem('dialogueSummary', JSON.stringify(s)); } catch {} navigate(ROUTES.SCENE_END); }} />;
    case ROUTES.SCENE_END: {
      const dialogueSummary = (() => { try { return JSON.parse(sessionStorage.getItem('dialogueSummary') || 'null'); } catch { return null; } })();
      return (
        <SceneSummary
          summary={dialogueSummary}
          chatLog={dialogueSummary?.chatLog}
          sceneTitle={dialogueSummary?.sceneTitle}
          onDone={() => navigate(ROUTES.HOME)}
          onReplay={dialogueSummary?.sceneId ? () => navigate(ROUTES.DIALOGUE, dialogueSummary.sceneId) : undefined}
          showToast={showToast}
        />
      );
    }
    case ROUTES.PAYWALL:         return <Paywall onComplete={() => navigate(ROUTES.HOME)} updateSettings={updateSettings} />;
    case ROUTES.LOGIN:           return <LoginScreen navigate={navigate} />;
    case ROUTES.REGISTER:        return <RegisterScreen navigate={navigate} />;
    case ROUTES.FORGOT_PASSWORD: return <ForgotPasswordScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.EMAIL_VERIFY:    return <EmailVerification onVerified={() => navigate(ROUTES.HOME)} onBack={goBack} />;
    case ROUTES.NEW_PASSWORD:    return <NewPassword onBack={goBack} showToast={showToast} />;
    case ROUTES.ADMIN:           return <AdminDashboard onBack={goBack} />;
    case ROUTES.SUPPORT:         return <SupportScreen onBack={goBack} />;
    case ROUTES.FAQ:             return <FAQScreen onBack={goBack} />;
    case ROUTES.CONTACT:         return <ContactScreen onBack={goBack} showToast={showToast} />;
    case ROUTES.ABOUT:           return <AboutScreen onNavigate={navigate} onBack={goBack} />;
    case ROUTES.PRIVACY:         return <LegalPage type="privacy" onBack={goBack} />;
    case ROUTES.TERMS:           return <LegalPage type="terms" onBack={goBack} />;
    case ROUTES.LICENSES:        return <LicensesScreen onBack={goBack} />;
    case ROUTES.CHECKOUT_SUCCESS: return <CheckoutSuccess onDone={() => navigate(ROUTES.HOME)} />;
    case ROUTES.INTRODUCE_YOURSELF: return <IntroduceYourselfForm onBack={goBack} onComplete={() => navigate(ROUTES.SHADOW, 'personal-introduce-yourself')} />;
    case ROUTES.REFERENCE:         return <ReferenceScreen referenceId={id} onBack={goBack} onNavigate={navigate} />;
    case ROUTES.JYUTPING_GUIDE:  return <JyutpingGuide onBack={goBack} onNavigate={navigate} />;
    default:                     return <HomeScreen onNavigate={navigate} />;
  }
}

// ── Main layout ────────────────────────────────────────────────────────────

function MainLayout() {
  const { route, navigate, goBack } = useRouter();
  const isDesktop = useDesktop();
  const { settings, isLoading, updateSettings } = useAppContext();
  const { showToast, ToastComponent } = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  // Dev-only bypass so the app is reachable without Firebase sign-in while
  // it's still being built. import.meta.env.DEV is false in a production
  // build, so this never reaches real users.
  const authed = isAuthenticated() || import.meta.env.DEV;

  const [checkoutResult] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('checkout');
  });

  // Stamp the <html> bg colour so the body never bleeds cream behind dark screens
  useEffect(() => {
    document.documentElement.style.background = DARK_BG_ROUTES.has(route.path)
      ? '#1a1714'
      : '';
  }, [route.path]);

  useEffect(() => {
    if (checkoutResult) {
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url.toString());
    }
  }, [checkoutResult]);

  useEffect(() => {
    const pref = settings.themePreference || 'system';
    if (pref === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (pref === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }, [settings.themePreference]);

  useEffect(() => {
    if (hasAnalyticsConsent()) initPostHog();
    initOfflineQueueListener();

    const timeout = setTimeout(() => {
      setAuthError('Unable to connect. Check your connection and reload.');
      setAuthReady(true);
    }, 10000);

    // Handle the OAuth redirect result (Google or Apple) BEFORE continuing —
    // it creates the Firestore user doc for new sign-ups; running it in
    // parallel raced against updateLastActive and left partial user docs.
    handleGoogleRedirectResult()
      .catch(err => logger.warn('[App] OAuth redirect result error', err))
      .then(() => waitForAuth())
      .then(async (user) => {
      clearTimeout(timeout);
      if (user) {
        // Different account than last time on this device: wipe local data
        // before pulling, otherwise the previous user's phrases would merge
        // into (and sync up to) the new user's library.
        const lastUid = localStorage.getItem('shadowhk_last_uid');
        if (lastUid && lastUid !== user.uid) {
          localStorage.setItem('shadowhk_last_uid', user.uid);
          await clearAllData().catch(err => logger.warn('[App] account-switch wipe failed', err?.message));
          window.location.reload();
          return;
        }
        localStorage.setItem('shadowhk_last_uid', user.uid);
        const updates = {};
        const name = (user.displayName || '').split(' ')[0];
        if (name && name !== settings.name) updates.name = name;
        if (user.photoURL) updates.photoURL = user.photoURL;
        if (!settings.firstrunCompleted) updates.firstrunCompleted = true;
        if (Object.keys(updates).length > 0) updateSettings(updates);
        updateLastActive();
        pullLibraryFromFirestore().catch(err => logger.warn('[App] library sync failed', err?.message));
        pullStreakFromFirestore().then((remote) => {
          if (remote) updateSettings(remote);
        }).catch(err => logger.warn('[App] streak sync failed', err?.message));
        phIdentify(user.uid, { email: user.email || '', language: settings.currentLanguage });
      }
      setAuthReady(true);
    }).catch(() => {
      clearTimeout(timeout);
      setAuthError('Failed to initialize. Please reload.');
      setAuthReady(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !authReady) return <Loader />;

  if (authError && !authed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center', gap: 16 }}>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{authError}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--color-brand-dark)', color: '#fff', fontWeight: 600, fontSize: 15 }}>
          Reload
        </button>
      </div>
    );
  }

  if (checkoutResult === 'success' && authed) {
    return (
      <Suspense fallback={<Loader />}>
        <CheckoutSuccess onDone={() => navigate(ROUTES.HOME)} />
      </Suspense>
    );
  }

  // First-run: unauthenticated + not completed first-run
  if (!authed && !settings.firstrunCompleted) {
    if (PUBLIC_ROUTES.has(route.path)) {
      return (
        <Suspense fallback={<Loader />}>
          {renderScreen(route, navigate, goBack, showToast, updateSettings)}
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<Loader />}>
        <FirstRunFlow onNavigate={navigate} onComplete={() => navigate(ROUTES.HOME)} />
      </Suspense>
    );
  }

  // Returning unauthenticated user
  if (!authed) {
    if (PUBLIC_ROUTES.has(route.path)) {
      return (
        <Suspense fallback={<Loader />}>
          {renderScreen(route, navigate, goBack, showToast, updateSettings)}
        </Suspense>
      );
    }
    navigate(ROUTES.LOGIN);
    return null;
  }

  const hideChrome = CHROME_HIDDEN_ROUTES.has(route.path);

  return (
    <div className={`app-shell ${isDesktop ? 'app-shell--desktop' : 'app-shell--mobile'}${hideChrome ? ' app-shell--immersive' : ''}`}>
      {isDesktop && !hideChrome
        ? <Sidebar activeTab={route.path} onNavigate={navigate} />
        : !isDesktop && !hideChrome && <TopBar onNavigate={navigate} />
      }
      <main className="app-main">
        <div className={isDesktop ? (hideChrome ? 'immersive-column' : 'desktop-content') : 'mobile-content'}>
          <ErrorBoundary resetKey={route.path}>
            <Suspense fallback={<Loader />}>
              {renderScreen(route, navigate, goBack, showToast, updateSettings)}
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      {ToastComponent}
      {!isDesktop && !hideChrome && (
        <BottomTabBar activeTab={route.path} onNavigate={navigate} />
      )}
    </div>
  );
}

// ── App root ───────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AudioProvider>
          <MainLayout />
        </AudioProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
