"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./database");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
async function startServer() {
    try {
        await database_1.db.init();
        console.log('数据库初始化完成');
        app.listen(PORT, () => {
            console.log(`园区访客车牌授权 API 服务已启动`);
            console.log(`服务地址: http://localhost:${PORT}`);
            console.log(`健康检查: http://localhost:${PORT}/health`);
            console.log(`API 路径: http://localhost:${PORT}/api`);
        });
    }
    catch (error) {
        console.error('启动服务失败:', error);
        process.exit(1);
    }
}
startServer();
