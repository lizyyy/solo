"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const quoteRoutes_1 = __importDefault(require("./routes/quoteRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
Promise.resolve().then(() => __importStar(require('./scripts/seed')));
app.use('/health', (req, res) => {
    res.json({
        success: true,
        message: '维修服务站上门维修报价API运行正常',
        timestamp: new Date().toISOString()
    });
});
app.use('/api/quotes', quoteRoutes_1.default);
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'ENDPOINT_NOT_FOUND',
            message: '请求的接口不存在',
            suggestedAction: '请检查API路径是否正确'
        }
    });
});
app.listen(PORT, () => {
    console.log('========================================');
    console.log('  维修服务站上门维修报价 API');
    console.log('========================================');
    console.log(`服务已启动，监听端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API基础路径: http://localhost:${PORT}/api/quotes`);
    console.log('========================================');
    console.log('');
    console.log('主要接口:');
    console.log('  GET    /api/quotes              - 获取所有报价列表');
    console.log('  GET    /api/quotes/:id          - 根据ID获取报价详情');
    console.log('  GET    /api/quotes/number/:number - 根据单号获取报价详情');
    console.log('  POST   /api/quotes              - 创建报价');
    console.log('  POST   /api/quotes/:id/submit   - 提交报价审批');
    console.log('  POST   /api/quotes/:id/accept   - 客户接受报价');
    console.log('  POST   /api/quotes/:id/add-hidden-fault - 追加隐藏故障');
    console.log('  POST   /api/quotes/:id/review-supplement/:recordId - 审核追加报价');
    console.log('  POST   /api/quotes/:id/complete - 完成维修');
    console.log('  GET    /api/quotes/:id/change-records - 获取报价变更记录');
    console.log('');
    console.log('种子数据已加载，包含4条报价记录:');
    console.log('  - COMPLETED (已完成)');
    console.log('  - PENDING_SUPPLEMENT (补录待确认)');
    console.log('  - REJECTED (驳回)');
    console.log('  - CUSTOMER_ACCEPTED (客户已接受)');
    console.log('');
    console.log('========================================');
});
