module.exports = {
  PORT: process.env.PORT || 3000,
  DATA_DIR: './data',
  MAX_OVERTIME: 300,
  MAX_SKIP_COUNT: 2,
  AUTO_CANCEL_TIME: 600,
  TABLE_TYPES: {
    SMALL: { name: '小桌', min: 1, max: 4 },
    MEDIUM: { name: '中桌', min: 5, max: 8 },
    LARGE: { name: '大桌', min: 9, max: 12 }
  }
};
