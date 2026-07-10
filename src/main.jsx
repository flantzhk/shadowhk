// src/main.jsx

// Self-hosted fonts (bundled + precached so they render offline).
// Families and weights mirror the old Google Fonts link exactly.
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/400-italic.css';
import '@fontsource/inter/500-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/noto-serif-hk/400.css';
import '@fontsource/noto-serif-hk/500.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/500.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/source-serif-4/700.css';
import '@fontsource/source-serif-4/400-italic.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Service worker: register + reload once when a new version takes control.
// Without this, every deploy left returning visitors on the previous build
// until they happened to hard-refresh (the SW served the old precache).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
    let hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; } // first install — no reload
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
