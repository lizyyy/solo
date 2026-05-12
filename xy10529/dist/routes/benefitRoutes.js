"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.benefitRouter = void 0;
const express_1 = require("express");
const benefitService_1 = require("../services/benefitService");
const uuid_1 = require("uuid");
const types_1 = require("../types");
const router = (0, express_1.Router)();
exports.benefitRouter = router;
router.post('/grant', (req, res) => {
    const { memberId, benefitType, benefitName, totalDays } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!memberId || !benefitType || !benefitName || !totalDays) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: memberId, benefitType, benefitName, totalDays',
            requestId
        });
    }
    const result = benefitService_1.benefitService.grantBenefit({
        requestId,
        memberId,
        benefitType,
        benefitName,
        totalDays: Number(totalDays)
    });
    res.json(result);
});
router.get('/:benefitId', (req, res) => {
    const { benefitId } = req.params;
    const result = benefitService_1.benefitService.queryBenefit({ benefitId });
    res.json(result);
});
router.post('/:benefitId/freeze', (req, res) => {
    const { benefitId } = req.params;
    const { reason, detail, operator } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!reason || !detail) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: reason, detail',
            requestId
        });
    }
    const validReasons = Object.values(types_1.FreezeReason);
    if (!validReasons.includes(reason)) {
        return res.status(400).json({
            success: false,
            message: `无效的冻结原因，有效值: ${validReasons.join(', ')}`,
            requestId
        });
    }
    const result = benefitService_1.benefitService.freezeBenefit({
        requestId,
        benefitId,
        reason,
        detail,
        operator
    });
    res.json(result);
});
router.post('/:benefitId/unfreeze', (req, res) => {
    const { benefitId } = req.params;
    const { reason, operator } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!reason) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: reason',
            requestId
        });
    }
    const result = benefitService_1.benefitService.unfreezeBenefit({
        requestId,
        benefitId,
        reason,
        operator
    });
    res.json(result);
});
router.post('/:benefitId/refund', (req, res) => {
    const { benefitId } = req.params;
    const { detail, operator } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!detail) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: detail',
            requestId
        });
    }
    const result = benefitService_1.benefitService.processRefund({
        requestId,
        benefitId,
        detail,
        operator
    });
    res.json(result);
});
router.post('/:benefitId/compensate', (req, res) => {
    const { benefitId } = req.params;
    const { days, reason, operator } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!days || !reason) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: days, reason',
            requestId
        });
    }
    const result = benefitService_1.benefitService.compensateBenefit({
        requestId,
        benefitId,
        days: Number(days),
        reason,
        operator
    });
    res.json(result);
});
router.post('/:benefitId/correct', (req, res) => {
    const { benefitId } = req.params;
    const { changes, operator, reason } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!changes || !operator || !reason) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: changes, operator, reason',
            requestId
        });
    }
    if (changes.status) {
        const validStatuses = Object.values(types_1.BenefitStatus);
        if (!validStatuses.includes(changes.status)) {
            return res.status(400).json({
                success: false,
                message: `无效的状态值，有效值: ${validStatuses.join(', ')}`,
                requestId
            });
        }
    }
    const result = benefitService_1.benefitService.manualCorrect({
        requestId,
        benefitId,
        changes,
        operator,
        reason
    });
    res.json(result);
});
//# sourceMappingURL=benefitRoutes.js.map