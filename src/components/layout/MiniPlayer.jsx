import { useAudio } from '../../contexts/AudioContext.jsx';
import styles from './MiniPlayer.module.css';

export function MiniPlayer({ onNavigate, currentSceneId, currentScene }) {
  const { currentPhrase, isPlaying, playbackState, play, pause, currentTime, duration } = useAudio();

  const isVisible = currentPhrase && playbackState !== 'idle';
  if (!isVisible) return null;

  const tint = currentScene?.tint ?? '#00E5A0';
  const imageUrl = currentScene?.imageUrl ?? null;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={styles.player}
      style={{
        background: `linear-gradient(100deg, ${tint}ee, ${tint}cc)`,
      }}
      onClick={() => currentSceneId && onNavigate?.('shadow', currentSceneId)}
      role="button"
      tabIndex={0}
    >
      {imageUrl && (
        <div
          className={styles.imageBg}
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}

      <div className={styles.inner}>
        {/* Thumbnail */}
        <div
          className={styles.thumb}
          style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : undefined, backgroundColor: tint + '44' }}
        />

        {/* Phrase text */}
        <div className={styles.text}>
          <div className={styles.jyutping}>{currentPhrase?.romanization ?? currentPhrase?.jyutping}</div>
          <div className={styles.english}>
            {currentPhrase?.english}
            {currentScene?.title && <span className={styles.sceneTail}> · {currentScene.title}</span>}
          </div>
        </div>

        {/* Play/pause */}
        <button
          className={styles.playBtn}
          onClick={e => { e.stopPropagation(); isPlaying ? pause() : play(); }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      {/* Progress line */}
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
