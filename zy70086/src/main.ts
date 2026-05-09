import 'reflect-metadata';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { initDatabase } from './database/data-source';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { BinEventService } from './services/bin-event.service';
import { BizResponse } from './utils/biz-response';
import { DispatchService } from './services/dispatch.service';
import { RouteService } from './services/route.service';
import { ReceiptService } from './services/receipt.service';
import { StatisticsService } from './services/statistics.service';
import { BackgroundJobService, JobType } from './services/background-job.service';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const binEventService = new BinEventService();
const dispatchService = new DispatchService();
const routeService = new RouteService();
const receiptService = new ReceiptService();
const statisticsService = new StatisticsService();
const jobService = new BackgroundJobService();

function sendResponse(res: express.Response, response: BizResponse) {
  const statusCode = response.success ? 200 : 400;
  res.status(statusCode).json(response);
}

function genRequestId(): string {
  return uuidv4();
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '垃圾分类清运调度服务 - 欢迎使用',
    service: 'waste-schedule-service',
    version: '1.0.0',
    endpoints: {
      '桶点管理': {
        '上报事件': 'POST /api/bin-events/report',
        '查询事件': 'GET /api/bin-events',
        '处理事件': 'POST /api/bin-events/:id/resolve',
      },
      '车辆调度': {
        '创建调度': 'POST /api/dispatches',
        '确认调度': 'POST /api/dispatches/:id/confirm',
        '完成调度': 'POST /api/dispatches/:id/complete',
        '查询调度': 'GET /api/dispatches',
      },
      '路线执行': {
        '到达路线点': 'POST /api/routes/:id/arrive',
        '清运路线点': 'POST /api/routes/:id/collect',
        '跳过路线点': 'POST /api/routes/:id/skip',
        '查询路线': 'GET /api/dispatches/:id/routes',
      },
      '清运回执': {
        '提交回执': 'POST /api/receipts',
        '核实回执': 'POST /api/receipts/:id/verify',
        '结算回执': 'POST /api/receipts/:id/settle',
        '查询回执': 'GET /api/receipts',
      },
      '统计报表': {
        '今日概览': 'GET /api/statistics/today',
        '历史统计': 'GET /api/statistics/range',
      },
      '后台任务': {
        '查看死信任务': 'GET /api/jobs/dead',
        '重试死信任务': 'POST /api/jobs/:id/retry',
      },
    },
    tips: [
      '所有写操作都需要传 requestId（建议用 UUID）保证幂等',
      '业务状态码全部用中文，方便非技术人员理解',
      '后台任务每 30 秒扫描一次，失败自动重试最多 3 次',
    ],
  });
});

app.post('/api/bin-events/report', async (req, res) => {
  const body = req.body;
  if (!body.requestId) body.requestId = genRequestId();
  
  const result = await binEventService.reportEvent(body);
  sendResponse(res, result);
});

app.get('/api/bin-events', async (req, res) => {
  const { binId, status, limit } = req.query;
  const result = await binEventService.getEvents(
    binId as string,
    status as any,
    limit ? parseInt(limit as string) : 20,
  );
  sendResponse(res, result);
});

app.post('/api/bin-events/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { handler, remark } = req.body;
  const result = await binEventService.resolveEvent(id, handler || '系统管理员', remark);
  sendResponse(res, result);
});

app.post('/api/dispatches', async (req, res) => {
  const body = req.body;
  if (!body.requestId) body.requestId = genRequestId();
  if (!body.dispatchDate) body.dispatchDate = dayjs().format('YYYY-MM-DD');
  
  const result = await dispatchService.createDispatch(body);
  sendResponse(res, result);
});

app.post('/api/dispatches/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { driver, requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await dispatchService.confirmDispatch(id, rid, driver || '司机');
  sendResponse(res, result);
});

app.post('/api/dispatches/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await dispatchService.completeDispatch(id, rid);
  sendResponse(res, result);
});

app.get('/api/dispatches', async (req, res) => {
  const { status, date, limit } = req.query;
  const result = await dispatchService.getDispatches(
    status as any,
    date as string,
    limit ? parseInt(limit as string) : 20,
  );
  sendResponse(res, result);
});

app.get('/api/dispatches/:id/routes', async (req, res) => {
  const { id } = req.params;
  const result = await routeService.getRoutesByDispatch(id);
  sendResponse(res, result);
});

app.post('/api/routes/:id/arrive', async (req, res) => {
  const { id } = req.params;
  const { fillLevel, requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await routeService.arriveAtPoint(id, rid, fillLevel);
  sendResponse(res, result);
});

app.post('/api/routes/:id/collect', async (req, res) => {
  const { id } = req.params;
  const { weight, photoUrls, driverRemark, requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await routeService.collectPoint(id, rid, {
    weight,
    photoUrls,
    driverRemark,
  });
  sendResponse(res, result);
});

app.post('/api/routes/:id/skip', async (req, res) => {
  const { id } = req.params;
  const { reason, requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await routeService.skipPoint(id, rid, reason || '临时跳过');
  sendResponse(res, result);
});

app.post('/api/receipts', async (req, res) => {
  const body = req.body;
  if (!body.requestId) body.requestId = genRequestId();
  
  const result = await receiptService.createReceipt(body);
  sendResponse(res, result);
});

app.post('/api/receipts/:id/verify', async (req, res) => {
  const { id } = req.params;
  const { verifier, approved, remark, requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await receiptService.verifyReceipt(id, rid, {
    verifier: verifier || '运营人员',
    approved: approved !== false,
    remark,
  });
  sendResponse(res, result);
});

app.post('/api/receipts/:id/settle', async (req, res) => {
  const { id } = req.params;
  const { settler, requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await receiptService.settleReceipt(id, rid, settler || '财务人员');
  sendResponse(res, result);
});

app.get('/api/receipts', async (req, res) => {
  const { status, date, limit } = req.query;
  const result = await receiptService.getReceipts(
    status as any,
    date as string,
    limit ? parseInt(limit as string) : 20,
  );
  sendResponse(res, result);
});

app.get('/api/statistics/today', async (req, res) => {
  const result = await statisticsService.getTodayOverview();
  sendResponse(res, result);
});

app.get('/api/statistics/range', async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await statisticsService.getRangeStatistics(
    startDate as string,
    endDate as string,
  );
  sendResponse(res, result);
});

app.post('/api/statistics/refresh', async (req, res) => {
  const { requestId } = req.body;
  const rid = requestId || genRequestId();
  
  const result = await statisticsService.refreshTodayStats(rid);
  sendResponse(res, result);
});

app.get('/api/jobs/dead', async (req, res) => {
  const { limit } = req.query;
  const result = await jobService.getDeadJobs(limit ? parseInt(limit as string) : 50);
  res.json({
    success: true,
    message: `查询到 ${result.length} 个死亡任务`,
    data: result.map((j) => ({
      jobId: j.id,
      jobType: j.jobType,
      status: j.status,
      attemptCount: j.attemptCount,
      maxAttempts: j.maxAttempts,
      lastError: j.lastError,
      createdAt: j.createdAt,
      relatedBizType: j.relatedBizType,
      relatedBizId: j.relatedBizId,
    })),
  });
});

app.post('/api/jobs/:id/retry', async (req, res) => {
  const { id } = req.params;
  try {
    const job = await jobService.retryDeadJob(id);
    res.json({
      success: true,
      message: `任务已重置，将立即重新执行`,
      data: {
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        nextRunAt: job.nextRunAt,
      },
    });
  } catch (e: any) {
    res.status(400).json({
      success: false,
      message: e.message || '重试失败',
      code: 'RETRY_FAILED',
    });
  }
});

async function startServer() {
  try {
    await initDatabase();
    console.log('垃圾分类清运调度服务启动中...');
    console.log('  - 数据库: SQLite (data/waste.db)');
    console.log('  - 端口: ' + PORT);
    
    app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('  垃圾分类清运调度服务 已启动 ✓');
      console.log('========================================');
      console.log(`\n  服务地址: http://localhost:${PORT}`);
      console.log(`  欢迎页:   http://localhost:${PORT}/`);
      console.log('\n  启动后台任务处理请运行:');
      console.log('    npm run task:worker');
      console.log('\n  初始化测试数据请运行:');
      console.log('    npm run seed');
      console.log('\n========================================\n');
    });
  } catch (e) {
    console.error('服务启动失败:', e);
    process.exit(1);
  }
}

startServer();
