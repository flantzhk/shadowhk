// src/hooks/useSubscription.test.js — unit tests for useSubscription hook

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// vi.mock is hoisted — use vi.hoisted() so mock references work inside factories
const { mockOnAuthStateChanged, mockOnSnapshot, mockCollection, mockDoc } = vi.hoisted(() => {
  const mockOnSnapshot = vi.fn();
  const mockDoc = vi.fn(() => ({ onSnapshot: mockOnSnapshot }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  const mockOnAuthStateChanged = vi.fn();
  return { mockOnAuthStateChanged, mockOnSnapshot, mockCollection, mockDoc };
});

vi.mock('../services/firebase', () => ({
  fbAuth: { onAuthStateChanged: mockOnAuthStateChanged },
  fbDb: { collection: mockCollection },
}));

import { useSubscription } from './useSubscription';

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // --- logged-out ---

  it('returns isPro=false, isLoading=false when no user is signed in', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb(null); // no user
      return vi.fn(); // unsubscribe noop
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isPro).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('free');
  });

  // --- free user ---

  it('returns isPro=false for a free user', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-free' });
      return vi.fn();
    });
    mockOnSnapshot.mockImplementation((successCb) => {
      successCb({ exists: true, data: () => ({ subscription_status: 'free' }) });
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isPro).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('free');
  });

  // --- pro user ---

  it('returns isPro=true for a user with subscription_status="pro"', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-pro' });
      return vi.fn();
    });
    mockOnSnapshot.mockImplementation((successCb) => {
      successCb({ exists: true, data: () => ({ subscription_status: 'pro' }) });
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isPro).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('pro');
  });

  it('returns isPro=true for Stripe raw status "active"', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-active' });
      return vi.fn();
    });
    mockOnSnapshot.mockImplementation((successCb) => {
      successCb({ exists: true, data: () => ({ subscription_status: 'active' }) });
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isPro).toBe(true);
  });

  // --- localStorage fallback ---

  it('falls back to cached status when Firestore snapshot errors', () => {
    localStorage.setItem('shadowspeak_sub_status', 'pro');

    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-offline' });
      return vi.fn();
    });
    mockOnSnapshot.mockImplementation((_successCb, errorCb) => {
      errorCb(new Error('Firestore unavailable'));
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isPro).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('pro');
  });

  it('returns isPro=false if Firestore errors and no cache exists', () => {
    // localStorage is empty (cleared in beforeEach)
    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-nocache' });
      return vi.fn();
    });
    mockOnSnapshot.mockImplementation((_successCb, errorCb) => {
      errorCb(new Error('offline'));
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.isPro).toBe(false);
    expect(result.current.status).toBe('free');
  });

  // --- cache write ---

  it('writes the Firestore status to localStorage after a successful read', () => {
    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-write' });
      return vi.fn();
    });
    mockOnSnapshot.mockImplementation((successCb) => {
      successCb({ exists: true, data: () => ({ subscription_status: 'pro' }) });
      return vi.fn();
    });

    renderHook(() => useSubscription());

    expect(localStorage.getItem('shadowspeak_sub_status')).toBe('pro');
  });

  // --- listener cleanup ---

  it('unsubscribes both auth and Firestore listeners on unmount', () => {
    const unsubAuth = vi.fn();
    const unsubDoc = vi.fn();

    mockOnAuthStateChanged.mockImplementation((cb) => {
      cb({ uid: 'uid-cleanup' });
      return unsubAuth;
    });
    mockOnSnapshot.mockImplementation((successCb) => {
      successCb({ exists: true, data: () => ({ subscription_status: 'free' }) });
      return unsubDoc;
    });

    const { unmount } = renderHook(() => useSubscription());
    unmount();

    expect(unsubAuth).toHaveBeenCalledOnce();
    expect(unsubDoc).toHaveBeenCalledOnce();
  });
});
