// src/App.jsx — Root: router, context providers, layout shell

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { AudioProvider } from './contexts/AudioContext';
import { TopBar } from './components/layout/TopBar';
import { BottomTabBar } from './components/layout/BottomTabBar';
import { Sidebar } from './components/layout/Sidebar';
import { ROUTES } from './utils/constants';
import { isAuthenticated, waitForAuth, updateLastActive } from './services/auth';
import { initOfflineQueueListener } from './services/offlineManager';
import { hasAnalyticsConsent } from './services/consent';
import { initPostHog, phIdentify } from './services/posthog';
import { pullLibraryFromFirestore, pullStreakFromFirestore } from './services/sync';
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
const StatsScreen        = lazy(() => import('./components/screens/StatsScreen'));
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
const DialogueScene      = lazy(() => import('./components/screens/DialogueScene'));
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

// ── Router ─────────────────────────────────────────────────────────────────

function parseHash(hash) {
  const clean = hash.replace(/^#\/?/, '');
  if (!clean) return { path: ROUTES.HOME, id: null };
  const slash = clean.indexOf('/');
  if (slash === -1) return { path: clean, id: null };
  return { path: clean.slice(0, slash), id: clean.slice(slash + 1) };
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

// Routes that hide the app chrome (tabs/topbar) for immersive experience
const CHROME_HIDDEN_ROUTES = new Set([
  ROUTES.SHADOW, ROUTES.PROMPT_DRILL, ROUTES.SPEED_RUN,
  ROUTES.TONE_GYM, ROUTES.DRILL_TONE, ROUTES.DIALOGUE,
  ROUTES.LISTEN, ROUTES.FIRSTRUN,
]);

// ── Loader ─────────────────────────────────────────────────────────────────

const Loader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1 }}>
    <div className="spin-loader" />
  </div>
);

// ── Screen renderer ────────────────────────────────────────────────────────

function renderScreen(route, navigate, goBack) {
  const { path, id } = route;
  switch (path) {
    case ROUTES.HOME:            return <HomeScreen navigate={navigate} />;
    case ROUTES.SCENES:          return <ScenesScreen navigate={navigate} />;
    case ROUTES.SCENE_DETAIL:    return <SceneDetailScreen sceneId={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.LISTEN:          return <ListenMode sceneId={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.LIBRARY:         return <LibraryScreen navigate={navigate} />;
    case ROUTES.PRACTICE:        return <PracticeScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.DRILL_TONE:      return <ToneTrainer navigate={navigate} goBack={goBack} />;
    case ROUTES.PHRASE_DETAIL:   return <PhraseDetailScreen phraseId={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.SEARCH:          return <SearchScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.SHADOW:          return <ShadowSession sceneId={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.SESSION_END:     return <SessionSummary navigate={navigate} goBack={goBack} />;
    case ROUTES.PROFILE:         return <ProfileScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.SETTINGS:        return <SettingsScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.STATS:           return <StatsScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.DAY_DETAIL:      return <DayDetailScreen date={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.AI_CHAT:         return <AIConversation navigate={navigate} goBack={goBack} />;
    case ROUTES.AI_SCENARIO:     return <AIScenarioPicker navigate={navigate} goBack={goBack} />;
    case ROUTES.PROMPT_DRILL:    return <PromptDrill navigate={navigate} goBack={goBack} />;
    case ROUTES.SPEED_RUN:       return <SpeedRun navigate={navigate} goBack={goBack} />;
    case ROUTES.TONE_GYM:        return <ToneGym navigate={navigate} goBack={goBack} />;
    case ROUTES.TONE_GYM_RESULTS: return <ToneGymResults navigate={navigate} goBack={goBack} />;
    case ROUTES.DIALOGUE:        return <DialogueScene sceneId={id} navigate={navigate} goBack={goBack} />;
    case ROUTES.SCENE_END:       return <SceneSummary navigate={navigate} goBack={goBack} />;
    case ROUTES.PAYWALL:         return <Paywall navigate={navigate} goBack={goBack} />;
    case ROUTES.LOGIN:           return <LoginScreen navigate={navigate} />;
    case ROUTES.REGISTER:        return <RegisterScreen navigate={navigate} />;
    case ROUTES.FORGOT_PASSWORD: return <ForgotPasswordScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.EMAIL_VERIFY:    return <EmailVerification navigate={navigate} />;
    case ROUTES.NEW_PASSWORD:    return <NewPassword navigate={navigate} goBack={goBack} />;
    case ROUTES.ADMIN:           return <AdminDashboard navigate={navigate} goBack={goBack} />;
    case ROUTES.SUPPORT:         return <SupportScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.FAQ:             return <FAQScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.CONTACT:         return <ContactScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.ABOUT:           return <AboutScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.PRIVACY:         return <LegalPage type="privacy" navigate={navigate} goBack={goBack} />;
    case ROUTES.TERMS:           return <LegalPage type="terms" navigate={navigate} goBack={goBack} />;
    case ROUTES.LICENSES:        return <LicensesScreen navigate={navigate} goBack={goBack} />;
    case ROUTES.CHECKOUT_SUCCESS: return <CheckoutSuccess navigate={navigate} />;
    case ROUTES.INTRODUCE_YOURSELF: return <IntroduceYourselfForm navigate={navigate} goBack={goBack} onComplete={() => navigate(ROUTES.LIBRARY)} />;
    default:                     return <HomeScreen navigate={navigate} />;
  }
}

// ── Main layout ────────────────────────────────────────────────────────────

function MainLayout() {
  const { route, navigate, goBack } = useRouter();
  const isDesktop = useDesktop();
  const { settings, isLoading, updateSettings } = useAppContext();
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [checkoutResult] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('checkout');
  });

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

    waitForAuth().then((user) => {
      clearTimeout(timeout);
      if (user) {
        const updates = {};
        const name = (user.displayName || '').split(' ')[0];
        if (name && name !== settings.name) updates.name = name;
        if (user.photoURL) updates.photoURL = user.photoURL;
        if (!settings.firstrunCompleted) updates.firstrunCompleted = true;
        if (Object.keys(updates).length > 0) updateSettings(updates);
        updateLastActive();
        pullLibraryFromFirestore().catch(() => {});
        pullStreakFromFirestore().then((remote) => {
          if (remote) updateSettings(remote);
        }).catch(() => {});
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

  if (authError && !isAuthenticated()) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center', gap: 16 }}>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{authError}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 10, background: 'var(--color-brand-dark)', color: '#fff', fontWeight: 600, fontSize: 15 }}>
          Reload
        </button>
      </div>
    );
  }

  if (checkoutResult === 'success' && isAuthenticated()) {
    return (
      <Suspense fallback={<Loader />}>
        <CheckoutSuccess onDone={() => navigate(ROUTES.HOME)} />
      </Suspense>
    );
  }

  // First-run: unauthenticated + not completed first-run
  if (!isAuthenticated() && !settings.firstrunCompleted) {
    if (PUBLIC_ROUTES.has(route.path)) {
      return (
        <Suspense fallback={<Loader />}>
          {renderScreen(route, navigate, goBack)}
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<Loader />}>
        <FirstRunFlow navigate={navigate} />
      </Suspense>
    );
  }

  // Returning unauthenticated user
  if (!isAuthenticated()) {
    if (PUBLIC_ROUTES.has(route.path)) {
      return (
        <Suspense fallback={<Loader />}>
          {renderScreen(route, navigate, goBack)}
        </Suspense>
      );
    }
    navigate(ROUTES.LOGIN);
    return null;
  }

  const hideChrome = CHROME_HIDDEN_ROUTES.has(route.path);

  return (
    <div className={`app-shell ${isDesktop ? 'app-shell--desktop' : 'app-shell--mobile'}`}>
      {isDesktop
        ? <Sidebar activeRoute={route.path} navigate={navigate} />
        : !hideChrome && <TopBar route={route} navigate={navigate} />
      }
      <main className="app-main">
        <Suspense fallback={<Loader />}>
          {renderScreen(route, navigate, goBack)}
        </Suspense>
      </main>
      {!isDesktop && !hideChrome && (
        <BottomTabBar activeRoute={route.path} navigate={navigate} />
      )}
    </div>
  );
}

// ── App root ───────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <AudioProvider>
        <MainLayout />
      </AudioProvider>
    </AppProvider>
  );
}
