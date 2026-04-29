import styles from './ConversationAvatars.module.css';

export function NpcAvatar({ scene }) {
  const seed = encodeURIComponent(scene?.id ?? 'npc');
  const src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
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
