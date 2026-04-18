// src/utils/logger.js

const IS_PRODUCTION = import.meta.env.PROD;

const logger = {
  info: (...args) => { if (!IS_PRODUCTION) console.info('[SS]', ...args); },
  warn: (...args) => { if (!IS_PRODUCTION) console.warn('[SS]', ...args); },
  error: (...args) => { console.error('[SS]', ...args); },
};

export { logger };
