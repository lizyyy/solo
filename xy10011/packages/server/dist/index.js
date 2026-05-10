"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./database");
const bills_1 = __importDefault(require("./routes/bills"));
const groups_1 = __importDefault(require("./routes/groups"));
const reports_1 = __importDefault(require("./routes/reports"));
const events_1 = __importDefault(require("./routes/events"));
const users_1 = __importDefault(require("./routes/users"));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
async function main() {
    const app = (0, express_1.default)();
    (0, database_1.initDatabase)();
    app.use((0, cors_1.default)({
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use((req, res, next) => {
        if (!req.headers['x-correlation-id']) {
            req.headers['x-correlation-id'] = `corr-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        }
        next();
    });
    app.use('/api/users', users_1.default);
    app.use('/api/bills', bills_1.default);
    app.use('/api/groups', groups_1.default);
    app.use('/api/reports', reports_1.default);
    app.use('/api/events', events_1.default);
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: Date.now(),
            correlationId: req.headers['x-correlation-id'],
        });
    });
    app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).json({
            error: 'Internal server error',
            correlationId: req.headers['x-correlation-id'],
        });
    });
    app.listen(PORT, () => {
        console.log(`Bill Split System server running on port ${PORT}`);
        console.log(`API endpoints:
  - GET  /api/health
  - POST /api/users/get-or-create
  - GET  /api/users
  - GET  /api/users/:id
  - PUT  /api/users/:id
  - POST /api/bills
  - PUT  /api/bills/:id
  - GET  /api/bills/group/:groupId
  - GET  /api/bills/:id
  - GET  /api/bills/group/:groupId/balances
  - POST /api/groups
  - PUT  /api/groups/:id
  - GET  /api/groups/user/:userId
  - GET  /api/groups/:id
  - POST /api/reports/export
  - GET  /api/events/aggregate/:id
  - GET  /api/events/user/:userId
  - POST /api/events/sync
  - GET  /api/events/sync/state
  - POST /api/events/replay/:aggregateId
  - GET  /api/events/conflicts
  - POST /api/events/conflicts/:id/resolve`);
    });
}
main().catch(console.error);
