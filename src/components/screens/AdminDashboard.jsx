// src/components/screens/AdminDashboard.jsx
// Route: #admin — internal admin dashboard. Not linked from app nav.
//
// Access control: checks that the signed-in user's UID matches
// VITE_ADMIN_UID (set in .env). Unauthenticated or non-admin users see
// an access-denied message.
//
// Firestore security rules required:
//   match /users/{userId} {
//     allow list: if request.auth.uid == '<ADMIN_UID>';
//   }
//   match /waitlist/{entry} {
//     allow list: if request.auth.uid == '<ADMIN_UID>';
//   }

import { useState, useEffect } from 'react';
import { fbAuth, fbDb } from '../../services/firebase';
import styles from './AdminDashboard.module.css';

const DAU_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function MetricCard({ label, value, sub }) {
  return (
    <div className={styles.card}>
      <p className={styles.cardLabel}>{label}</p>
      <p className={styles.cardValue}>{value ?? '—'}</p>
      {sub && <p className={styles.cardSub}>{sub}</p>}
    </div>
  );
}

// adminUid prop exists for testability — in production it defaults to VITE_ADMIN_UID
export default function AdminDashboard({ onBack, adminUid }) {
  const currentUser = fbAuth.currentUser;
  const ADMIN_UID = adminUid ?? import.meta.env.VITE_ADMIN_UID ?? '';
  const isAdmin = ADMIN_UID && currentUser?.uid === ADMIN_UID;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadMetrics() {
      setLoading(true);
      setError(null);
      try {
        const [usersSnap, waitlistSnap] = await Promise.all([
          fbDb.collection('users').get(),
          fbDb.collection('waitlist').get(),
        ]);

        const now = Date.now();
        let totalUsers = 0;
        let dauCount = 0;
        let freeCount = 0;
        let proCount = 0;

        usersSnap.forEach((doc) => {
          totalUsers++;
          const data = doc.data();

          // DAU: last_active within the past 24 hours
          const lastActive = data.last_active?.toMillis?.();
          if (lastActive && now - lastActive <= DAU_WINDOW_MS) dauCount++;

          // Subscription breakdown
          if (data.subscription_status && data.subscription_status !== 'free') {
            proCount++;
          } else {
            freeCount++;
          }
        });

        setMetrics({
          totalUsers,
          dauCount,
          freeCount,
          proCount,
          waitlistCount: waitlistSnap.size,
        });
      } catch (err) {
        setError('Failed to load metrics. Check Firestore security rules allow admin list access.');
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [isAdmin]);

  if (!currentUser) {
    return (
      <div className={styles.screen}>
        <div className={styles.denied}>
          <p>You must be signed in to view this page.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.screen}>
        <div className={styles.denied}>
          <p>Access denied.</p>
          <p className={styles.deniedSub}>UID: {currentUser.uid}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>Admin</h1>
      </div>

      {loading && <p className={styles.hint}>Loading metrics...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {metrics && (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Users</h2>
            <div className={styles.grid}>
              <MetricCard label="Total registered" value={metrics.totalUsers} />
              <MetricCard
                label="DAU (24h)"
                value={metrics.dauCount}
                sub={metrics.totalUsers > 0
                  ? `${Math.round((metrics.dauCount / metrics.totalUsers) * 100)}% of total`
                  : undefined}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Subscription</h2>
            <div className={styles.grid}>
              <MetricCard label="Free" value={metrics.freeCount} />
              <MetricCard
                label="Pro / Paid"
                value={metrics.proCount}
                sub={metrics.totalUsers > 0
                  ? `${Math.round((metrics.proCount / metrics.totalUsers) * 100)}% conversion`
                  : undefined}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Waitlist</h2>
            <div className={styles.grid}>
              <MetricCard label="Email signups" value={metrics.waitlistCount} />
            </div>
          </section>
        </>
      )}

      {metrics && (
        <p className={styles.refreshNote}>
          Last refreshed: {new Date().toLocaleTimeString()}{' '}
          <button
            className={styles.refreshBtn}
            onClick={() => { setMetrics(null); setLoading(true); }}
          >
            Refresh
          </button>
        </p>
      )}
    </div>
  );
}
