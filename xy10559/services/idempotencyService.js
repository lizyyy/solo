const { store, now } = require('../models/store');

const idempotencyService = {
  check: (key) => {
    return store.idempotency[key] || null;
  },

  record: (key, result, expiresInSeconds = 3600) => {
    store.idempotency[key] = {
      result,
      createdAt: now(),
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    };
  },

  cleanup: () => {
    const current = now();
    Object.keys(store.idempotency).forEach(key => {
      if (store.idempotency[key].expiresAt < current) {
        delete store.idempotency[key];
      }
    });
  }
};

module.exports = idempotencyService;
