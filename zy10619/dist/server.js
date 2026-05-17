"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const certificates_1 = __importDefault(require("./routes/certificates"));
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api/certificates', certificates_1.default);
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`CDN证书续期校验API服务已启动: http://localhost:${PORT}`);
    console.log('API端点:');
    console.log('  POST /api/certificates          - 创建证书记录');
    console.log('  GET  /api/certificates          - 证书列表');
    console.log('  GET  /api/certificates/:id      - 证书详情');
    console.log('  PATCH /api/certificates/:id     - 更新证书');
    console.log('  GET  /api/certificates/:id/history - 操作历史');
    console.log('  POST /api/certificates/import   - 批量导入');
    console.log('  GET  /api/certificates/export/csv - 导出CSV');
});
