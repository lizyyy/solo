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
app.use('/api/rebind', routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '门店设备换绑API服务运行正常' });
});
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('API文档:');
    console.log('  POST /api/rebind/create - 创建换绑申请');
    console.log('  GET /api/rebind/:id - 查询单个换绑记录');
    console.log('  POST /api/rebind/query - 分页查询换绑记录');
    console.log('  POST /api/rebind/transition-status - 推进状态');
    console.log('  POST /api/rebind/handle-exception - 异常处理');
    console.log('  POST /api/rebind/manual-fix - 人工修正');
    console.log('  POST /api/rebind/export - 导出数据');
    console.log('  GET /api/rebind/history/device/:deviceCode - 查询设备换绑历史');
    console.log('  GET /api/rebind/history/rebind/:rebindId - 查询单条记录操作历史');
});
