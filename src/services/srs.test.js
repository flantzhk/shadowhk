// Tests for the SRS scheduling math — the core of progress correctness.
import { describe, it, expect } from 'vitest';
import { calculateNextReview } from './srs';

const fresh = { interval: 0, easeFactor: 2.5, practiceCount: 0 };

describe('calculateNextReview', () => {
  it('first correct answer schedules 1 day out', () => {
    const r = calculateNextReview(fresh, 'correct');
    expect(r.interval).toBe(1);
    expect(r.practiceCount).toBe(1);
    expect(r.nextReviewAt).toBeGreaterThan(Date.now());
  });

  it('progression: 0 -> 1 -> 3 -> ease-multiplied', () => {
    let e = { ...fresh };
    e = { ...e, ...calculateNextReview(e, 'correct') };
    expect(e.interval).toBe(1);
    e = { ...e, ...calculateNextReview(e, 'correct') };
    expect(e.interval).toBe(3);
    e = { ...e, ...calculateNextReview(e, 'correct') };
    expect(e.interval).toBeGreaterThan(3);
  });

  it('forgot resets interval and lowers ease', () => {
    const r = calculateNextReview({ interval: 10, easeFactor: 2.5, practiceCount: 5 }, 'forgot');
    expect(r.interval).toBe(0);
    expect(r.easeFactor).toBeLessThan(2.5);
  });

  it('keeps reps in step with practiceCount (growth-state display reads reps)', () => {
    const r = calculateNextReview({ ...fresh, practiceCount: 4 }, 'correct');
    expect(r.reps).toBe(5);
    expect(r.reps).toBe(r.practiceCount);
  });

  it('pronunciation score overrides quality: >=90 correct, 70-89 hard, <70 forgot', () => {
    expect(calculateNextReview(fresh, 'forgot', 95).interval).toBe(1);   // treated correct
    expect(calculateNextReview({ interval: 10, easeFactor: 2.5 }, 'correct', 40).interval).toBe(0); // treated forgot
  });

  it('interval reaching 21 days marks mastered', () => {
    const r = calculateNextReview({ interval: 15, easeFactor: 2.0, practiceCount: 6 }, 'correct');
    expect(r.interval).toBeGreaterThanOrEqual(21);
    expect(r.status).toBe('mastered');
  });
});
