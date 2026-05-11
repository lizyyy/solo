"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = require("./database");
const idempotency_1 = require("./middleware/idempotency");
const error_1 = require("./middleware/error");
const devices_1 = __importDefault(require("./routes/devices"));
const borrow_1 = __importDefault(require("./routes/borrow"));
const audit_1 = __importDefault(require("./routes/audit"));
const PORT = process.env.PORT || 3001;
const DATA_DIR = path_1.default.join(__dirname, '../../data');
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(idempotency_1.idempotencyMiddleware);
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString()
        },
        requestId: req.idempotency?.requestId || 'health-check',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/devices', devices_1.default);
app.use('/api/borrow', borrow_1.default);
app.use('/api/audit', audit_1.default);
app.use('*', error_1.notFoundHandler);
app.use(error_1.errorHandler);
async function startServer() {
    try {
        await (0, database_1.initDatabase)();
        setInterval(() => {
            (0, idempotency_1.cleanupExpiredIdempotentRequests)().catch(console.error);
        }, 60 * 60 * 1000);
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await (0, database_1.closeDatabase)();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await (0, database_1.closeDatabase)();
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map