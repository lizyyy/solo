"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./config/database");
const idempotency_1 = require("./middleware/idempotency");
const response_1 = require("./utils/response");
const backgroundTaskService_1 = require("./services/backgroundTaskService");
const samples_1 = __importDefault(require("./routes/samples"));
const reviewTasks_1 = __importDefault(require("./routes/reviewTasks"));
const trialFeedbacks_1 = __importDefault(require("./routes/trialFeedbacks"));
const finalization_1 = __importDefault(require("./routes/finalization"));
const export_1 = __importDefault(require("./routes/export"));
const history_1 = __importDefault(require("./routes/history"));
const backgroundTasks_1 = __importDefault(require("./routes/backgroundTasks"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});
app.use(idempotency_1.idempotencyMiddleware);
app.get('/health', (req, res) => {
    res.json((0, response_1.successResponse)({
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'sample-review-api'
    }, '服务正常运行'));
});
app.get('/api', (req, res) => {
    res.json((0, response_1.successResponse)({
        name: '采购样品评审 API',
        version: '1.0.0',
        description: '样品编号 -> 评审任务 -> 试用反馈 -> 定版冻结 -> 退样记录 -> 评审导出',
        endpoints: {
            samples: '/api/samples',
            reviewTasks: '/api/review-tasks',
            trialFeedbacks: '/api/trial-feedbacks',
            finalization: '/api/finalization',
            export: '/api/export',
            history: '/api/history',
            backgroundTasks: '/api/background-tasks'
        }
    }));
});
app.use('/api/samples', samples_1.default);
app.use('/api/review-tasks', reviewTasks_1.default);
app.use('/api/trial-feedbacks', trialFeedbacks_1.default);
app.use('/api/finalization', finalization_1.default);
app.use('/api/export', export_1.default);
app.use('/api/history', history_1.default);
app.use('/api/background-tasks', backgroundTasks_1.default);
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err instanceof response_1.AppError) {
        return res.status(err.statusCode).json((0, response_1.errorResponse)(err.message, err.errorCode));
    }
    res.status(500).json((0, response_1.errorResponse)('服务器内部错误'));
});
app.use((req, res) => {
    res.status(404).json((0, response_1.errorResponse)('接口不存在', 'NOT_FOUND'));
});
const cleanupInterval = setInterval(() => {
    try {
        (0, idempotency_1.cleanupExpiredKeys)();
    }
    catch (error) {
        console.error('Cleanup expired keys error:', error);
    }
}, 60 * 60 * 1000);
const gracefulShutdown = () => {
    console.log('\n收到关闭信号，正在优雅关闭服务...');
    (0, backgroundTaskService_1.stopTaskQueue)();
    clearInterval(cleanupInterval);
    setTimeout(() => {
        console.log('服务已关闭');
        process.exit(0);
    }, 1000);
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
const startServer = async () => {
    try {
        (0, database_1.initDatabase)();
        (0, backgroundTaskService_1.startTaskQueue)();
        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              采购样品评审 API 服务已启动                      ║
╠═══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                           ║
║  健康检查: http://localhost:${PORT}/health                     ║
║  API 文档: http://localhost:${PORT}/api                       ║
╠═══════════════════════════════════════════════════════════════╣
║  业务流程:                                                    ║
║    1. 创建样品 (CREATED)                                      ║
║    2. 确认寄送 (SHIPPED)                                      ║
║    3. 开始试用 (IN_TRIAL)                                     ║
║    4. 提交试用反馈 -> 等待评审 (PENDING_REVIEW)               ║
║    5. 创建评审任务                                            ║
║    6. 完成评审 -> 评审完成 (REVIEWED)                         ║
║    7. 定版冻结 (FINALIZED) 或 退样 (RETURNED)                ║
╠═══════════════════════════════════════════════════════════════╣
║  数据一致性保障:                                              ║
║    - 幂等性支持: Header x-idempotency-key                     ║
║    - 状态转换校验: 严格的状态流转规则                         ║
║    - 历史记录追踪: 所有操作均有日志                           ║
║    - 数量金额校验: 不允许负数                                 ║
╠═══════════════════════════════════════════════════════════════╣
║  后台任务:                                                    ║
║    - 状态: 运行中                                             ║
║    - 轮询间隔: 5秒                                            ║
║    - 重试延迟: 30秒                                           ║
║    - 最大重试: 3次                                            ║
╚═══════════════════════════════════════════════════════════════╝
      `);
        });
    }
    catch (error) {
        console.error('启动服务失败:', error);
        process.exit(1);
    }
};
startServer();
