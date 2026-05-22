"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_1 = require("./middleware/upload");
const matchController_1 = require("./controllers/matchController");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    res.json({
        message: '公交客服中心 - 失物匹配系统 API',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            upload: 'POST /api/match/upload',
            history: 'GET /api/batch/history'
        }
    });
});
app.get('/health', matchController_1.matchController.healthCheck);
app.post('/api/match/upload', upload_1.upload.array('files', 10), matchController_1.matchController.uploadAndMatch);
app.get('/api/batch/history', matchController_1.matchController.getBatchHistory);
app.use((err, req, res, next) => {
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || '文件上传失败'
        });
    }
    next();
});
app.listen(PORT, () => {
    console.log(`失物匹配系统已启动: http://localhost:${PORT}`);
    console.log('');
    console.log('API 端点:');
    console.log(`  GET  http://localhost:${PORT}/health          - 健康检查`);
    console.log(`  POST http://localhost:${PORT}/api/match/upload - 上传文件并匹配`);
    console.log(`  GET  http://localhost:${PORT}/api/batch/history - 获取批次历史`);
    console.log('');
});
exports.default = app;
