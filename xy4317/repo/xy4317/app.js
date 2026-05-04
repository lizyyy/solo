const express = require('express');
const path = require('path');
const { initDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const importRoutes = require('./routes/import');
const validationRoutes = require('./routes/validation');
const summaryRoutes = require('./routes/summary');
const exportRoutes = require('./routes/export');

app.use('/api/import', importRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '老旧小区加装电梯项目API服务'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: '老旧小区加装电梯项目API服务',
    version: '1.0.0',
    endpoints: {
      import: {
        households_csv: 'POST /api/import/households/csv - 导入楼栋住户表CSV',
        signatures_json: 'POST /api/import/signatures/json - 导入签字意愿JSON',
        construction_batches: 'POST /api/import/construction-batches - 导入施工批次',
        complaints: 'POST /api/import/complaints - 导入投诉记录'
      },
      validation: {
        building: 'GET /api/validation/building/:building_code - 楼栋完整校验',
        duplicate_signatures: 'POST /api/validation/check/duplicate-signatures - 重复签字校验',
        low_floor_opposition: 'POST /api/validation/check/low-floor-opposition - 低楼层反对检查',
        construction_conflicts: 'POST /api/validation/check/construction-conflicts - 施工时间冲突检查',
        signature_ratio: 'GET /api/validation/check/signature-ratio/:building_code - 签字比例检查',
        conflict_review: 'POST /api/validation/conflict-review - 冲突复核'
      },
      summary: {
        building: 'GET /api/summary/building/:building_code - 楼栋方案汇总',
        all_buildings: 'GET /api/summary/all-buildings - 所有楼栋汇总',
        dashboard: 'GET /api/summary/dashboard - 仪表板数据'
      },
      export: {
        building: 'GET /api/export/building/:building_code?format=json|csv - 导出楼栋汇总',
        all_buildings: 'GET /api/export/all-buildings?format=json|csv - 导出所有楼栋',
        signatures: 'GET /api/export/signatures/:building_code?format=json|csv - 导出签字记录',
        validation_report: 'GET /api/export/validation-report/:building_code?format=json|csv - 导出校验报告'
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('数据库初始化完成');
    
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║         老旧小区加装电梯项目API服务已启动                      ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                             ║
║  API文档:  http://localhost:${PORT}/api                         ║
║  健康检查: http://localhost:${PORT}/api/health                  ║
╠════════════════════════════════════════════════════════════╣
║  可用API端点:                                                  ║
║  - 导入接口: /api/import/*                                     ║
║  - 校验接口: /api/validation/*                                 ║
║  - 汇总接口: /api/summary/*                                    ║
║  - 导出接口: /api/export/*                                     ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
