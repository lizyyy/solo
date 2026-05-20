"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviewService_1 = require("../services/reviewService");
const router = (0, express_1.Router)();
router.post('/:resultId/diff/:diffId', async (req, res) => {
    try {
        const { resultId, diffId } = req.params;
        const { reviewer, action, notes } = req.body;
        if (!reviewer || !action) {
            return res.status(400).json({
                success: false,
                message: '缺少复核人或操作类型',
            });
        }
        const updatedDiff = await reviewService_1.reviewService.reviewDiff(resultId, diffId, reviewer, action, notes);
        if (!updatedDiff) {
            return res.status(404).json({
                success: false,
                message: '对账结果或差异不存在',
            });
        }
        res.json({
            success: true,
            data: updatedDiff,
            message: '复核完成',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '复核失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/:resultId/batch', async (req, res) => {
    try {
        const { resultId } = req.params;
        const { diffIds, reviewer, action, notes } = req.body;
        if (!reviewer || !action || !Array.isArray(diffIds)) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数',
            });
        }
        const updatedDiffs = await reviewService_1.reviewService.batchReview(resultId, diffIds, reviewer, action, notes);
        res.json({
            success: true,
            data: updatedDiffs,
            message: `批量复核完成，共处理 ${updatedDiffs.length} 条差异`,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '批量复核失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/diff/:diffId/history', async (req, res) => {
    try {
        const { diffId } = req.params;
        const history = reviewService_1.reviewService.getReviewHistory(diffId);
        res.json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: '获取复核历史失败',
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
exports.default = router;
//# sourceMappingURL=reviewRoutes.js.map