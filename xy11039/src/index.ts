import express from 'express';
import adjustmentRoutes from './routes/adjustment.routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '滑雪装备租赁点雪板租借调码 API 服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '欢迎使用滑雪装备租赁点雪板租借调码 API',
    apis: {
      单条人工处理: {
        创建调码: 'POST /api/adjustments/create',
        提交审核: 'POST /api/adjustments/:id/submit-review',
        审核通过: 'POST /api/adjustments/:id/approve',
        确认旧装备归还: 'POST /api/adjustments/:id/confirm-return',
        完成调码: 'POST /api/adjustments/:id/complete',
        查询详情: 'GET /api/adjustments/:id',
        查询列表: 'GET /api/adjustments'
      },
      批量补录: {
        批量导入CSV: 'POST /api/adjustments/batch/import',
        获取导入模板: 'GET /api/adjustments/batch/template'
      },
      导出报表: {
        导出CSV: 'GET /api/adjustments/export/csv',
        导出统计: 'GET /api/adjustments/export/statistics'
      },
      枚举查询: {
        调码类型: 'GET /api/adjustments/enums/types',
        调码状态: 'GET /api/adjustments/enums/status'
      }
    },
    业务特性: [
      '边界情况检测: 旧装备未回库存自动检测',
      '对账一致性校验: 费用计算和记录自动核对',
      '下一步行动指引: 接口返回需要补充的材料清单',
      '统一计算口径: 详情、列表、导出使用同一业务逻辑',
      '双入口处理: 支持单条人工处理和批量补录两种方式'
    ]
  });
});

app.use('/api/adjustments', adjustmentRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    errorCode: 'NOT_FOUND'
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║    滑雪装备租赁点雪板租借调码 API 服务启动成功              ║
  ║                                                           ║
  ║    服务地址: http://localhost:${PORT}                        ║
  ║    健康检查: http://localhost:${PORT}/health                  ║
  ║    API文档:  http://localhost:${PORT}                        ║
  ║                                                           ║
  ║    主要功能:                                                ║
  ║      ✅ 单条人工处理                                        ║
  ║      ✅ 批量CSV补录                                         ║
  ║      ✅ 旧装备未回库存检测                                  ║
  ║      ✅ 对账一致性校验                                      ║
  ║      ✅ 下一步行动指引                                      ║
  ║      ✅ 统一口径导出报表                                    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
