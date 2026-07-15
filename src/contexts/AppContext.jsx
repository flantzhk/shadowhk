// src/contexts/AppContext.jsx — Global state: user, settings, current language

import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { getSettings, saveSettings } from '../services/storage';
import { setPreferredVoice } from '../services/api';
import { DEFAULT_USER_SETTINGS } from '../utils/constants';
import { logger } from '../utils/logger';
import { useToast } from '../components/shared/Toast';

const AppContext = createContext(null);

const ACTION_TYPES = {
  SET_SETTINGS: 'SET_SETTINGS',
  UPDATE_SETTING: 'UPDATE_SETTING',
  SET_LOADING: 'SET_LOADING',
};

/**
 * @param {Object} state
 * @param {{ type: string, payload: * }} action
 * @returns {Object}
 */
function appReducer(state, action) {
  switch (action.type) {
    case ACTION_TYPES.SET_SETTINGS:
      return { ...state, settings: action.payload, isLoading: false };
    case ACTION_TYPES.UPDATE_SETTING:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    case ACTION_TYPES.SET_LOADING:
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

const initialState = {
  settings: DEFAULT_USER_SETTINGS,
  isLoading: true,
};

/**
 * AppProvider wraps the app with global state.
 * @param {{ children: React.ReactNode }} props
 */
function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const settingsRef = useRef(state.settings);
  const { showToast, ToastComponent } = useToast();

  // Keep ref in sync with latest state
  useEffect(() => {
    settingsRef.current = state.settings;
  }, [state.settings]);

  // Keep the TTS service in sync with the chosen Cantonese voice
  useEffect(() => {
    setPreferredVoice(state.settings?.voiceId);
  }, [state.settings?.voiceId]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await getSettings();
        if (stored) {
          dispatch({ type: ACTION_TYPES.SET_SETTINGS, payload: { ...DEFAULT_USER_SETTINGS, ...stored } });
        } else {
          await saveSettings({ ...DEFAULT_USER_SETTINGS, id: 'user' });
          dispatch({ type: ACTION_TYPES.SET_SETTINGS, payload: DEFAULT_USER_SETTINGS });
        }
      } catch (error) {
        logger.error('Failed to load settings', error);
        dispatch({ type: ACTION_TYPES.SET_SETTINGS, payload: DEFAULT_USER_SETTINGS });
      }
    }
    loadSettings();
  }, []);

  const updateSettings = useCallback(async (updates) => {
    // Merge onto the latest settings and update the ref synchronously (not via
    // the useEffect above, which only runs after the next render commits).
    // This guarantees a second updateSettings call arriving before that render
    // still merges onto this call's result instead of a stale snapshot.
    const newSettings = { ...settingsRef.current, ...updates };
    settingsRef.current = newSettings;
    dispatch({ type: ACTION_TYPES.UPDATE_SETTING, payload: updates });
    try {
      await saveSettings(newSettings);
    } catch (error) {
      logger.error('Failed to persist settings', error);
      showToast('Could not save your changes. Please check your device storage.', 'error');
    }
  }, [showToast]);

  const value = {
    settings: state.settings,
    isLoading: state.isLoading,
    updateSettings,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {ToastComponent}
    </AppContext.Provider>
  );
}

/**
 * @returns {{ settings: Object, isLoading: boolean, updateSettings: Function }}
 */
function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

export { AppProvider, useAppContext, AppContext };
