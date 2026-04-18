// src/components/shared/EmailCaptureModal.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Firebase before importing the component
vi.mock('../../services/firebase', () => ({
  fbAuth: { currentUser: null },
  fbDb: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        set: vi.fn().mockResolvedValue(undefined),
      }),
      add: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
    }),
  },
}));

import { EmailCaptureModal, isEmailCaptureSnoozed, snoozeEmailCapture } from './EmailCaptureModal';

const DISMISS_KEY = 'ss_email_capture_dismissed';

describe('isEmailCaptureSnoozed', () => {
  it('returns false when nothing is stored', () => {
    expect(isEmailCaptureSnoozed()).toBe(false);
  });

  it('returns true within 7 days of dismissal', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 1000));
    expect(isEmailCaptureSnoozed()).toBe(true);
  });

  it('returns false after 7 days have passed', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(eightDaysAgo));
    expect(isEmailCaptureSnoozed()).toBe(false);
  });
});

describe('snoozeEmailCapture', () => {
  it('stores a timestamp in localStorage', () => {
    snoozeEmailCapture();
    const stored = localStorage.getItem(DISMISS_KEY);
    expect(stored).not.toBeNull();
    expect(Number(stored)).toBeGreaterThan(0);
  });

  it('makes isEmailCaptureSnoozed return true immediately after', () => {
    snoozeEmailCapture();
    expect(isEmailCaptureSnoozed()).toBe(true);
  });
});

describe('EmailCaptureModal', () => {
  let onClose;

  beforeEach(() => {
    onClose = vi.fn();
  });

  it('renders the streak count in the title', () => {
    render(<EmailCaptureModal streakCount={3} onClose={onClose} />);
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
  });

  it('renders an email input and submit button', () => {
    render(<EmailCaptureModal streakCount={7} onClose={onClose} />);
    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send my report/i })).toBeInTheDocument();
  });

  it('shows validation error for empty submit', async () => {
    const user = userEvent.setup();
    render(<EmailCaptureModal streakCount={3} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /send my report/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup();
    render(<EmailCaptureModal streakCount={3} onClose={onClose} />);

    await user.type(screen.getByRole('textbox', { name: /email address/i }), 'notanemail');
    await user.click(screen.getByRole('button', { name: /send my report/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('clears the error when the user starts typing after a failed submit', async () => {
    const user = userEvent.setup();
    render(<EmailCaptureModal streakCount={3} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /send my report/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: /email address/i }), 'a');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('submits successfully with a valid email and shows success state', async () => {
    const user = userEvent.setup();
    render(<EmailCaptureModal streakCount={3} onClose={onClose} />);

    await user.type(screen.getByRole('textbox', { name: /email address/i }), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send my report/i }));

    await waitFor(() => {
      expect(screen.getByText(/you're in/i)).toBeInTheDocument();
    });
  });

  it('snoozes and calls onClose when No thanks is clicked', async () => {
    const user = userEvent.setup();
    render(<EmailCaptureModal streakCount={3} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /no thanks/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(isEmailCaptureSnoozed()).toBe(true);
  });

  it('snoozes and calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<EmailCaptureModal streakCount={7} onClose={onClose} />);

    // Click the backdrop (the dialog element itself)
    const backdrop = container.firstChild;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledOnce();
    expect(isEmailCaptureSnoozed()).toBe(true);
  });

  it('snoozes and calls onClose when close button (✕) is clicked', async () => {
    const user = userEvent.setup();
    render(<EmailCaptureModal streakCount={7} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(isEmailCaptureSnoozed()).toBe(true);
  });
});
