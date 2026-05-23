"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const init_1 = require("./database/init");
const batches_1 = __importDefault(require("./routes/batches"));
const finance_1 = __importDefault(require("./routes/finance"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
app.use('/api/batches', batches_1.default);
app.use('/api/finance', finance_1.default);
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'equipment-return-state-machine'
        }
    });
});
app.get('/api/exports/:filename', (req, res) => {
    const exportDir = path_1.default.join(__dirname, '../exports');
    const filePath = path_1.default.join(exportDir, req.params.filename);
    if (fs_1.default.existsSync(filePath) && filePath.endsWith('.csv')) {
        res.download(filePath);
    }
    else {
        res.status(404).json({ success: false, error: '文件不存在' });
    }
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: err.message
    });
});
async function startServer() {
    try {
        const dataDir = path_1.default.join(__dirname, '../data');
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        await (0, init_1.initializeDB)();
        console.log('Database initialized successfully');
        app.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   设备租赁归还异常回执状态机 API 服务已启动                ║
║                                                           ║
║   服务地址: http://localhost:${PORT}                        ║
║   健康检查: http://localhost:${PORT}/api/health             ║
║                                                           ║
║   API 端点:                                               ║
║     POST   /api/batches              - 创建批次            ║
║     GET    /api/batches              - 批次列表            ║
║     GET    /api/batches/:id          - 批次详情            ║
║     POST   /api/batches/:id/transition - 状态转换          ║
║     POST   /api/batches/:id/attachments - 上传附件         ║
║     GET    /api/batches/:id/history  - 操作历史            ║
║     POST   /api/batches/export       - 导出批次列表        ║
║                                                           ║
║     GET    /api/finance/summary      - 财务汇总            ║
║     GET    /api/finance/failed-records - 失败记录          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map