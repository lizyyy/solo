"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', routes_1.default);
app.get('/', (req, res) => {
    res.json({
        message: '研究生院招生数据处理API',
        endpoints: {
            health: 'GET /api/health',
            importBatch: 'POST /api/import/batch',
            mentors: 'GET /api/mentors',
            applications: 'GET /api/applications',
            transfers: 'GET /api/transfers',
            confirmApplication: 'POST /api/applications/:id/confirm',
            statistics: 'GET /api/statistics',
            exportMentors: 'GET /api/export/mentors',
            reset: 'POST /api/reset'
        }
    });
});
app.listen(PORT, () => {
    console.log(`\n🚀 服务器启动成功！`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📚 API文档: http://localhost:${PORT}/`);
    console.log(`\n💡 使用说明:`);
    console.log(`  - 查看健康状态: curl http://localhost:${PORT}/api/health`);
    console.log(`  - 查看统计数据: curl http://localhost:${PORT}/api/statistics`);
    console.log(`  - 运行测试样例: npm test`);
    console.log();
});
exports.default = app;
