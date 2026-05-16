"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const init_1 = require("./database/init");
const warmupRoutes_1 = __importDefault(require("./routes/warmupRoutes"));
const healthCheck_1 = require("./utils/healthCheck");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api/v1/warmup', warmupRoutes_1.default);
app.get('/health', async (req, res) => {
    const healthStatus = await healthCheck_1.HealthCheck.performCheck();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
});
app.get('/', (req, res) => {
    res.json({
        name: 'Cache Warmup Orchestration API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            batches: '/api/v1/warmup/batches',
            nodes: '/api/v1/warmup/nodes',
            dataSources: '/api/v1/warmup/data-sources'
        }
    });
});
const startServer = async () => {
    try {
        await (0, init_1.initDatabase)();
        console.log('Database initialized successfully');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`API base: http://localhost:${PORT}/api/v1/warmup`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
