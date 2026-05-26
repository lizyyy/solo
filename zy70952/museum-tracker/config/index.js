const path = require('path');

module.exports = {
  port: process.env.PORT || 3001,
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '..', 'database.sqlite'),
  uploadDir: process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads'),
  exportDir: process.env.EXPORT_DIR || path.resolve(__dirname, '..', 'exports'),
  artifactLevels: ['一级', '二级', '三级', '一般'],
  batchStatuses: ['待审核', '已放行', '已退回', '需补材料'],
  exceptionTypes: ['估值变更', '运输延误', '温湿度异常'],
  maxUploadSize: 10 * 1024 * 1024
};
