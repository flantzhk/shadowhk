// src/services/notifications.js — Web Push subscription management

import { API_BASE_URL, API_ENDPOINTS, VAPID_PUBLIC_KEY } from '../utils/constants';
import { fetchWithAuth } from './api';
import { logger } from '../utils/logger';

/**
 * Convert a base64url VAPID public key to a Uint8Array for PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Request notification permission, subscribe to Web Push, and register with the Worker.
 * @param {string|null} reminderTime - "HH:MM" user's local reminder time
 * @returns {Promise<'granted'|'denied'|'unsupported'|'error'>}
 */
async function subscribeToPushNotifications(reminderTime) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    logger.info('Web Push not supported in this browser');
    return 'unsupported';
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      logger.info('Notification permission denied');
      return 'denied';
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Send subscription to Worker for storage
    await fetchWithAuth(`${API_BASE_URL}${API_ENDPOINTS.PUSH_SUBSCRIBE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), reminderTime }),
    });

    logger.info('Push notification subscription registered');
    return 'granted';
  } catch (err) {
    logger.error('Push subscription failed', err);
    return 'error';
  }
}

/**
 * Unsubscribe from push notifications and remove from Worker storage.
 * @returns {Promise<boolean>}
 */
async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();

    await fetchWithAuth(`${API_BASE_URL}${API_ENDPOINTS.PUSH_UNSUBSCRIBE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    logger.info('Push notifications unsubscribed');
    return true;
  } catch (err) {
    logger.error('Push unsubscribe failed', err);
    return false;
  }
}

/**
 * Check the current notification permission state without requesting it.
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if this browser is currently subscribed to push.
 * @returns {Promise<boolean>}
 */
async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Show an immediate test notification (for settings preview).
 */
async function showTestNotification() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('ShadowSpeak', {
      body: "This is what your daily reminder will look like!",
      icon: '/shadowspeaklaunch/icons/icon-192.png',
      badge: '/shadowspeaklaunch/icons/icon-192.png',
      tag: 'shadowspeak-test',
    });
  } catch (err) {
    logger.error('Test notification failed', err);
  }
}

export {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getNotificationPermission,
  isPushSubscribed,
  showTestNotification,
};
