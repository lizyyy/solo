import express, { Application, Request, Response } from 'express';
import { DatabaseHelper } from './database/helper';
import { CreditService } from './services/creditService';
import { WithdrawalService } from './services/withdrawalService';
import { RepaymentService } from './services/repaymentService';
import { FreezeService } from './services/freezeService';
import { SnapshotService } from './services/snapshotService';
import { createCreditRouter } from './routes/creditRoutes';
import { createWithdrawalRouter } from './routes/withdrawalRoutes';
import { createRepaymentRouter } from './routes/repaymentRoutes';
import { createFreezeRouter } from './routes/freezeRoutes';
import { createSnapshotRouter } from './routes/snapshotRoutes';
import { BackgroundJobService } from './background/jobService';

export function createApp(dbPath?: string): {
  app: Application;
  db: DatabaseHelper;
  services: {
    creditService: CreditService;
    withdrawalService: WithdrawalService;
    repaymentService: RepaymentService;
    freezeService: FreezeService;
    snapshotService: SnapshotService;
    jobService: BackgroundJobService;
  };
} {
  const db = new DatabaseHelper(dbPath);
  
  const creditService = new CreditService(db);
  const withdrawalService = new WithdrawalService(db, creditService);
  const repaymentService = new RepaymentService(db, creditService, withdrawalService);
  const freezeService = new FreezeService(db, creditService);
  const snapshotService = new SnapshotService(db, creditService);
  const jobService = new BackgroundJobService(db, snapshotService);

  const app: Application = express();

  app.use(express.json());

  app.use('/api/credit', createCreditRouter(creditService));
  app.use('/api/withdrawals', createWithdrawalRouter(withdrawalService));
  app.use('/api/repayments', createRepaymentRouter(repaymentService));
  app.use('/api/freeze', createFreezeRouter(freezeService));
  app.use('/api/snapshots', createSnapshotRouter(snapshotService));

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: '集团授信共享额度 API 服务运行正常'
    });
  });

  app.get('/api/jobs/trigger', async (req: Request, res: Response) => {
    try {
      const result = await jobService.runPendingJobs();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '执行任务失败'
      });
    }
  });

  app.post('/api/jobs/snapshot', async (req: Request, res: Response) => {
    try {
      const { groupCreditId } = req.body;
      const job = await jobService.createSnapshotJob(groupCreditId);
      res.status(201).json({
        success: true,
        data: job
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建快照任务失败'
      });
    }
  });

  return {
    app,
    db,
    services: {
      creditService,
      withdrawalService,
      repaymentService,
      freezeService,
      snapshotService,
      jobService
    }
  };
}

if (require.main === module) {
  const { app, services: { jobService } } = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.listen(PORT, () => {
    console.log(`集团授信共享额度 API 服务已启动，端口: ${PORT}`);
  });

  jobService.startScheduler();
}
