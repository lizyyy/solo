const config = {
  RETENTION_PERIOD_DAYS: {
    order: 365,
    ticket: 90,
    log: 180
  },
  
  LEGAL_RETENTION_PERIOD_DAYS: 2555,
  
  DATA_TYPES: {
    user_profile: '用户资料',
    order: '订单',
    ticket: '工单',
    marketing: '营销记录',
    log: '日志索引'
  },
  
  MAX_RETRIES: 3,
  
  CERTIFICATE_PREFIX: 'DEL-CERT'
};

module.exports = config;
