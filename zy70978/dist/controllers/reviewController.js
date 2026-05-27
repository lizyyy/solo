"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusExplanation = exports.getOrderReviewHistory = exports.unbindRepairFromOrder = exports.bindRepairToOrder = exports.updateRepairLiability = exports.resetToPending = exports.requestMoreInfo = exports.rejectOrder = exports.approveOrder = void 0;
const reviewService_1 = require("../services/reviewService");
const approveOrder = (req, res) => {
    try {
        const { orderNo } = req.params;
        const { reviewer, comments } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: '请提供复核人信息' });
        }
        const result = reviewService_1.reviewService.approveOrder(orderNo, reviewer, comments);
        res.json({
            message: '订单已通过复核',
            reviewRecord: result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.approveOrder = approveOrder;
const rejectOrder = (req, res) => {
    try {
        const { orderNo } = req.params;
        const { reviewer, comments } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: '请提供复核人信息' });
        }
        const result = reviewService_1.reviewService.rejectOrder(orderNo, reviewer, comments);
        res.json({
            message: '订单已退回',
            reviewRecord: result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.rejectOrder = rejectOrder;
const requestMoreInfo = (req, res) => {
    try {
        const { orderNo } = req.params;
        const { reviewer, comments } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: '请提供复核人信息' });
        }
        const result = reviewService_1.reviewService.requestMoreInfo(orderNo, reviewer, comments);
        res.json({
            message: '已要求补充材料',
            reviewRecord: result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.requestMoreInfo = requestMoreInfo;
const resetToPending = (req, res) => {
    try {
        const { orderNo } = req.params;
        const { reviewer, comments } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: '请提供复核人信息' });
        }
        const result = reviewService_1.reviewService.resetToPending(orderNo, reviewer, comments);
        res.json({
            message: '订单已重置为待复核状态',
            reviewRecord: result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.resetToPending = resetToPending;
const updateRepairLiability = (req, res) => {
    try {
        const { repairId } = req.params;
        const { liability, reviewer, comments } = req.body;
        if (!reviewer) {
            return res.status(400).json({ error: '请提供操作人信息' });
        }
        reviewService_1.reviewService.updateRepairLiability(repairId, liability, reviewer, comments);
        res.json({
            message: '维修责任归属已更新',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateRepairLiability = updateRepairLiability;
const bindRepairToOrder = (req, res) => {
    try {
        const { repairId, orderNo } = req.body;
        if (!repairId || !orderNo) {
            return res.status(400).json({ error: '请提供维修记录ID和订单号' });
        }
        reviewService_1.reviewService.bindRepairToOrder(repairId, orderNo);
        res.json({
            message: '维修记录已绑定到订单',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.bindRepairToOrder = bindRepairToOrder;
const unbindRepairFromOrder = (req, res) => {
    try {
        const { repairId } = req.params;
        reviewService_1.reviewService.unbindRepairFromOrder(repairId);
        res.json({
            message: '维修记录已解绑',
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.unbindRepairFromOrder = unbindRepairFromOrder;
const getOrderReviewHistory = (req, res) => {
    try {
        const { orderNo } = req.params;
        const history = reviewService_1.reviewService.getOrderReviewHistory(orderNo);
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getOrderReviewHistory = getOrderReviewHistory;
const getStatusExplanation = (req, res) => {
    try {
        const { status } = req.params;
        const explanation = reviewService_1.reviewService.getStatusExplanation(status);
        res.json({ status, explanation });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getStatusExplanation = getStatusExplanation;
