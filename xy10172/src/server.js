require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electronic_signature';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ 数据库连接成功');
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在端口 ${PORT}`);
      console.log(`📚 API 文档: http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((error) => {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  });

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔒 数据库连接已关闭');
  process.exit(0);
});
