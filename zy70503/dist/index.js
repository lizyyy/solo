"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const leaseRoutes_1 = __importDefault(require("./routes/leaseRoutes"));
const leaseService_1 = require("./services/leaseService");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', leaseRoutes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'permission-lease-api'
    });
});
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误'
    });
});
let expirationCheckInterval;
function startExpirationCheck() {
    expirationCheckInterval = setInterval(async () => {
        console.log(`[${new Date().toISOString()}] Checking for expired leases...`);
        try {
            const result = await leaseService_1.leaseService.handleExpiredLeases();
            if (result.processedCount && result.processedCount > 0) {
                console.log(`[${new Date().toISOString()}] Processed ${result.processedCount} expired leases`);
            }
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error checking expired leases:`, error);
        }
    }, 5 * 60 * 1000);
}
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║       权限租约 API 服务已启动                                 ║
║       Permission Lease API Service Started                   ║
║                                                              ║
║       服务地址: http://localhost:${PORT}                      ║
║       健康检查: http://localhost:${PORT}/health               ║
║                                                              ║
║       API 接口前缀: /api                                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
    startExpirationCheck();
});
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    clearInterval(expirationCheckInterval);
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    clearInterval(expirationCheckInterval);
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=index.js.map