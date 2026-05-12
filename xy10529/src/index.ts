import express from 'express';
import { memberRouter } from './routes/memberRoutes';
import { benefitRouter } from './routes/benefitRoutes';
import { reportRouter } from './routes/reportRoutes';

const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '会员权益冻结 API',
    version: '1.0.0',
    description: '处理会员权益在退款、风控、过期和人工补偿之间的切换',
    endpoints: {
      member: {
        'POST /api/member/create': '创建会员',
        'GET /api/member/:memberId': '查询会员信息',
        'GET /api/member/:memberId/benefits': '查询会员所有权益'
      },
      benefit: {
        'POST /api/benefit/grant': '发放权益',
        'GET /api/benefit/:benefitId': '查询权益详情（含账本）',
        'POST /api/benefit/:benefitId/freeze': '冻结权益',
        'POST /api/benefit/:benefitId/unfreeze': '解冻权益',
        'POST /api/benefit/:benefitId/refund': '退款处理（永久冻结）',
        'POST /api/benefit/:benefitId/compensate': '人工补偿',
        'POST /api/benefit/:benefitId/correct': '人工修正'
      },
      report: {
        'GET /api/report/export': '导出报告（支持?format=csv）',
        'GET /api/report/all': '查看所有数据'
      }
    },
    examples: {
      normal: '正常使用流程: 创建会员 → 发放权益 → 查询权益',
      risk_control: '风控流程: 发放权益 → 风控冻结 → 解除冻结',
      refund: '退款流程: 发放权益 → 退款 → 尝试解冻（失败）',
      compensate: '补偿流程: 发放权益 → 冻结 → 补偿 → 解冻',
      idempotent: '幂等测试: 重复调用同一接口（相同requestId）'
    }
  });
});

app.use('/api/member', memberRouter);
app.use('/api/benefit', benefitRouter);
app.use('/api/report', reportRouter);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  会员权益冻结 API 已启动`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
