// src/test/setup.js — Global test setup for Vitest + React Testing Library
import '@testing-library/jest-dom';

// Reset localStorage between tests to prevent state leakage
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
