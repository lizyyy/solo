import { initApp } from './app';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    const app = await initApp();

    app.listen(PORT, () => {
      console.log('========================================');
      console.log('    血袋临期调拨台 API 服务启动');
      console.log('========================================');
      console.log(`服务地址: http://localhost:${PORT}`);
      console.log(`API 基础路径: http://localhost:${PORT}/api`);
      console.log('========================================');
      console.log('可用端点:');
      console.log('  GET  /api/health                 - 健康检查');
      console.log('  GET  /api/wards                  - 病区列表');
      console.log('  POST /api/wards                  - 创建病区');
      console.log('  GET  /api/blood-bags             - 血袋列表');
      console.log('  POST /api/blood-bags             - 血袋入库');
      console.log('  POST /api/blood-bags/:id/reserve - 预留血袋');
      console.log('  POST /api/blood-bags/:id/release - 释放血袋');
      console.log('  POST /api/blood-bags/:id/issue   - 血袋出库');
      console.log('  GET  /api/applications           - 申请单列表');
      console.log('  POST /api/applications           - 创建申请单');
      console.log('  GET  /api/applications/:id/match - 匹配推荐');
      console.log('  POST /api/applications/:id/reserve - 预留血袋');
      console.log('  POST /api/applications/:id/issue   - 出库发放');
      console.log('  POST /api/applications/:id/cancel  - 取消申请');
      console.log('  GET  /api/audit                  - 审计日志');
      console.log('  POST /api/reports/import         - 导入CSV库存');
      console.log('  GET  /api/reports/inventory/csv  - 导出库存CSV');
      console.log('  GET  /api/reports/shift-report   - 值班报告');
      console.log('========================================');
    });
  } catch (error) {
    console.error('启动服务失败:', error);
    process.exit(1);
  }
}

startServer();
