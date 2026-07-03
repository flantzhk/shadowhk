#!/bin/zsh
# Self-contained overnight finisher: waits for word-audio generation to
# complete, then commits and pushes (which deploys via GitHub Pages).
# Runs detached — needs no Claude session. Log: tail -f .overnight.log
cd "$HOME/Documents/ShadowHK" || exit 1
LOG=".overnight.log"
echo "[$(date)] overnight-deploy watcher started" >> "$LOG"

# Wait for the generator to finish (max 4 hours)
for i in $(seq 1 480); do
  if ! pgrep -f generate-word-audio > /dev/null; then
    break
  fi
  sleep 30
done

COUNT=$(ls public/audio/cantonese-words 2>/dev/null | wc -l | tr -d ' ')
echo "[$(date)] generator finished, $COUNT word files present" >> "$LOG"

if [ "$COUNT" -lt 1100 ]; then
  echo "[$(date)] fewer than 1100 files — generation incomplete, NOT deploying. Rerun generator." >> "$LOG"
  exit 1
fi

# Guard: refuse to commit any file that is secretly a JSON error body
BAD=$(find public/audio/cantonese-words -name "*.mp3" -size -2k | wc -l | tr -d ' ')
if [ "$BAD" -gt 0 ]; then
  echo "[$(date)] $BAD suspicious small files found — removing them (rerun generator to fill gaps)" >> "$LOG"
  find public/audio/cantonese-words -name "*.mp3" -size -2k -delete
fi

git add public/audio/cantonese-words
git commit -m "v2.3.48 — word-by-word audio: $COUNT words and characters pre-recorded

Word taps now work offline. Generated overnight via cantonese.ai.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1
echo "[$(date)] pushed — GitHub Pages deploy triggered. Done." >> "$LOG"
