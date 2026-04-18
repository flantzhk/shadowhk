// src/hooks/useRecorder.js — Microphone recording hook

import { useState, useRef, useCallback, useEffect } from 'react';
import { RECORDING_MAX_SECONDS } from '../utils/constants';

/**
 * Hook for recording user audio via MediaRecorder.
 * @returns {{
 *   isRecording: boolean,
 *   startRecording: () => Promise<void>,
 *   stopRecording: () => Promise<Blob|null>,
 *   error: string|null
 * }}
 */
function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      timerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, RECORDING_MAX_SECONDS * 1000);
    } catch (err) {
      setError('Microphone access denied. Please enable it in your browser settings.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        recorder.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  // Cleanup on unmount: stop recording and release mic
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
        recorder.stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { isRecording, startRecording, stopRecording, error };
}

export { useRecorder };
