"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const filing_1 = __importDefault(require("./routes/filing"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api/filings', filing_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`公网出口备案API服务已启动，端口: ${PORT}`);
    console.log('API文档:');
    console.log('  POST   /api/filings              - 创建备案');
    console.log('  GET    /api/filings              - 查询备案列表');
    console.log('  GET    /api/filings/:id          - 查询单个备案');
    console.log('  POST   /api/filings/:id/advance-status  - 推进状态');
    console.log('  POST   /api/filings/:id/approve  - 审批通过');
    console.log('  POST   /api/filings/:id/reject   - 审批拒绝');
    console.log('  POST   /api/filings/:id/exceptions       - 记录异常');
    console.log('  GET    /api/filings/:id/exceptions       - 查询异常记录');
    console.log('  POST   /api/filings/:id/manual-correction  - 人工修正');
    console.log('  POST   /api/filings/:id/close    - 关闭备案');
    console.log('  GET    /api/filings/:id/report   - 生成报告');
    console.log('  GET    /api/filings/:id/export   - 导出CSV');
    console.log('  POST   /api/filings/check-expired        - 检查到期窗口');
});
