"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
require("./seed");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.listen(PORT, () => {
    console.log(`
  ==========================================
  🚀 广告投放预算超投止损系统已启动
  📍 服务地址: http://localhost:${PORT}
  📡 API 前缀: /api
  ==========================================
  
  可用接口:
  - GET  /api/health              - 健康检查
  - GET  /api/advertisers         - 获取广告主列表
  - GET  /api/plans               - 获取投放计划列表
  - GET  /api/plans/:id           - 获取计划详情
  - GET  /api/plans/:id/history   - 获取计划历史
  - GET  /api/plans/:id/export    - 导出计划数据
  - GET  /api/plans/:id/check-budget - 检查预算
  - POST /api/plans/:id/trigger-stop-loss - 触发止损
  - POST /api/plans/:id/reject    - 驳回止损
  - POST /api/plans/:id/manual-review - 人工复核
  - POST /api/plans/:id/close     - 关闭计划
  - POST /api/spend-callbacks/batch-import - 批量导入消耗
  `);
});
