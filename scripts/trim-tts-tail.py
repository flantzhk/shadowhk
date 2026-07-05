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
    """Cut point: deepest envelope dip near whisper's first-tail-token anchor.

    Two edge cases in very short (1-2 char) real words:
    - the search window used to reach 0.55s past the anchor, wide enough to
      span a full repetition of the two-syllable 蘋果 tail — on short clips
      the deepest dip in that range is sometimes the gap *between* two tail
      repetitions rather than the real word/tail boundary, cutting too late
      and leaving part of the tail in. Narrowed to 0.18s (just past one
      syllable) so it can't reach past the first tail token.
    - whisper sometimes fails to hear a very short/light real word at all
      (e.g. a toneless particle) and transcribes the whole clip as tail —
      falls back to envelope-only: the first sufficiently deep, sufficiently
      long silence gap after a brief onset skip.
    """
    i = len(words)
    while i > 0 and is_tail_token(words[i - 1][0]):
        i -= 1
    if i == len(words):
        raise RuntimeError(f'sacrificial tail not found in transcript: {[w[0] for w in words]}')
    if i == 0:
        return _find_cut_from_envelope_only(bars)
    anchor = words[i][1]  # start of first tail token (skews early: includes the pause)
    # Look a bit past the anchor too — a sustained vowel's natural decay can
    # still be audible right at whisper's marked word-end, so the true
    # silence floor sometimes sits slightly later than the anchor itself.
    lo = max(0, int((anchor - 0.06) / 0.02))
    hi = min(len(bars) - 1, int((anchor + 0.3) / 0.02))
    if hi <= lo:
        raise RuntimeError('anchor window empty')
    peak = max(bars)
    dip = min(range(lo, hi + 1), key=lambda b: bars[b])
    # Require the dip to actually be near the noise floor (not just a local
    # minimum inside a decaying vowel) — otherwise this anchor is unusable.
    if bars[dip] > peak * 0.05:
        raise RuntimeError('no true silence found near anchor — likely still decaying speech')
    th = max(peak * 0.05, bars[dip] * 2)
    start = dip
    while start > lo and bars[start - 1] < th:
        start -= 1
    end = dip
    while end < hi and bars[end + 1] < th:
        end += 1
    # A single 20ms dip sandwiched between energetic regions is usually TTS
    # prosody, not the real word/tail boundary — too fragile to trust.
    if end - start < 2:
        raise RuntimeError('silence gap too narrow to trust as a real boundary')
    return (start + min(5, max(1, end - start))) * 0.02


def _find_cut_from_envelope_only(bars):
    """No whisper anchor available — find the first gap (>=0.1s below 8% of
    peak) after a brief onset skip, on the assumption the real word is a
    single short syllable right at the start of the clip."""
    peak = max(bars)
    if peak < 500:
        raise RuntimeError('audio is silent, no envelope anchor available')
    th = peak * 0.08
    onset_skip = 4  # 0.08s — past the real word's initial attack
    min_gap = 5  # 0.1s
    i = onset_skip
    while i < len(bars):
        if bars[i] < th:
            start = i
            while i < len(bars) and bars[i] < th:
                i += 1
            if i - start >= min_gap:
                return (start + min(5, max(1, i - start))) * 0.02
        else:
            i += 1
    raise RuntimeError('no silence gap found for envelope-only fallback')


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
