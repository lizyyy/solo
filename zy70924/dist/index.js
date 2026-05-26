"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./database");
const batches_1 = __importDefault(require("./routes/batches"));
const processing_1 = __importDefault(require("./routes/processing"));
const certificates_1 = __importDefault(require("./routes/certificates"));
const query_1 = __importDefault(require("./routes/query"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api/batches', batches_1.default);
app.use('/api/processing', processing_1.default);
app.use('/api/certificates', certificates_1.default);
app.use('/api/query', query_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
const start = async () => {
    try {
        await (0, database_1.initDatabase)();
        app.listen(PORT, () => {
            console.log(`培训运营服务已启动: http://localhost:${PORT}`);
            console.log('健康检查: GET /api/health');
        });
    }
    catch (err) {
        console.error('启动失败:', err);
        process.exit(1);
    }
};
start();
