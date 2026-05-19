module.exports = {
  port: process.env.PORT || 3000,
  database: {
    path: './data/park-security.db'
  },
  security: {
    phoneMaskPattern: /(\d{3})\d{4}(\d{4})/,
    phoneMaskReplace: '$1****$2',
    idCardMaskPattern: /(\d{6})\d{8}(\d{4})/,
    idCardMaskReplace: '$1********$2'
  },
  appointment: {
    maxDurationHours: 24,
    expiredThresholdMinutes: 30
  },
  roles: {
    SUPER_ADMIN: 'super_admin',
    SECURITY_MANAGER: 'security_manager',
    GATE_GUARD: 'gate_guard'
  }
};
