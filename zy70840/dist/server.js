"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("./database"));
const batches_1 = __importDefault(require("./routes/batches"));
const applications_1 = __importDefault(require("./routes/applications"));
const certificates_1 = __importDefault(require("./routes/certificates"));
const schedules_1 = __importDefault(require("./routes/schedules"));
const deposits_1 = __importDefault(require("./routes/deposits"));
const exports_1 = __importDefault(require("./routes/exports"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/batches', batches_1.default);
app.use('/api/applications', applications_1.default);
app.use('/api/certificates', certificates_1.default);
app.use('/api/schedules', schedules_1.default);
app.use('/api/deposits', deposits_1.default);
app.use('/api/exports', exports_1.default);
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '招商运营后端服务运行正常' });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误', message: err.message });
});
async function startServer() {
    try {
        await database_1.default.sync({ alter: true });
        console.log('数据库同步成功');
        app.listen(PORT, () => {
            console.log(`服务器运行在 http://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}
startServer();
