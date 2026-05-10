"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
require("reflect-metadata");
const database_1 = require("./database");
const vulnerabilities_1 = require("./routes/vulnerabilities");
const batches_1 = require("./routes/batches");
const delays_1 = require("./routes/delays");
const risks_1 = require("./routes/risks");
const logger_1 = require("./logger");
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 3000;
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    logger_1.logger.info(`HTTP ${req.method} ${req.path}`, {
        query: req.query,
        body: Object.keys(req.body).length > 0 ? '***' : undefined
    });
    next();
});
app.use('/api/vulnerabilities', (0, vulnerabilities_1.vulnerabilityRouter)());
app.use('/api/batches', (0, batches_1.batchRouter)());
app.use('/api/delays', (0, delays_1.delayRouter)());
app.use('/api/risks', (0, risks_1.riskRouter)());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (req, res) => {
    res.json({
        name: '依赖漏洞修复排期 API',
        version: '1.0.0',
        endpoints: {
            vulnerabilities: '/api/vulnerabilities',
            batches: '/api/batches',
            delays: '/api/delays',
            risks: '/api/risks'
        }
    });
});
app.use((err, req, res, next) => {
    logger_1.logger.error('未处理的异常', { error: err.message, stack: err.stack });
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
async function startServer() {
    try {
        await (0, database_1.initializeDatabase)();
        logger_1.logger.info('数据库初始化成功');
        app.listen(PORT, () => {
            logger_1.logger.info(`服务器启动成功，监听端口 ${PORT}`);
            logger_1.logger.info(`健康检查: http://localhost:${PORT}/health`);
            logger_1.logger.info(`API 根路径: http://localhost:${PORT}/api`);
        });
    }
    catch (error) {
        logger_1.logger.error('服务器启动失败', { error: error.message });
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
//# sourceMappingURL=index.js.map