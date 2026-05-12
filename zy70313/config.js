export default {
  idempotency: {
    defaultTTL: 300,
    allowReuseAfterExpiry: false,
    keyHeader: 'X-Idempotency-Key',
    cleanupInterval: 60,
    retentionDays: 30,
  },
  business: {
    simulateDelay: {
      payment: 2000,
      refund: 1500,
      coupon: 3000,
    },
  },
};
