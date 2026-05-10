const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('MongoDB 数据库连接成功');
  } catch (error) {
    logger.error('MongoDB 数据库连接失败', error);
    process.exit(1);
  }
};

module.exports = connectDB;
