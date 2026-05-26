const mongoose = require('mongoose');
const config = require('../config');

async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    console.log('[DB] MongoDB 连接成功');
  } catch (err) {
    console.error('[DB] MongoDB 连接失败:', err.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB 连接断开，正在尝试重连...');
});

mongoose.connection.on('reconnected', () => {
  console.log('[DB] MongoDB 重连成功');
});

module.exports = connectDB;
