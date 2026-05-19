"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const reservation_1 = __importDefault(require("./routes/reservation"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const admin_1 = __importDefault(require("./routes/admin"));
const db_1 = require("./database/db");
const StateMachineService_1 = require("./services/StateMachineService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
const TIMEOUT_SCAN_INTERVAL = process.env.TIMEOUT_SCAN_INTERVAL
    ? parseInt(process.env.TIMEOUT_SCAN_INTERVAL)
    : 60000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/reservations', reservation_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/admin', admin_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        autoTimeoutScan: 'enabled',
        scanIntervalMs: TIMEOUT_SCAN_INTERVAL
    });
});
let timeoutScanInterval = null;
function startTimeoutScanner() {
    const stateMachineService = new StateMachineService_1.StateMachineService();
    console.log(`Starting automatic timeout scanner (interval: ${TIMEOUT_SCAN_INTERVAL}ms)`);
    timeoutScanInterval = setInterval(async () => {
        try {
            const processedCount = await stateMachineService.processTimeoutTasks();
            if (processedCount > 0) {
                console.log(`[${new Date().toISOString()}] Auto timeout scanner processed ${processedCount} expired reservations`);
            }
        }
        catch (error) {
            console.error('Error in timeout scanner:', error);
        }
    }, TIMEOUT_SCAN_INTERVAL);
}
function stopTimeoutScanner() {
    if (timeoutScanInterval) {
        clearInterval(timeoutScanInterval);
        timeoutScanInterval = null;
        console.log('Timeout scanner stopped');
    }
}
const server = app.listen(PORT, async () => {
    console.log(`Inventory Reservation State Machine running on port ${PORT}`);
    try {
        await (0, db_1.getDb)();
        console.log('Database connected successfully');
        startTimeoutScanner();
    }
    catch (error) {
        console.error('Database connection failed:', error);
    }
});
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    stopTimeoutScanner();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    stopTimeoutScanner();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
exports.default = app;
