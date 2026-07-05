// src/utils/constants.js

export const APP_VERSION = '2.3.68';
export const MAX_LIBRARY_SIZE = 200;
export const SECONDS_PER_PHRASE = 40;
export const PRONUNCIATION_PASS_THRESHOLD = { cantonese: 90, mandarin: 70, english: 70 };
export const SCORE_THRESHOLDS = { EXCELLENT: 80, GOOD: 60, FAIR: 40 };
export const SRS_INITIAL_EASE = 2.5;
export const SRS_MIN_EASE = 1.3;
export const SRS_MAX_EASE = 3.0;
export const SRS_MAX_INTERVAL = 180;
export const SRS_MASTERED_THRESHOLD = 21;
export const RECORDING_MAX_SECONDS = 10;
export const API_BASE_URL = 'https://shadowspeak-api.faith-lantz-ee8.workers.dev';
export const API_ENDPOINTS = {
  SCORE_PRONUNCIATION: '/score-pronunciation',
  TTS: '/tts',
  TTS_ENGLISH: '/tts-english',
  STT: '/stt',
  TEXT_TO_JYUTPING: '/text-to-jyutping',
  AI_CHAT: '/ai-chat',
  PUSH_SUBSCRIBE: '/push-subscribe',
  PUSH_UNSUBSCRIBE: '/push-unsubscribe',
  STRIPE_CHECKOUT: '/create-checkout-session',
};

export const VAPID_PUBLIC_KEY = 'BCmqvXWvZ-9ES9BJWC9fkC_RoZ16Fh3p3i5IB1uF_YpdM54OUeBTfrCKppryPIx0_6dB6SQcDixoD22J1Y2Q08M';
export const AUDIO_CACHE_NAME = 'shadowhk-audio-v1';
export const APP_CACHE_NAME = 'shadowhk-app-v1';
export const DB_NAME = 'shadowhk';
export const DB_VERSION = 2;
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 1000;
export const API_TIMEOUT_MS = 30000;
export const AUTO_ADVANCE_DELAY_MS = 1500;
export const SEARCH_DEBOUNCE_MS = 300;

export const GROWTH_STATE = {
  NEW: 'new',
  GROWING: 'growing',
  STRONG: 'strong',
  MASTERED: 'mastered',
};

// SRS interval thresholds (days) for growth state labels
export const GROWTH_THRESHOLDS = {
  GROWING: 1,
  STRONG: 7,
  MASTERED: 21,
};

export const SOURCE_TAGS = {
  LIBRARY: 'library',
  HEARD_IT: 'heard_it',
  FROM_SCHOOL: 'from_school',
  FROM_SHOW: 'from_show',
  MINE: 'mine',
};

export const ROUTES = {
  HOME: 'home',
  FIRSTRUN: 'firstrun',
  SCENES: 'scenes',
  SCENE_DETAIL: 'scene',
  LISTEN: 'listen',
  LIBRARY: 'library',
  PRACTICE: 'practice',
  DRILL_TONE: 'drill-tone',
  PHRASE_DETAIL: 'phrase',
  SEARCH: 'search',
  SHADOW: 'shadow',
  SESSION_END: 'session-end',
  PAYWALL: 'paywall',
  SETTINGS: 'settings',
  PROFILE: 'profile',
  STATS: 'stats',
  DAY_DETAIL: 'day-detail',
  AI_CHAT: 'ai',
  AI_SCENARIO: 'ai-scenario',
  LOGIN: 'login',
  REGISTER: 'register',
  FORGOT_PASSWORD: 'forgot-password',
  NEW_PASSWORD: 'new-password',
  EMAIL_VERIFY: 'email-verify',
  PROMPT_DRILL: 'prompt',
  SPEED_RUN: 'speedrun',
  TONE_GYM: 'tonegym',
  DIALOGUE: 'dialogue',
  PRIVACY: 'privacy',
  TERMS: 'terms',
  ABOUT: 'about',
  FAQ: 'faq',
  CONTACT: 'contact',
  LICENSES: 'licenses',
  CHECKOUT_SUCCESS: 'checkout-success',
  ADMIN: 'admin',
  SUPPORT: 'support',
  INTRODUCE_YOURSELF: 'introduce-yourself',
  TONE_GYM_RESULTS: 'tonegym-results',
  SCENE_END: 'scene-end',
  REFERENCE: 'reference',
};

export const SCENE_CATEGORIES = {
  cantonese: ['food', 'transport', 'social', 'services', 'festivals'],
  mandarin: ['food', 'transport', 'social', 'services', 'festivals'],
};

export const STREAK_MILESTONES = [7, 14, 30, 60, 100];

export const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30];

// Cantonese TTS voices (cantonese.ai voice ids). 'original' is the voice all
// pre-recorded scene/reference audio was generated with.
export const CANTONESE_VOICES = [
  { id: 'f6786fa7-f21d-4e8c-b696-26bb67fcd2ca', label: 'Original', desc: 'The voice of the scene recordings.' },
  { id: '50a9a698-1f99-437c-a07d-9cad435c5f8a', label: 'Female', desc: 'Hear tapped words and your own phrases in a female voice.' },
  { id: 'f8b4470f-2321-4b59-a5b8-3877990b2881', label: 'Male', desc: 'Hear tapped words and your own phrases in a male voice.' },
];

export const DEFAULT_USER_SETTINGS = {
  name: '',
  email: '',
  dailyGoalMinutes: 10,
  reminderTime: null,
  currentLanguage: 'cantonese',
  showCharacters: true,
  showEnglish: true,
  showRomanization: true,
  autoAdvance: true,
  defaultSpeed: 'natural',
  streakCount: 0,
  streakLastDate: null,
  streakFreezeUsedWeek: null,
  totalPracticeSeconds: 0,
  firstrunCompleted: false,
  themePreference: 'system',
  voiceId: 'f6786fa7-f21d-4e8c-b696-26bb67fcd2ca',
};
