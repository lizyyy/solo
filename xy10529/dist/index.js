"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const memberRoutes_1 = require("./routes/memberRoutes");
const benefitRoutes_1 = require("./routes/benefitRoutes");
const reportRoutes_1 = require("./routes/reportRoutes");
const app = (0, express_1.default)();
const PORT = 3000;
app.use(express_1.default.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleString('zh-CN')}] ${req.method} ${req.path}`);
    next();
});
app.get('/', (req, res) => {
    res.json({
        name: '会员权益冻结 API',
        version: '1.0.0',
        description: '处理会员权益在退款、风控、过期和人工补偿之间的切换',
        endpoints: {
            member: {
                'POST /api/member/create': '创建会员',
                'GET /api/member/:memberId': '查询会员信息',
                'GET /api/member/:memberId/benefits': '查询会员所有权益'
            },
            benefit: {
                'POST /api/benefit/grant': '发放权益',
                'GET /api/benefit/:benefitId': '查询权益详情（含账本）',
                'POST /api/benefit/:benefitId/freeze': '冻结权益',
                'POST /api/benefit/:benefitId/unfreeze': '解冻权益',
                'POST /api/benefit/:benefitId/refund': '退款处理（永久冻结）',
                'POST /api/benefit/:benefitId/compensate': '人工补偿',
                'POST /api/benefit/:benefitId/correct': '人工修正'
            },
            report: {
                'GET /api/report/export': '导出报告（支持?format=csv）',
                'GET /api/report/all': '查看所有数据'
            }
        },
        examples: {
            normal: '正常使用流程: 创建会员 → 发放权益 → 查询权益',
            risk_control: '风控流程: 发放权益 → 风控冻结 → 解除冻结',
            refund: '退款流程: 发放权益 → 退款 → 尝试解冻（失败）',
            compensate: '补偿流程: 发放权益 → 冻结 → 补偿 → 解冻',
            idempotent: '幂等测试: 重复调用同一接口（相同requestId）'
        }
    });
});
app.use('/api/member', memberRoutes_1.memberRouter);
app.use('/api/benefit', benefitRoutes_1.benefitRouter);
app.use('/api/report', reportRoutes_1.reportRouter);
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: err.message
    });
});
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  会员权益冻结 API 已启动`);
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`========================================\n`);
});
//# sourceMappingURL=index.js.map