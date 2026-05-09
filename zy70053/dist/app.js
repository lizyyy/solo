"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const helper_1 = require("./database/helper");
const creditService_1 = require("./services/creditService");
const withdrawalService_1 = require("./services/withdrawalService");
const repaymentService_1 = require("./services/repaymentService");
const freezeService_1 = require("./services/freezeService");
const snapshotService_1 = require("./services/snapshotService");
const creditRoutes_1 = require("./routes/creditRoutes");
const withdrawalRoutes_1 = require("./routes/withdrawalRoutes");
const repaymentRoutes_1 = require("./routes/repaymentRoutes");
const freezeRoutes_1 = require("./routes/freezeRoutes");
const snapshotRoutes_1 = require("./routes/snapshotRoutes");
const jobService_1 = require("./background/jobService");
function createApp(dbPath) {
    const db = new helper_1.DatabaseHelper(dbPath);
    const creditService = new creditService_1.CreditService(db);
    const withdrawalService = new withdrawalService_1.WithdrawalService(db, creditService);
    const repaymentService = new repaymentService_1.RepaymentService(db, creditService, withdrawalService);
    const freezeService = new freezeService_1.FreezeService(db, creditService);
    const snapshotService = new snapshotService_1.SnapshotService(db, creditService);
    const jobService = new jobService_1.BackgroundJobService(db, snapshotService);
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/credit', (0, creditRoutes_1.createCreditRouter)(creditService));
    app.use('/api/withdrawals', (0, withdrawalRoutes_1.createWithdrawalRouter)(withdrawalService));
    app.use('/api/repayments', (0, repaymentRoutes_1.createRepaymentRouter)(repaymentService));
    app.use('/api/freeze', (0, freezeRoutes_1.createFreezeRouter)(freezeService));
    app.use('/api/snapshots', (0, snapshotRoutes_1.createSnapshotRouter)(snapshotService));
    app.get('/health', (req, res) => {
        res.json({
            success: true,
            message: '集团授信共享额度 API 服务运行正常'
        });
    });
    app.get('/api/jobs/trigger', async (req, res) => {
        try {
            const result = await jobService.runPendingJobs();
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : '执行任务失败'
            });
        }
    });
    app.post('/api/jobs/snapshot', async (req, res) => {
        try {
            const { groupCreditId } = req.body;
            const job = await jobService.createSnapshotJob(groupCreditId);
            res.status(201).json({
                success: true,
                data: job
            });
        }
        catch (error) {
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
