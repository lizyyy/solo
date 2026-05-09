"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRepaymentRouter = createRepaymentRouter;
const express_1 = require("express");
function createRepaymentRouter(repaymentService) {
    const router = (0, express_1.Router)();
    router.post('/', async (req, res) => {
        try {
            const { groupCreditId, subAccountId, amount, idempotencyKey, withdrawalId } = req.body;
            if (!idempotencyKey) {
                return res.status(400).json({
                    success: false,
                    message: '缺少幂等键。请在请求头或请求体中提供 idempotencyKey'
                });
            }
            const result = await repaymentService.repay(groupCreditId, subAccountId, amount, idempotencyKey, withdrawalId);
            const statusCode = result.isDuplicate ? 200 : 201;
            res.status(statusCode).json({
                success: true,
                data: {
                    repayment: result.repayment,
                    isDuplicate: result.isDuplicate
                }
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '还款失败';
            const isClientError = message.includes('缺少') ||
                message.includes('不能超过') ||
                message.includes('已停用') ||
                message.includes('不属于该集团') ||
                message.includes('只能对成功的提款');
            res.status(isClientError ? 400 : 500).json({
                success: false,
                message
            });
        }
    });
    router.get('/:repaymentId', async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const repayment = await repaymentService.getRepaymentById(repaymentId);
            res.json({
                success: true,
                data: repayment
            });
        }
        catch (error) {
            res.status(404).json({
                success: false,
                message: error instanceof Error ? error.message : '查询失败'
            });
        }
    });
    router.get('/sub-account/:subAccountId', async (req, res) => {
        try {
            const { subAccountId } = req.params;
            const repayments = await repaymentService.getRepaymentsBySubAccount(subAccountId);
            res.json({
                success: true,
                data: repayments
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '查询失败'
            });
        }
    });
    router.get('/idempotency/:key', async (req, res) => {
        try {
            const { key } = req.params;
            const repayment = await repaymentService.getByIdempotencyKey(key);
            if (repayment) {
                res.json({
                    success: true,
                    data: {
                        exists: true,
                        repayment
                    }
                });
            }
            else {
                res.json({
                    success: true,
                    data: {
                        exists: false,
                        repayment: null
                    }
                });
            }
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '查询失败'
            });
        }
    });
    return router;
}
