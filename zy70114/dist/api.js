"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const response_1 = require("./utils/response");
const workflowService_1 = require("./services/workflowService");
const orderService_1 = require("./services/orderService");
const compensationService_1 = require("./services/compensationService");
const appealService_1 = require("./services/appealService");
const liabilityService_1 = require("./services/liabilityService");
const reportService_1 = require("./services/reportService");
const idempotentService_1 = require("./services/idempotentService");
const app = (0, express_1.default)();
exports.app = app;
app.use(express_1.default.json());
app.use((err, req, res, next) => {
    if (err instanceof response_1.BusinessError) {
        res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
    }
    else {
        console.error('Unexpected error:', err);
        res.json((0, response_1.errorResponse)('INTERNAL_ERROR', '系统内部错误', '系统处理出错，请稍后重试或联系技术支持'));
    }
});
app.post('/api/orders', (req, res) => {
    try {
        const result = (0, workflowService_1.processCreateOrder)(req.body);
        res.json((0, response_1.successResponse)(result, '订单创建成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/accept', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processMerchantAccept)(req.params.orderId, operator_id || 'system', operator_role || 'merchant');
        res.json((0, response_1.successResponse)(result, '商家接单成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/cooking', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processStartCooking)(req.params.orderId, operator_id || 'system', operator_role || 'merchant');
        res.json((0, response_1.successResponse)(result, '开始制作成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/meal-ready', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processMealReady)(req.params.orderId, operator_id || 'system', operator_role || 'merchant');
        res.json((0, response_1.successResponse)(result, '出餐上报成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/pickup', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processRiderPickup)(req.params.orderId, operator_id || 'system', operator_role || 'rider');
        res.json((0, response_1.successResponse)(result, '取餐成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/deliver', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processDeliver)(req.params.orderId, operator_id || 'system', operator_role || 'rider');
        res.json((0, response_1.successResponse)(result, '送达成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/assign-rider', (req, res) => {
    try {
        const { rider_id, rider_name, operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processAssignRider)(req.params.orderId, rider_id, rider_name, operator_id || 'system', operator_role || 'platform');
        res.json((0, response_1.successResponse)(result, '骑手分配成功', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/api/orders/:orderId', (req, res) => {
    try {
        const result = (0, workflowService_1.getOrderFullInfo)(req.params.orderId);
        const formatted = (0, workflowService_1.formatOrderInfo)(result);
        res.json((0, response_1.successResponse)({
            raw: result,
            formatted,
        }, '查询成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/api/orders/by-no/:orderNo', (req, res) => {
    try {
        const order = (0, orderService_1.getOrderByNo)(req.params.orderNo);
        const result = (0, workflowService_1.getOrderFullInfo)(order.id);
        const formatted = (0, workflowService_1.formatOrderInfo)(result);
        res.json((0, response_1.successResponse)({
            raw: result,
            formatted,
        }, '查询成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/process-overtime', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, workflowService_1.processOvertimeWorkflow)(req.params.orderId, operator_id || 'system', operator_role || 'platform');
        res.json((0, response_1.successResponse)(result, '超时处理完成', result.business_message));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/judge-liability', (req, res) => {
    try {
        const { liable_party, reason, evidence, operator_id, operator_role } = req.body;
        const result = (0, liabilityService_1.manualJudgeLiability)(req.params.orderId, liable_party, reason, evidence || null, operator_id, operator_role);
        res.json((0, response_1.successResponse)(result, '责任判定成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/api/orders/:orderId/compensations', (req, res) => {
    try {
        const result = (0, compensationService_1.getCompensations)(req.params.orderId);
        res.json((0, response_1.successResponse)(result, '查询成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/compensations/:compensationId/approve', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, compensationService_1.approveCompensation)(req.params.compensationId, operator_id, operator_role);
        res.json((0, response_1.successResponse)(result, '补偿审批通过'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/compensations/:compensationId/reject', (req, res) => {
    try {
        const { reason, operator_id, operator_role } = req.body;
        const result = (0, compensationService_1.rejectCompensation)(req.params.compensationId, reason, operator_id, operator_role);
        res.json((0, response_1.successResponse)(result, '补偿已拒绝'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/compensations/:compensationId/execute', (req, res) => {
    try {
        const { operator_id, operator_role } = req.body;
        const result = (0, compensationService_1.executeCompensation)(req.params.compensationId, operator_id, operator_role);
        res.json((0, response_1.successResponse)(result, '补偿已执行'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/compensations/:compensationId/rollback', (req, res) => {
    try {
        const { reason, operator_id, operator_role } = req.body;
        (0, appealService_1.manualRollback)(req.params.compensationId, operator_id, operator_role, reason);
        const result = (0, compensationService_1.getCompensationById)(req.params.compensationId);
        res.json((0, response_1.successResponse)(result, '补偿已回滚'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/orders/:orderId/appeals', (req, res) => {
    try {
        const { compensation_id, appellant_party, appellant_id, appeal_reason, appeal_evidence } = req.body;
        const result = (0, appealService_1.createAppeal)(req.params.orderId, compensation_id, appellant_party, appellant_id, appeal_reason, appeal_evidence || null);
        res.json((0, response_1.successResponse)(result, '申诉提交成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/api/orders/:orderId/appeals', (req, res) => {
    try {
        const result = (0, appealService_1.getAppeals)(req.params.orderId);
        res.json((0, response_1.successResponse)(result, '查询成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/appeals/:appealId/start-review', (req, res) => {
    try {
        const { reviewer_id, reviewer_role } = req.body;
        const result = (0, appealService_1.startReview)(req.params.appealId, reviewer_id, reviewer_role);
        res.json((0, response_1.successResponse)(result, '已开始审核'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.post('/api/appeals/:appealId/review', (req, res) => {
    try {
        const { approved, review_result, reviewer_id, reviewer_role } = req.body;
        const result = (0, appealService_1.reviewAppeal)(req.params.appealId, reviewer_id, reviewer_role, approved, review_result);
        res.json((0, response_1.successResponse)(result, approved ? '申诉通过' : '申诉驳回'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/api/reports/:period', (req, res) => {
    try {
        const period = req.params.period;
        const result = (0, reportService_1.generateReport)(period);
        const formatted = (0, reportService_1.formatReportForDisplay)(result);
        res.json((0, response_1.successResponse)({
            raw: result,
            formatted,
        }, '报表生成成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/api/orders/:orderId/logs', (req, res) => {
    try {
        const result = (0, idempotentService_1.getOperationLogs)(req.params.orderId);
        res.json((0, response_1.successResponse)(result, '查询成功'));
    }
    catch (err) {
        if (err instanceof response_1.BusinessError) {
            res.json((0, response_1.errorResponse)(err.code, err.message, err.businessMessage));
        }
        else {
            throw err;
        }
    }
});
app.get('/health', (req, res) => {
    res.json((0, response_1.successResponse)({ status: 'ok' }, '服务正常'));
});
//# sourceMappingURL=api.js.map