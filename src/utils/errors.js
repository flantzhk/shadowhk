// src/utils/errors.js

class AppError extends Error {
  /**
   * @param {string} message
   * @param {string} code - One of ErrorCodes
   * @param {boolean} [recoverable=true]
   */
  constructor(message, code, recoverable = true) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status - HTTP status code
   * @param {string} endpoint
   */
  constructor(message, status, endpoint) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

const ErrorCodes = {
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  API_SERVER_ERROR: 'API_SERVER_ERROR',
  AUDIO_PLAY_FAILED: 'AUDIO_PLAY_FAILED',
  MIC_PERMISSION_DENIED: 'MIC_PERMISSION_DENIED',
  MIC_NOT_AVAILABLE: 'MIC_NOT_AVAILABLE',
  STORAGE_FULL: 'STORAGE_FULL',
  STORAGE_ERROR: 'STORAGE_ERROR',
};

const USER_MESSAGES = {
  NETWORK_OFFLINE: "You're offline. This feature needs internet.",
  AUTH_REQUIRED: 'Please sign in to use this feature.',
  AUTH_EXPIRED: 'Your session has expired. Please sign in again.',
  API_RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  API_SERVER_ERROR: 'Something went wrong. Try again in a moment.',
  AUDIO_PLAY_FAILED: "Audio couldn't play. Try again.",
  MIC_PERMISSION_DENIED: 'Microphone access needed for pronunciation scoring. Enable it in your device settings.',
  MIC_NOT_AVAILABLE: 'Microphone not available on this device.',
  STORAGE_FULL: 'Device storage is full. Free up space to continue saving phrases.',
  STORAGE_ERROR: "Couldn't save data. Try again.",
};

export { AppError, ApiError, ErrorCodes, USER_MESSAGES };
