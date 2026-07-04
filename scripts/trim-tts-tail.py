#!/usr/bin/env python3.12
"""Trim the sacrificial TTS tail off raw cantonese.ai audio.

generate-scene-audio.mjs appends a sacrificial tail phrase to every TTS
request (cantonese.ai truncates audio to a per-character duration budget,
chopping the ends off short phrases) and saves {id}.raw.mp3. This script
finds where the tail digits start — whisper word timestamps give a coarse
anchor, the audio envelope's deepest dip near the anchor gives the precise
cut — writes the trimmed {id}.mp3, verifies it, and deletes the raw file.

Run (after generate-scene-audio.mjs):
  DYLD_LIBRARY_PATH="$(brew --prefix expat)/lib" python3.12 scripts/trim-tts-tail.py
Needs: ffmpeg, faster-whisper (python3.12 -m pip install faster-whisper).
"""

import glob
import math
import os
import re
import struct
import subprocess
import sys

OUT_DIRS = ['public/audio/cantonese', 'public/audio/cantonese-words']
RATE = 24000
WIN = int(RATE * 0.02)  # 20ms envelope windows
def is_tail_token(word):
    """True for whisper tokens that are part of the sacrificial 蘋果 tail.
    Ignores punctuation whisper tacks on; accepts simplified 苹果."""
    cleaned = re.sub(r'[^0-9A-Za-z一-鿿]', '', word)
    return bool(cleaned) and all(c in '蘋苹果' for c in cleaned)


def decode_pcm(path):
    p = subprocess.run(
        ['ffmpeg', '-v', 'quiet', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'],
        capture_output=True)
    n = len(p.stdout) // 2
    if not n:
        raise RuntimeError('ffmpeg decode failed')
    return struct.unpack(f'<{n}h', p.stdout[:n * 2])


def envelope(samples):
    return [math.sqrt(sum(s * s for s in samples[i:i + WIN]) / len(samples[i:i + WIN]))
            for i in range(0, len(samples), WIN)]


def find_cut_sec(words, bars):
    """Cut point: deepest envelope dip near whisper's first-tail-digit anchor."""
    # The tail is the trailing run of 蘋果 tokens. Walk back from the end.
    i = len(words)
    while i > 0 and is_tail_token(words[i - 1][0]):
        i -= 1
    if i == len(words) or i == 0:
        raise RuntimeError(f'sacrificial tail not found in transcript: {[w[0] for w in words]}')
    anchor = words[i][1]  # start of first tail token (skews early: includes the pause)
    lo = max(0, int((anchor - 0.06) / 0.02))
    hi = min(len(bars) - 1, int((anchor + 0.55) / 0.02))
    if hi <= lo:
        raise RuntimeError('anchor window empty')
    dip = min(range(lo, hi + 1), key=lambda b: bars[b])
    # widen to the low region around the dip, cut 0.1s into it
    th = max(max(bars) * 0.05, bars[dip] * 2)
    start = dip
    while start > lo and bars[start - 1] < th:
        start -= 1
    end = dip
    while end < hi and bars[end + 1] < th:
        end += 1
    return (start + min(5, max(1, end - start))) * 0.02


def encode(path, samples, cut_sec):
    n = min(len(samples), int(cut_sec * RATE))
    raw = struct.pack(f'<{n}h', *samples[:n])
    p = subprocess.run(
        ['ffmpeg', '-v', 'quiet', '-y', '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-i', '-',
         '-b:a', '160k', path],
        input=raw, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError('ffmpeg encode failed')


def transcribe(model, path):
    segments, _ = model.transcribe(path, language='zh', word_timestamps=True, beam_size=5,
                                   vad_filter=False, condition_on_previous_text=False)
    return [(w.word.strip(), w.start, w.end) for seg in segments for w in seg.words]


def verify(model, path, samples_len_sec):
    """Trimmed audio must have speech, a quiet ending, and no leftover digits."""
    samples = decode_pcm(path)
    bars = envelope(samples)
    peak = max(bars)
    if peak < 500:
        raise RuntimeError('trimmed audio is silent')
    tail = bars[-3:]
    if sum(t / peak for t in tail) / len(tail) > 0.08:
        raise RuntimeError('trimmed audio still ends abruptly')
    words = transcribe(model, path)
    trailing = 0
    for w, _, _ in reversed(words):
        if is_tail_token(w):
            trailing += 1
        else:
            break
    if trailing >= 1:
        raise RuntimeError(f'sacrificial tail survived the trim: {[w[0] for w in words]}')


def main():
    raws = sorted(p for d in OUT_DIRS for p in glob.glob(os.path.join(d, '*.raw.mp3')))
    if not raws:
        print('No .raw.mp3 files to trim.')
        return
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8')
    failed = []
    for idx, raw_path in enumerate(raws, 1):
        pid = os.path.basename(raw_path)[:-len('.raw.mp3')]
        out_path = os.path.join(os.path.dirname(raw_path), f'{pid}.mp3')
        try:
            samples = decode_pcm(raw_path)
            bars = envelope(samples)
            words = transcribe(model, raw_path)
            cut = find_cut_sec(words, bars)
            if cut < 0.25:
                raise RuntimeError(f'cut point too early ({cut:.2f}s)')
            encode(out_path, samples, cut)
            verify(model, out_path, cut)
            os.remove(raw_path)
            print(f'[{idx}/{len(raws)}] {pid} ok ({cut:.2f}s)')
        except Exception as e:
            if os.path.exists(out_path):
                os.remove(out_path)
            failed.append(pid)
            print(f'[{idx}/{len(raws)}] {pid} FAILED: {e}')
    print(f'\nDone. {len(raws) - len(failed)} trimmed, {len(failed)} failed.')
    if failed:
        print('Failed ids (raw kept for inspection):', ', '.join(failed))
        sys.exit(1)


if __name__ == '__main__':
    main()
