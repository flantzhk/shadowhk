// src/components/screens/AIConversation.jsx — AI chat partner

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useRecorder } from '../../hooks/useRecorder';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSubscription } from '../../hooks/useSubscription';
import { speechToText } from '../../services/api';
import { isAuthenticated } from '../../services/auth';
import { getScenarios, sendMessage, generateResponseAudio } from '../../services/aiChat';
import { saveLibraryEntry } from '../../services/storage';
import { SRS_INITIAL_EASE, ROUTES } from '../../utils/constants';
import { ScoreBadge } from '../cards/ScoreBadge';
import { RecordButton } from '../shared/RecordButton';
import styles from './AIConversation.module.css';

/**
 * @param {{ onBack: Function, showToast: Function, onNavigate: Function }} props
 */
export default function AIConversation({ onBack, showToast, onNavigate }) {
  const { settings } = useAppContext();
  const { isRecording, startRecording, stopRecording, error: micError } = useRecorder();
  const isOnline = useOnlineStatus();
  const { isPro, isLoading: subLoading } = useSubscription();
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState('select'); // select|chat|recording|review
  const [isThinking, setIsThinking] = useState(false);
  const [apiError, setApiError] = useState(null); // inline error + retry state
  const [userTranscript, setUserTranscript] = useState('');
  const [userScore, setUserScore] = useState(null);
  const [inputMode, setInputMode] = useState('voice'); // voice|text
  const [textInput, setTextInput] = useState('');
  const [savedMsgIds, setSavedMsgIds] = useState(new Set());
  // Tracks whether each scene's Unsplash background loaded ('loaded') or failed ('failed').
  // Used to swap to scenario.fallbackGradient if the image can't be fetched.
  const [imageLoadState, setImageLoadState] = useState({});
  const chatRef = useRef(null);
  const audioRef = useRef(new Audio());

  useEffect(() => {
    return () => {
      audioRef.current.pause();
      audioRef.current.src = ''; // release blob URL reference
    };
  }, []);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Preload scene background images. If Unsplash is unreachable or a URL breaks,
  // mark it 'failed' so we can render the gradient fallback instead of a flat square.
  useEffect(() => {
    let cancelled = false;
    getScenarios().forEach((s) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setImageLoadState((prev) => ({ ...prev, [s.id]: 'loaded' }));
      };
      img.onerror = () => {
        if (!cancelled) setImageLoadState((prev) => ({ ...prev, [s.id]: 'failed' }));
      };
      img.src = `${s.backgroundUrl}?w=600&auto=format&fit=crop`;
    });
    return () => { cancelled = true; };
  }, []);

  // Soft paywall gate — shown while resolving subscription status for free users
  if (!isPro) {
    if (subLoading) {
      return (
        <div className={styles.screen}>
          <div className={styles.gateSpinner}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid var(--color-brand-lime)',
              borderTopColor: 'transparent',
              animation: 'spinGate 0.8s linear infinite',
            }} />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className={styles.title}>AI Conversation</h1>
          <div style={{ width: 44 }} />
        </div>
        <div className={styles.gate}>
          <div className={styles.gateIcon} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-dark)" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className={styles.gateTitle}>Unlock AI Conversation</h2>
          <p className={styles.gateSubtitle}>
            Practice real conversations with an AI tutor. Upgrade to Pro to get full access.
          </p>
          <button
            className={styles.gateUpgradeBtn}
            onClick={() => onNavigate ? onNavigate(ROUTES.PAYWALL) : (window.location.hash = `#${ROUTES.PAYWALL}`)}
          >
            Upgrade to Pro
          </button>
          <button className={styles.gateBackBtn} onClick={onBack}>
            Maybe later
          </button>
        </div>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className={styles.screen}>
        <div className={styles.offline}>
          <p>AI conversation requires internet</p>
          <button className={styles.backBtn} onClick={onBack}>Go back</button>
        </div>
      </div>
    );
  }

  const playAudio = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    audioRef.current.onended = () => URL.revokeObjectURL(url);
    audioRef.current.onerror = () => URL.revokeObjectURL(url);
  }, []);

  const handleSelectScenario = useCallback(async (s) => {
    setScenario(s); setPhase('chat'); setMessages([]);
    setApiError(null);
    setIsThinking(true);
    try {
      const reply = await sendMessage([], s);
      setMessages([{ role: 'assistant', ...reply }]);
      setIsThinking(false);
      // TTS is non-fatal — message already shown, audio failure shouldn't block UX
      try {
        const blob = await generateResponseAudio(reply.chinese);
        if (blob) playAudio(blob);
      } catch { /* audio unavailable — silently skip */ }
    } catch (err) {
      setIsThinking(false);
      setApiError(s); // store the scenario so the retry button can call this again
    }
  }, [playAudio]);

  const handleRecord = useCallback(async () => {
    audioRef.current.pause();
    await startRecording(); setPhase('recording');
  }, [startRecording]);

  const handleStopRecord = useCallback(async () => {
    const blob = await stopRecording();
    if (!blob) return;
    setPhase('chat'); setUserTranscript(''); setUserScore(null);

    if (isAuthenticated()) {
      try {
        const stt = await speechToText(blob);
        setUserTranscript(stt.text || '');
        const userMsg = { role: 'user', chinese: stt.text || '', jyutping: '', romanization: '', english: '' };
        const newMsgs = [...messages, userMsg];
        setMessages(newMsgs);

        setIsThinking(true);
        const reply = await sendMessage(newMsgs, scenario);
        setMessages(prev => [...prev, { role: 'assistant', ...reply }]);
        setIsThinking(false);
        try {
          const audioBlob = await generateResponseAudio(reply.chinese);
          if (audioBlob) playAudio(audioBlob);
        } catch { /* TTS non-fatal */ }
      } catch (err) {
        showToast?.('Something went wrong. Check your connection and try again.', 'error');
        setIsThinking(false);
      }
    }
  }, [stopRecording, messages, scenario, playAudio, showToast]);

  const handleEndChat = useCallback(() => { setPhase('review'); }, []);

  const handleSavePhrase = useCallback(async (msg, idx) => {
    const phraseId = `ai-${Date.now()}`;
    try {
      await saveLibraryEntry({
        phraseId, type: 'phrase', addedAt: Date.now(), source: 'ai-conversation',
        customData: { chinese: msg.chinese, jyutping: msg.jyutping, english: msg.english },
        interval: 0, easeFactor: SRS_INITIAL_EASE, nextReviewAt: Date.now(),
        lastPracticedAt: null, practiceCount: 0, status: 'learning',
        bestScore: null, lastScore: null, scoreHistory: [],
      });
      if (idx != null) setSavedMsgIds(prev => new Set([...prev, idx]));
      showToast?.('Saved to library', 'success');
    } catch (err) { showToast?.('Failed to save', 'error'); }
  }, [showToast]);

  const handleTextSend = useCallback(async () => {
    const text = textInput.trim();
    if (!text || isThinking) return;
    setTextInput('');
    const userMsg = { role: 'user', chinese: '', jyutping: '', romanization: '', english: text, inputMode: 'text' };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setIsThinking(true);
    try {
      const reply = await sendMessage(newMsgs, scenario);
      setMessages(prev => [...prev, { role: 'assistant', ...reply }]);
      setIsThinking(false);
      try {
        const audioBlob = await generateResponseAudio(reply.chinese);
        if (audioBlob) playAudio(audioBlob);
      } catch { /* TTS non-fatal */ }
    } catch (err) {
      showToast?.('Something went wrong. Check your connection and try again.', 'error');
      setIsThinking(false);
    }
  }, [textInput, isThinking, messages, scenario, playAudio, showToast]);

  if (phase === 'select') {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className={styles.title}>AI Conversation</h1>
          <div style={{ width: 44 }} />
        </div>
        <p className={styles.subtitle}>Choose a scene to practise</p>
        <div className={styles.sceneGrid}>
          {getScenarios().map(s => (
            <button
              key={s.id}
              className={styles.sceneCard}
              style={
                imageLoadState[s.id] === 'failed'
                  ? { background: s.fallbackGradient }
                  : { backgroundImage: `url(${s.backgroundUrl}?w=600&auto=format&fit=crop)` }
              }
              onClick={() => handleSelectScenario(s)}
            >
              <div className={styles.sceneCardOverlay} />
              <div className={styles.sceneCardContent}>
                <span className={styles.sceneEmoji}>{s.emoji}</span>
                <span className={styles.sceneCardTitle}>{s.title}</span>
                <span className={styles.sceneCardChinese}>{s.chineseTitle}</span>
                <span className={styles.sceneCardPersona}>{s.persona}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'review') {
    const userMsgs = messages.filter(m => m.role === 'user');
    const totalTurns = userMsgs.length;
    const sessionTime = 0; // rough — no timer in AI chat currently

    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onBack} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h1 className={styles.title}>Conversation Review</h1>
          <div style={{ width: 44 }} />
        </div>

        <div className={styles.reviewIconWrap}>
          <div className={styles.reviewSuccessCircle}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-dark)" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <p className={styles.reviewTitle}>Conversation complete</p>
        {scenario?.title && <p className={styles.reviewScenario}>Scenario: {scenario.title}</p>}

        <div className={styles.reviewStatRow}>
          <div className={styles.reviewStat}>
            <span className={styles.reviewStatNum}>{totalTurns}</span>
            <span className={styles.reviewStatLabel}>turns</span>
          </div>
        </div>

        <p className={styles.reviewSectionLabel}>TRANSCRIPT</p>
        <div className={styles.reviewList}>
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.reviewBubble} ${msg.role === 'user' ? styles.reviewUserBubble : styles.reviewAiBubble}`}>
              <span className={styles.reviewSpeaker}>{msg.role === 'user' ? 'You' : 'AI'}</span>
              {msg.chinese && <p className={styles.reviewChinese} lang="yue">{msg.chinese}</p>}
              {msg.romanization && msg.role === 'user' && <p className={styles.reviewRoman}>{msg.romanization}</p>}
              {msg.english && <p className={styles.reviewEnglish}>{msg.english}</p>}
              {msg.role === 'user' && !savedMsgIds.has(i) && (
                <button className={styles.saveMsgBtn} onClick={() => handleSavePhrase(msg, i)}>
                  + Save
                </button>
              )}
              {msg.role === 'user' && savedMsgIds.has(i) && (
                <span className={styles.savedLabel}>✓ Saved</span>
              )}
            </div>
          ))}
        </div>

        <div className={styles.reviewActions}>
          <button className={styles.tryAnotherBtn} onClick={() => { setPhase('select'); setScenario(null); setMessages([]); setSavedMsgIds(new Set()); }}>
            Try another scenario
          </button>
          <button className={styles.reviewDoneBtn} onClick={onBack}>Done</button>
        </div>
      </div>
    );
  }

  // Chat phase — immersive full-screen layout
  return (
    <div
      className={styles.chatScreen}
      style={
        scenario?.backgroundUrl
          ? imageLoadState[scenario.id] === 'failed'
            ? { background: scenario.fallbackGradient }
            : { backgroundImage: `url(${scenario.backgroundUrl}?w=1200&auto=format&fit=crop)` }
          : {}
      }
    >
      {/* Dark overlay so text stays readable */}
      <div className={styles.bgOverlay} />

      {/* All chat content sits above the overlay */}
      <div className={styles.chatContent}>

        {/* Header */}
        <div className={styles.chatHeader}>
          <button className={styles.chatCloseBtn} onClick={handleEndChat} aria-label="End">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={styles.chatHeaderCenter}>
            <span className={styles.chatSceneEmoji}>{scenario?.emoji}</span>
            <span className={styles.chatSceneTitle}>{scenario?.title}</span>
            {scenario?.chineseTitle && (
              <span className={styles.chatSceneChinese}>{scenario.chineseTitle}</span>
            )}
          </div>
          <button className={styles.chatEndBtn} onClick={handleEndChat}>End</button>
        </div>

        {/* API error (empty state — first message failed) */}
        {apiError && messages.length === 0 && (
          <div className={styles.chatErrorBanner}>
            <p className={styles.chatErrorText}>
              Could not connect. Check your connection and try again.
            </p>
            <button className={styles.chatRetryBtn} onClick={() => handleSelectScenario(apiError)}>
              Retry
            </button>
          </div>
        )}

        {/* Message list */}
        <div className={styles.chatArea} ref={chatRef}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.aiBubble}`}
            >
              {msg.romanization && <p className={styles.bubbleRoman}>{msg.romanization}</p>}
              {msg.chinese && <p className={styles.bubbleChinese} lang="yue">{msg.chinese}</p>}
              {msg.english && <p className={styles.bubbleEnglish}>{msg.english}</p>}
            </div>
          ))}
          {isThinking && (
            <div className={styles.thinkingBubble}>
              <div className={styles.thinkingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className={styles.chatInputArea}>
          {inputMode === 'text' ? (
            <>
              <div className={styles.textInputRow}>
                <input
                  className={styles.chatTextInput}
                  type="text"
                  placeholder="Type in English..."
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTextSend()}
                  autoFocus
                />
                <button
                  className={`${styles.chatSendBtn} ${textInput.trim() ? styles.chatSendBtnActive : ''}`}
                  onClick={handleTextSend}
                  disabled={!textInput.trim() || isThinking}
                  aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" fill="none" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <button className={styles.chatSwitchModeBtn} onClick={() => setInputMode('voice')}>
                🎤 Speak instead
              </button>
            </>
          ) : (
            <>
              {isThinking ? (
                <p className={styles.chatWaitingText}>Waiting for response...</p>
              ) : phase === 'recording' ? (
                <RecordButton isRecording={isRecording} onStart={handleRecord} onStop={handleStopRecord} error={micError} />
              ) : (
                <RecordButton isRecording={false} onStart={handleRecord} onStop={() => {}} error={micError} />
              )}
              <button className={styles.chatSwitchModeBtn} onClick={() => setInputMode('text')}>
                ⌨️ Type instead
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
