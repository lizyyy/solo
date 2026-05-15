const express = require('express');
const config = require('./config');
const meetingRoutes = require('./routes/meeting');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', meetingRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({
    code: 'HEALTH_OK',
    status: 'running',
    timestamp: new Date().toISOString(),
    dataPersistence: 'JSON file storage - 重启后数据保持不变'
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      code: 'FILE_TOO_LARGE',
      message: `文件大小超过限制，最大允许: ${config.MAX_FILE_SIZE / 1024 / 1024}MB`
    });
  }

  res.status(500).json({
    code: 'SERVER_ERROR',
    message: err.message || '服务器内部错误'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    code: 'ENDPOINT_NOT_FOUND',
    message: '接口不存在',
    details: {
      method: req.method,
      path: req.originalUrl,
      availableEndpoints: {
        meeting: [
          'POST /api/records - 补录会议纪要',
          'GET /api/records - 查询所有会议记录',
          'GET /api/records/:id - 查询单条会议记录'
        ],
        admin: [
          'POST /api/admin/cache/refresh - 刷新部门鉴权路径缓存',
          'GET /api/admin/cache/status - 查看缓存状态',
          'POST /api/admin/rollback/candidates - 生成回滚候选清单',
          'GET /api/admin/rollback/candidates - 查询候选清单',
          'POST /api/admin/rollback/approve - 审批候选清单',
          'POST /api/admin/rollback/execute - 执行已审批的回滚',
          'GET /api/admin/failed-items - 查询失败项',
          'POST /api/admin/search-reports - 创建搜索报告',
          'GET /api/admin/search-reports - 查询所有搜索报告',
          'POST /api/admin/search-reports/:id/review - 复核搜索报告'
        ],
        health: ['GET /health - 健康检查']
      }
    }
  });
});

app.listen(config.PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         鉴权路径解释器 - 后端服务已启动                        ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${config.PORT}                              ║
║  健康检查: http://localhost:${config.PORT}/health                         ║
║                                                            ║
║  数据持久化: JSON 文件存储，重启后数据仍然可查询               ║
║  存储目录: ${config.DATA_DIR}
║                                                            ║
║  主要功能:                                                 ║
║    ✓ 会议纪要附件补录 (主流程)                               ║
║    ✓ 缓存未刷新异常处理 (异常流)                             ║
║    ✓ 回滚候选清单生成 (防误伤)                               ║
║    ✓ 失败项独立保存 (便于接手)                               ║
║    ✓ 搜索词报告复核样例 + 导出摘要                           ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
