import styles from './ConversationAvatars.module.css';

// Real portrait photos instead of cartoon avatars. A small fixed cast,
// deterministically assigned per scene id so the same scene always shows
// the same "person" (mirrors the old seeded-hash behaviour).
const NPC_AVATAR_COUNT = 4;

function hashToIndex(str, count) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % count;
}

export function NpcAvatar({ scene }) {
  const base = import.meta.env.BASE_URL || '/';
  const idx = hashToIndex(scene?.id ?? 'npc', NPC_AVATAR_COUNT) + 1;
  const src = `${base}images/avatars/avatar-${idx}.jpg`;
  return (
    <div className={styles.avatarWrap}>
      <img className={styles.avatarImg} src={src} alt="Speaker" onError={e => { e.target.style.display = 'none'; }} />
    </div>
  );
}

export function UserAvatar({ photoURL, name }) {
  const initial = (name || 'Y')[0].toUpperCase();
  if (photoURL) {
    return (
      <div className={styles.avatarWrap}>
        <img className={styles.avatarImg} src={photoURL} alt="You" referrerPolicy="no-referrer" />
      </div>
    );
  }
  return (
    <div className={`${styles.avatarWrap} ${styles.avatarInitial}`}>
      {initial}
    </div>
  );
}
