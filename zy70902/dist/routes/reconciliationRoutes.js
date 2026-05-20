"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reconciliationService_1 = require("../services/reconciliationService");
const dataStore_1 = require("../store/dataStore");
const router = (0, express_1.Router)();
router.post('/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await reconciliationService_1.reconciliationService.performReconciliation(batchId);
        res.json({
            success: true,
            data: result,
            message: '对账完成',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '对账失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/:resultId', async (req, res) => {
    try {
        const { resultId } = req.params;
        const result = dataStore_1.dataStore.getReconciliationResult(resultId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: '对账结果不存在',
            });
        }
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取对账结果失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/', async (req, res) => {
    try {
        const results = dataStore_1.dataStore.getAllReconciliationResults();
        res.json({
            success: true,
            data: results,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取对账结果列表失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/:resultId/recalculate', async (req, res) => {
    try {
        const { resultId } = req.params;
        const result = await reconciliationService_1.reconciliationService.recalculateSummary(resultId);
        if (!result) {
            return res.status(404).json({
                success: false,
                message: '对账结果不存在',
            });
        }
        res.json({
            success: true,
            data: result,
            message: '重新计算完成',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '重新计算失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/:resultId/cable-car/:cableCarId', async (req, res) => {
    try {
        const { resultId, cableCarId } = req.params;
        const diffs = reconciliationService_1.reconciliationService.getDiffsByCableCar(cableCarId, resultId);
        if (!diffs) {
            return res.status(404).json({
                success: false,
                message: '对账结果不存在',
            });
        }
        res.json({
            success: true,
            data: diffs,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取缆车差异失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
exports.default = router;
//# sourceMappingURL=reconciliationRoutes.js.map