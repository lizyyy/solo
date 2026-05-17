"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const correction_1 = __importDefault(require("./routes/correction"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'asset-tag-correction-api'
    });
});
app.use('/api/corrections', correction_1.default);
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '接口不存在',
        path: req.path
    });
});
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
app.listen(PORT, () => {
    console.log(`
=========================================
  资产标签纠错 API 服务已启动
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/health
  API 文档: /api/corrections
=========================================
  `);
});
//# sourceMappingURL=index.js.map