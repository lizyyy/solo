"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(body_parser_1.default.json());
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'lease-renewal-conflict-system',
        version: '1.0.0',
        description: '租赁SaaS后端租期自动续租冲突处理系统'
    });
});
app.get('/config', (req, res) => {
    res.json({
        service: 'lease-renewal-conflict-system',
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        features: {
            batchImport: true,
            manualRemark: true,
            conflictDetection: true,
            statusTransition: true,
            historyTracking: true,
            dataExport: true
        },
        statusTypes: ['leasing', 'renewal_pending', 'renewed', 'pending_return'],
        conflictTypes: ['auto_vs_manual_renewal', 'payment_overdue', 'invalid_renewal_rule', 'asset_unavailable'],
        paymentStatusTypes: ['paid', 'pending', 'overdue'],
        requiredConfigs: {
            DATABASE_URL: 'optional - using in-memory store for development',
            AUTH_TOKEN: 'optional - not required for local testing'
        },
        warnings: [
            '当前使用内存存储，服务重启后数据会丢失',
            '生产环境请配置持久化数据库'
        ]
    });
});
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('  租赁SaaS后端租期自动续租冲突处理系统');
    console.log('  Lease Renewal Conflict System v1.0.0');
    console.log('='.repeat(60));
    console.log('');
    console.log(`  🚀 服务运行在: http://localhost:${PORT}`);
    console.log('');
    console.log('  📋 可用API端点:');
    console.log('    POST   /api/leases                          - 创建租赁记录');
    console.log('    GET    /api/leases                          - 租赁记录列表');
    console.log('    GET    /api/leases/:id                      - 租赁详情');
    console.log('    GET    /api/leases/:id/history              - 操作历史');
    console.log('    GET    /api/leases/:id/export               - 导出租赁数据');
    console.log('    PATCH  /api/leases/:id/status               - 状态流转');
    console.log('    POST   /api/leases/:id/auto-renewal         - 提交自动续租');
    console.log('    POST   /api/leases/:id/manual-renewal       - 提交手动续租');
    console.log('    POST   /api/leases/:id/remarks              - 添加人工备注');
    console.log('    PATCH  /api/leases/:id/conflicts/:cid/resolve - 解决冲突');
    console.log('    POST   /api/leases/:id/confirm-renewal      - 确认续租');
    console.log('    POST   /api/leases/import                   - 批量导入租赁记录');
    console.log('');
    console.log('  🔧 工具端点:');
    console.log('    GET    /health                               - 健康检查');
    console.log('    GET    /config                               - 配置信息');
    console.log('');
    console.log('  ⚠️  当前配置:');
    console.log('    - 使用内存存储，服务重启后数据会丢失');
    console.log('    - 无需外部依赖，可直接本地运行');
    console.log('    - 生产环境请配置持久化数据库');
    console.log('');
    console.log('  📝 验收测试:');
    console.log('    运行 ./test-acceptance.sh 执行完整验收测试');
    console.log('');
    console.log('='.repeat(60));
});
exports.default = app;
