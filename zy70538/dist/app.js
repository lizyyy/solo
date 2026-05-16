"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cacheExplanationRoutes_1 = __importDefault(require("./routes/cacheExplanationRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'API结果缓存解释服务运行正常',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
app.use('/api/v1/cache-explanations', cacheExplanationRoutes_1.default);
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`
=============================================
  API结果缓存解释服务已启动
  端口: ${PORT}
  环境: ${process.env.NODE_ENV || 'development'}
  健康检查: http://localhost:${PORT}/health
=============================================
  `);
});
exports.default = app;
//# sourceMappingURL=app.js.map