// src/utils/formatters.js — Date, time, score formatting

/**
 * Format seconds into mm:ss display.
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a Unix timestamp into a relative time string.
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string}
 */
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

/**
 * Format a date string for display.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format SRS interval into a human-readable string.
 * @param {number} interval - Days until next review
 * @param {number} nextReviewAt - Unix timestamp
 * @returns {string}
 */
function formatReviewStatus(interval, nextReviewAt, practiceCount = 0) {
  // Brand new — never practiced yet
  if (!practiceCount || practiceCount === 0) return 'New';
  if (!nextReviewAt || isNaN(nextReviewAt)) return 'Due';
  const now = Date.now();
  if (nextReviewAt <= now) return 'Due';
  const daysUntil = Math.ceil((nextReviewAt - now) / (24 * 60 * 60 * 1000));
  if (isNaN(daysUntil) || daysUntil <= 0) return 'Due';
  if (daysUntil === 1) return 'Review tomorrow';
  return `Review in ${daysUntil} days`;
}

/**
 * Format a score into a display string with label.
 * @param {number} score - 0-100
 * @returns {{ label: string, level: string }}
 */
function formatScore(score) {
  if (score >= 90) return { label: 'Excellent', level: 'excellent' };
  if (score >= 70) return { label: 'Good', level: 'good' };
  if (score >= 50) return { label: 'Fair', level: 'fair' };
  return { label: 'Needs work', level: 'needs-work' };
}

export { formatTime, formatRelativeTime, formatDate, formatReviewStatus, formatScore };
