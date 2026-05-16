"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cancelRequest_1 = __importDefault(require("./routes/cancelRequest"));
const types_1 = require("./types");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
});
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'async-job-cancel-api'
    });
});
app.get('/api/constants', (req, res) => {
    res.json({
        cancelRequestStatus: types_1.CancelRequestStatus,
        taskExecutionStatus: types_1.TaskExecutionStatus,
        retainResultPolicy: types_1.RetainResultPolicy
    });
});
app.use('/api/cancel-requests', cancelRequest_1.default);
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});
app.use((err, req, res) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        Async Job Cancel API                                  ║
║        异步作业撤销API - 内部使用                            ║
║                                                              ║
║        Server running on http://localhost:${PORT}             ║
║                                                              ║
║        Health Check:  GET  /health                           ║
║        Constants:     GET  /api/constants                    ║
║        API Base:      /api/cancel-requests                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
exports.default = app;
//# sourceMappingURL=index.js.map