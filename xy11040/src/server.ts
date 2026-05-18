import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import processingOrdersRouter from './routes/processingOrders';
import reworkReportsRouter from './routes/reworkReports';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initSampleData } from './scripts/initData';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '眼镜店镜片加工返工API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/processing-orders', processingOrdersRouter);
app.use('/api/rework-reports', reworkReportsRouter);

app.get('/api/demo', (req, res) => {
  const demoData = initSampleData();
  res.json({
    success: true,
    message: '演示数据已初始化完成，以下是眼镜店镜片加工返工完整链路演示',
    data: demoData
  });
});

app.get('/api/workflow', (req, res) => {
  res.json({
    success: true,
    message: '眼镜店镜片加工返工完整工作流说明',
    processingOrderWorkflow: [
      { status: 'pending', description: '待处理 - 加工单已创建，等待开始生产' },
      { status: 'in_production', description: '生产中 - 正在进行镜片加工' },
      { status: 'quality_check', description: '质检中 - 加工完成，等待质量检验' },
      { status: 'rework_requested', description: '返工申请 - 质检不通过，申请返工' },
      { status: 'completed', description: '已完成 - 质检通过或返工完成最终检验通过' },
      { status: 'cancelled', description: '已取消 - 加工单被取消' }
    ],
    reworkReportWorkflow: [
      { status: 'submitted', description: '已提交 - 返工报告已创建' },
      { status: 'reviewing', description: '审核中 - 主管正在审核返工申请' },
      { status: 'approved', description: '已批准 - 返工申请已批准' },
      { status: 'rejected', description: '已拒绝 - 返工申请被拒绝' },
      { status: 'in_rework', description: '返工中 - 正在进行返工处理' },
      { status: 'rework_completed', description: '返工完成 - 返工处理已完成' },
      { status: 'final_inspection', description: '最终检验 - 等待最终质检' },
      { status: 'closed', description: '已结案 - 返工流程完成' }
    ],
    axisSyncFeature: {
      description: '散光轴位一致性校验',
      purpose: '确保返工报告中的轴位修正与加工单保持一致',
      endpoints: [
        'GET /api/rework-reports/:id/axis-issues - 获取轴位不一致问题',
        'POST /api/rework-reports/:id/sync-axis - 同步轴位到加工单'
      ]
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const initData = process.env.INIT_DATA !== 'false';
if (initData) {
  initSampleData();
  console.log('✅ 样例数据已初始化');
}

app.listen(PORT, () => {
  console.log(`\n🚀 眼镜店镜片加工返工API服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📋 健康检查: http://localhost:${PORT}/health`);
  console.log(`🎬 演示数据: http://localhost:${PORT}/api/demo`);
  console.log(`📖 工作流说明: http://localhost:${PORT}/api/workflow`);
  console.log(`\n📦 API 端点:`);
  console.log(`   - POST   /api/processing-orders - 创建加工单`);
  console.log(`   - GET    /api/processing-orders - 获取所有加工单`);
  console.log(`   - GET    /api/processing-orders/:id - 获取单个加工单`);
  console.log(`   - PATCH  /api/processing-orders/:id/status - 更新加工单状态`);
  console.log(`   - POST   /api/rework-reports - 创建返工报告`);
  console.log(`   - GET    /api/rework-reports - 获取所有返工报告`);
  console.log(`   - GET    /api/rework-reports/:id - 获取单个返工报告`);
  console.log(`   - PATCH  /api/rework-reports/:id/status - 更新返工状态`);
  console.log(`   - GET    /api/rework-reports/:id/axis-issues - 获取轴位不一致问题`);
  console.log(`   - POST   /api/rework-reports/:id/sync-axis - 同步轴位到加工单`);
  console.log(`\n`);
});

export default app;
