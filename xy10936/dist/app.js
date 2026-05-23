"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const express_1 = __importDefault(require("express"));
const init_1 = require("./database/init");
const customers_1 = __importDefault(require("./routes/customers"));
const categories_1 = __importDefault(require("./routes/categories"));
const weighing_1 = __importDefault(require("./routes/weighing"));
const settlement_1 = __importDefault(require("./routes/settlement"));
const exceptions_1 = __importDefault(require("./routes/exceptions"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use('/api/customers', customers_1.default);
app.use('/api/categories', categories_1.default);
app.use('/api/weighing', weighing_1.default);
app.use('/api/settlement', settlement_1.default);
app.use('/api/exceptions', exceptions_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '废品回收称重 API 服务运行正常' });
});
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
});
const startServer = async () => {
    try {
        await (0, init_1.initDatabase)();
        console.log('数据库初始化完成');
        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`  废品回收称重 API 服务已启动`);
            console.log(`  运行端口: ${PORT}`);
            console.log(`  健康检查: http://localhost:${PORT}/api/health`);
            console.log(`========================================\n`);
        });
    }
    catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
};
exports.startServer = startServer;
exports.default = app;
