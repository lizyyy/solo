import express from 'express';
import bodyParser from 'body-parser';
import { RentRescheduleService } from './rentRescheduleService';
import { RescheduleRequest } from './types';

const app = express();
const port = 3000;

app.use(bodyParser.json());

const service = new RentRescheduleService();

app.get('/', (req, res) => {
  res.json({
    message: '融资租赁租金重排服务',
    version: '1.0.0',
    endpoints: {
      'GET /contracts': '获取所有合同列表',
      'GET /contracts/:id': '获取单个合同详情',
      'GET /contracts/:id/plan': '获取当前租金计划',
      'GET /contracts/:id/payments': '获取还款流水',
      'GET /contracts/:id/invoices': '获取发票信息',
      'POST /reschedule': '提交租金重排请求（处理）',
      'GET /reschedule': '获取所有重排结果列表',
      'GET /reschedule/:id': '获取重排结果详情',
      'POST /reschedule/:id/review': '复核重排结果',
      'GET /reschedule/:id/export': '导出重排数据',
    },
  });
});

app.get('/contracts', (req, res) => {
  try {
    const contracts = service.getAllContracts();
    res.json({ success: true, data: contracts });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/contracts/:id', (req, res) => {
  try {
    const contract = service.getContract(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }
    res.json({ success: true, data: contract });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/contracts/:id/plan', (req, res) => {
  try {
    const plan = service.getActiveRentPlan(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, error: '租金计划不存在' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/contracts/:id/payments', (req, res) => {
  try {
    const payments = service.getPaymentFlows(req.params.id);
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/contracts/:id/invoices', (req, res) => {
  try {
    const invoices = service.getInvoices(req.params.id);
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/reschedule', (req, res) => {
  try {
    const request: RescheduleRequest = {
      ...req.body,
      requestedAt: new Date().toISOString(),
    };
    const result = service.processReschedule(request);
    res.json({
      success: true,
      message: '租金重排处理完成',
      data: {
        resultId: result.id,
        status: result.status,
        adjustmentCount: result.adjustments.length,
        inconsistencyCount: result.inconsistencies.length,
        calculationSteps: result.calculationDetails.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/reschedule', (req, res) => {
  try {
    const contractId = req.query.contractId as string;
    const results = service.getAllRescheduleResults(contractId);
    res.json({
      success: true,
      data: results.map(r => ({
        id: r.id,
        contractId: r.contractId,
        status: r.status,
        processedBy: r.processedBy,
        processedAt: r.processedAt,
        adjustmentCount: r.adjustments.length,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/reschedule/:id', (req, res) => {
  try {
    const result = service.getRescheduleResult(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: '重排结果不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/reschedule/:id/review', (req, res) => {
  try {
    const { reviewedBy, comments, approved } = req.body;
    if (!reviewedBy) {
      return res.status(400).json({ success: false, error: '缺少复核人信息' });
    }
    const result = service.reviewReschedule(req.params.id, reviewedBy, comments || '', approved !== false);
    res.json({
      success: true,
      message: approved !== false ? '复核通过，新租金计划已生效' : '复核驳回',
      data: {
        id: result.id,
        status: result.status,
        reviewedBy: result.reviewedBy,
        reviewedAt: result.reviewedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/reschedule/:id/export', (req, res) => {
  try {
    const exportedBy = (req.query.exportedBy as string) || 'system';
    const exportResult = service.exportRescheduleData(req.params.id, exportedBy);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.json(exportResult.data);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export const startServer = () => {
  app.listen(port, () => {
    console.log(`\n🚀 融资租赁租金重排服务已启动`);
    console.log(`📍 服务地址: http://localhost:${port}`);
    console.log(`\n📋 可用接口:`);
    console.log(`   GET  /                           - 服务信息`);
    console.log(`   GET  /contracts                  - 合同列表`);
    console.log(`   GET  /contracts/:id              - 合同详情`);
    console.log(`   GET  /contracts/:id/plan         - 租金计划`);
    console.log(`   GET  /contracts/:id/payments     - 还款流水`);
    console.log(`   GET  /contracts/:id/invoices     - 发票信息`);
    console.log(`   POST /reschedule                 - 处理租金重排`);
    console.log(`   GET  /reschedule                 - 重排结果列表`);
    console.log(`   GET  /reschedule/:id             - 重排结果详情`);
    console.log(`   POST /reschedule/:id/review      - 复核重排结果`);
    console.log(`   GET  /reschedule/:id/export      - 导出数据`);
    console.log(`\n💡 测试示例数据: contract_001`);
    console.log(`\n`);
  });
};
