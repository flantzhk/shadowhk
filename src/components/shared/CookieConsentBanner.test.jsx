// src/components/shared/CookieConsentBanner.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieConsentBanner } from './CookieConsentBanner';
import { getConsent, hasAnalyticsConsent } from '../../services/consent';

// CSS modules are auto-mocked by jsdom (class names become object keys)

describe('CookieConsentBanner', () => {
  let onConsent;

  beforeEach(() => {
    onConsent = vi.fn();
  });

  it('renders the default banner with Accept and Manage buttons', () => {
    render(<CookieConsentBanner onConsent={onConsent} />);
    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manage preferences/i })).toBeInTheDocument();
  });

  it('calls onConsent and saves consent when Accept all is clicked', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner onConsent={onConsent} />);

    await user.click(screen.getByRole('button', { name: /accept all/i }));

    expect(onConsent).toHaveBeenCalledOnce();
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('shows the preferences panel when Manage preferences is clicked', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner onConsent={onConsent} />);

    await user.click(screen.getByRole('button', { name: /manage preferences/i }));

    expect(screen.getByText(/cookie preferences/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /analytics/i })).toBeInTheDocument();
  });

  it('saves preferences and calls onConsent from the preferences panel', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner onConsent={onConsent} />);

    await user.click(screen.getByRole('button', { name: /manage preferences/i }));
    await user.click(screen.getByRole('button', { name: /save preferences/i }));

    expect(onConsent).toHaveBeenCalledOnce();
    const record = getConsent();
    expect(record).not.toBeNull();
  });

  it('can toggle analytics off in preferences and saves analytics: false', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner onConsent={onConsent} />);

    await user.click(screen.getByRole('button', { name: /manage preferences/i }));

    const toggle = screen.getByRole('switch', { name: /analytics/i });
    // Toggle is on by default (aria-checked=true), click to turn off
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('button', { name: /save preferences/i }));
    expect(getConsent().analytics).toBe(false);
  });

  it('back button returns to the main banner', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner onConsent={onConsent} />);

    await user.click(screen.getByRole('button', { name: /manage preferences/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
  });

  it('has a privacy policy link', () => {
    render(<CookieConsentBanner onConsent={onConsent} />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument();
  });
});
