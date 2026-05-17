"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const batches_1 = __importDefault(require("./routes/batches"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'offline-package-integrity-api', timestamp: new Date().toISOString() });
});
app.use('/api/batches', batches_1.default);
app.listen(PORT, () => {
    console.log(`
================================================================================
            离线包完整性API服务已启动
================================================================================
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health
API文档:
  POST   /api/batches              - 创建批次
  GET    /api/batches              - 查询所有批次
  GET    /api/batches/:batchId     - 查询单个批次
  POST   /api/batches/:batchId/packages
                                    - 上传安装包
  POST   /api/batches/:batchId/manifest
                                    - 上传清单文件
  POST   /api/batches/:batchId/manifest/verify
                                    - 验证清单
  POST   /api/batches/:batchId/signatures
                                    - 上传签名
  POST   /api/batches/:batchId/signatures/verify
                                    - 验证签名
  POST   /api/batches/:batchId/patch-order
                                    - 设置补丁顺序
  POST   /api/batches/:batchId/patch-order/verify
                                    - 验证补丁顺序
  POST   /api/batches/:batchId/reports
                                    - 生成核对报告
  GET    /api/batches/:batchId/reports/:reportId/export
                                    - 导出报告
  POST   /api/batches/:batchId/errors/:errorId/resolve
                                    - 解决异常
  POST   /api/batches/:batchId/packages/:packageId/manual-fix
                                    - 人工修正
================================================================================
  `);
});
exports.default = app;
