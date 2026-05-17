"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '招聘系统后端候选人简历查重合并 API 运行正常' });
});
app.listen(PORT, () => {
    console.log(`
========================================
招聘系统后端候选人简历查重合并 API
========================================
服务已启动，端口: ${PORT}

API 文档:
  POST   /api/candidates          - 创建候选人
  GET    /api/candidates          - 候选人列表
  GET    /api/candidates/:id      - 候选人详情
  PUT    /api/candidates/:id      - 更新候选人
  POST   /api/candidates/review   - 审核（合并/保留独立/撤回）
  
  GET    /api/candidates/:id/history  - 单个候选人合并历史
  GET    /api/merge-history           - 全部合并历史
  
  POST   /api/import              - 批量导入CSV
  GET    /api/import              - 导入记录列表
  GET    /api/import/:id          - 导入记录详情
  
  GET    /api/export/csv          - 导出CSV
  GET    /api/export/json         - 导出JSON

状态枚举:
  pending_merge     - 待合并
  conflict_review   - 冲突待审
  merged            - 已合并
  keep_independent  - 保留独立

来源渠道:
  headhunter           - 猎头
  official_website     - 官网
  internal_recommendation - 内推
  zhaopin              - 智联
  liepin               - 猎聘
  boss                 - BOSS直聘
  other                - 其他

健康检查: GET /health
========================================
  `);
});
