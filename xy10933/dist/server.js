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
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', routes_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
    });
});
async function startServer() {
    try {
        await (0, database_1.initDatabase)();
        console.log('数据库初始化完成');
        app.listen(PORT, () => {
            console.log(`\n========================================`);
            console.log(`  影棚器材借还 API 服务启动成功！`);
            console.log(`  服务地址: http://localhost:${PORT}`);
            console.log(`  API 前缀: http://localhost:${PORT}/api`);
            console.log(`  健康检查: http://localhost:${PORT}/api/health`);
            console.log(`========================================\n`);
        });
    }
    catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}
startServer();
