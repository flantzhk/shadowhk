// src/sw.js — Custom service worker (processed by vite-plugin-pwa injectManifest)

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Take over immediately on install/update
self.skipWaiting();
clientsClaim();

// Inject precache manifest (replaced by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback: serve the precached shell for all navigations,
// including ones with query params (e.g. ?checkout=success) while offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('/shadowhk/index.html')));

// Runtime cache: pre-generated static audio (scenes, reference sets, English,
// words). Cache-first and long-lived — these files never change once
// generated. The "Download everything" button fills this same cache up front
// so the whole app works offline (e.g. on a plane).
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/audio/'),
  new CacheFirst({
    cacheName: 'shadowhk-static-audio',
    plugins: [
      new ExpirationPlugin({ maxEntries: 4000, maxAgeSeconds: 365 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Runtime cache: audio TTS responses
registerRoute(
  ({ url }) =>
    url.origin === 'https://shadowspeak-api.faith-lantz-ee8.workers.dev' &&
    url.pathname.startsWith('/tts'),
  new CacheFirst({
    cacheName: 'shadowspeak-audio-v5',
    plugins: [
      new ExpirationPlugin({ maxEntries: 1000, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// === Push Notifications ===

self.addEventListener('push', (event) => {
  let data = { title: 'ShadowSpeak', body: 'Time to practice Cantonese! Keep your streak alive.' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed.title) data.title = parsed.title;
      if (parsed.body) data.body = parsed.body;
    }
  } catch (e) {
    // Non-JSON payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/shadowhk/icons/icon-192.png',
      badge: '/shadowhk/icons/icon-192.png',
      tag: 'shadowspeak-reminder',
      renotify: false,
      data: { url: '/shadowhk/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/shadowhk/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if one is open
        for (const client of clientList) {
          if (client.url.includes('/shadowhk/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// === App messages ===

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
