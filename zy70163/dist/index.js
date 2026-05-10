"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const index_1 = require("./database/index");
const routes_1 = __importDefault(require("./routes"));
const PORT = process.env.PORT || 3000;
const app = (0, express_1.default)();
app.use(express_1.default.json());
if (!fs_1.default.existsSync('./data')) {
    fs_1.default.mkdirSync('./data', { recursive: true });
}
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'object-storage-lifecycle-api',
        timestamp: new Date().toISOString()
    });
});
async function startServer() {
    try {
        await (0, index_1.initDatabase)();
        console.log('Database initialized successfully');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`API base: http://localhost:${PORT}/api`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
