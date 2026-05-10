module.exports = {
  WATER_TANK_MAX_CAPACITY: 5000,
  DEFAULT_WATER_TANK_ID: 'main-tank',
  USAGE_TYPES: {
    CHECKIN_BASIC: 'checkin_basic',
    LAUNDRY: 'laundry',
    POOL_REFILL: 'pool_refill',
    OTHER: 'other'
  },
  STAY_STATUS: {
    ACTIVE: 'active',
    CHECKED_OUT: 'checked_out',
    CANCELLED: 'cancelled'
  },
  USAGE_STATUS: {
    VALID: 'valid',
    REVOKED: 'revoked',
    CORRECTED: 'corrected'
  },
  OPERATION_TYPES: {
    CREATE: 'create',
    UPDATE: 'update',
    REVOKE: 'revoke',
    CORRECT: 'correct',
    SUPPLY: 'supply',
    CHECKOUT: 'checkout'
  }
};
