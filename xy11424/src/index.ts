import { createApp } from './app';

const PORT = process.env.PORT || 3000;

const { app } = createApp();

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   二手车整备权限追责台账 API                                  ║
║   Used Car Preparation Traceability API                      ║
║                                                              ║
║   服务地址: http://localhost:${PORT}                          ║
║   健康检查: http://localhost:${PORT}/health                   ║
║                                                              ║
║   接口文档:                                                  ║
║   POST /api/inspection      - 提交检测单                     ║
║   POST /api/repair          - 提交维修报价                   ║
║   POST /api/photo           - 提交照片清单                   ║
║   GET  /api/ledger          - 获取台账列表                   ║
║   GET  /api/ledger/:id      - 获取台账详情                   ║
║   GET  /api/ledger/export/* - 导出数据                       ║
║   GET  /api/failed          - 查看失败记录                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
