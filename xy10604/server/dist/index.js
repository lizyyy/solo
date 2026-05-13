"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const reagents_1 = __importDefault(require("./routes/reagents"));
const batches_1 = __importDefault(require("./routes/batches"));
const openRecords_1 = __importDefault(require("./routes/openRecords"));
const experiments_1 = __importDefault(require("./routes/experiments"));
const blocks_1 = __importDefault(require("./routes/blocks"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const discards_1 = __importDefault(require("./routes/discards"));
const audit_1 = __importDefault(require("./routes/audit"));
const exports_1 = __importDefault(require("./routes/exports"));
const errorHandler_1 = require("./middlewares/errorHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', auth_1.default);
app.use('/api/reagents', reagents_1.default);
app.use('/api/batches', batches_1.default);
app.use('/api/open-records', openRecords_1.default);
app.use('/api/experiments', experiments_1.default);
app.use('/api/blocks', blocks_1.default);
app.use('/api/reviews', reviews_1.default);
app.use('/api/discards', discards_1.default);
app.use('/api/audit', audit_1.default);
app.use('/api/exports', exports_1.default);
app.use(errorHandler_1.errorHandler);
const server = http_1.default.createServer(app);
async function startServer() {
    try {
        await database_1.prisma.$connect();
        console.log('✅ 数据库连接成功');
        server.listen(PORT, () => {
            console.log(`🚀 服务器运行在端口 ${PORT}`);
        });
    }
    catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', async () => {
    console.log('SIGTERM 信号接收，正在优雅关闭...');
    server.close(() => {
        database_1.prisma.$disconnect();
        process.exit(0);
    });
});
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map