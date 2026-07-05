// Tests for the SRS scheduling math — FSRS-lite continuous difficulty/stability model.
import { describe, it, expect } from 'vitest';
import { calculateNextReview } from './srs';
import { SRS_MASTERED_THRESHOLD } from '../utils/constants';

const DAY = 86400000;
const fresh = { interval: 0, stability: 0, difficulty: 5, practiceCount: 0 };

describe('calculateNextReview', () => {
  it('first high score schedules ~1 day out', () => {
    const r = calculateNextReview(fresh, 'correct', 95);
    expect(r.interval).toBeGreaterThanOrEqual(1);
    expect(r.interval).toBeLessThanOrEqual(2);
    expect(r.practiceCount).toBe(1);
    expect(r.nextReviewAt).toBeGreaterThan(Date.now());
  });

  it('low score resets interval/stability to 0 and raises difficulty', () => {
    const r = calculateNextReview({ interval: 10, stability: 10, difficulty: 5, practiceCount: 5, lastPracticedAt: Date.now() - 5 * DAY }, 'hard', 40);
    expect(r.interval).toBe(0);
    expect(r.stability).toBe(0);
    expect(r.difficulty).toBeGreaterThan(5);
  });

  it('repeated realistic high-score reviews grow interval over successive reviews', () => {
    let e = { ...fresh };
    const intervals = [];
    for (let i = 0; i < 6; i += 1) {
      // simulate the elapsed gap implied by the previous interval before reviewing again
      if (i > 0) e = { ...e, lastPracticedAt: Date.now() - Math.max(1, e.interval) * DAY };
      const r = calculateNextReview(e, 'correct', 95);
      intervals.push(r.interval);
      e = { ...e, ...r };
    }
    // interval is a rounded view of continuously-growing stability, so it can
    // repeat for a step before ticking up — assert the overall trend over 3+ reviews.
    expect(intervals[intervals.length - 1]).toBeGreaterThan(intervals[0]);
    expect(intervals[3]).toBeGreaterThan(intervals[0]);
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
  });

  it('keeps reps in step with practiceCount (growth-state display reads reps)', () => {
    const r = calculateNextReview({ ...fresh, practiceCount: 4 }, 'correct', 95);
    expect(r.reps).toBe(5);
    expect(r.reps).toBe(r.practiceCount);
  });

  it('recovers from a lapse instead of staying permanently harder (no ease-hell)', () => {
    let e = { ...fresh, difficulty: 5 };
    const lapse = calculateNextReview(e, 'forgot', 40);
    e = { ...e, ...lapse, lastPracticedAt: Date.now() };
    const postLapseDifficulty = lapse.difficulty;

    for (let i = 0; i < 5; i += 1) {
      e = { ...e, lastPracticedAt: Date.now() - Math.max(1, e.interval || 1) * DAY };
      const r = calculateNextReview(e, 'correct', 95);
      e = { ...e, ...r };
    }

    expect(e.difficulty).toBeLessThan(postLapseDifficulty);
  });

  it('pronunciationScore overrides quality bucket', () => {
    const passDespiteForgot = calculateNextReview(fresh, 'forgot', 95);
    expect(passDespiteForgot.interval).toBeGreaterThanOrEqual(1);

    const lapseDespiteCorrect = calculateNextReview(
      { interval: 10, stability: 10, difficulty: 5, practiceCount: 5, lastPracticedAt: Date.now() - 10 * DAY },
      'correct',
      40,
    );
    expect(lapseDespiteCorrect.interval).toBe(0);
  });

  it('interval reaching SRS_MASTERED_THRESHOLD marks mastered', () => {
    const entry = {
      interval: 20,
      stability: 20,
      difficulty: 2,
      practiceCount: 8,
      lastPracticedAt: Date.now() - 20 * DAY,
    };
    const r = calculateNextReview(entry, 'correct', 98);
    expect(r.interval).toBeGreaterThanOrEqual(SRS_MASTERED_THRESHOLD);
    expect(r.status).toBe('mastered');
  });
});
