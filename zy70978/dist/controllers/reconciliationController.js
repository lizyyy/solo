"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscrepancyExplanation = exports.getAllReconciliationResults = exports.getReconciliationResult = exports.reconcileAllOrders = exports.reconcileOrder = void 0;
const reconciliationEngine_1 = require("../services/reconciliationEngine");
const dataStore_1 = require("../store/dataStore");
const reconcileOrder = (req, res) => {
    try {
        const { orderNo } = req.params;
        const result = reconciliationEngine_1.reconciliationEngine.reconcileOrder(orderNo);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.reconcileOrder = reconcileOrder;
const reconcileAllOrders = (_req, res) => {
    try {
        const results = reconciliationEngine_1.reconciliationEngine.reconcileAllOrders();
        res.json({
            message: `已完成 ${results.length} 个订单的对账`,
            results,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.reconcileAllOrders = reconcileAllOrders;
const getReconciliationResult = (req, res) => {
    try {
        const { orderNo } = req.params;
        const result = dataStore_1.dataStore.getReconciliationResult(orderNo);
        if (!result) {
            return res.status(404).json({ error: '对账结果不存在，请先执行对账' });
        }
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getReconciliationResult = getReconciliationResult;
const getAllReconciliationResults = (_req, res) => {
    try {
        const results = dataStore_1.dataStore.getAllReconciliationResults();
        res.json(results);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllReconciliationResults = getAllReconciliationResults;
const getDiscrepancyExplanation = (req, res) => {
    try {
        const { type } = req.params;
        const explanation = reconciliationEngine_1.reconciliationEngine.getDiscrepancyExplanation(type);
        res.json({ type, explanation });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getDiscrepancyExplanation = getDiscrepancyExplanation;
