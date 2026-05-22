"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const anomalyService_1 = require("../services/anomalyService");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { taskId } = req.query;
        let anomalies;
        if (taskId && typeof taskId === 'string') {
            anomalies = await (0, anomalyService_1.getAnomaliesByTaskId)(taskId);
        }
        else {
            anomalies = await (0, anomalyService_1.getOpenAnomalies)();
        }
        res.json({
            success: true,
            data: anomalies
        });
    }
    catch (error) {
        console.error('获取异常列表失败:', error);
        res.status(500).json({
            error: '获取异常列表失败',
            code: 'ANOMALY_LIST_FAILED'
        });
    }
});
router.post('/:anomalyId/resolve', auth_1.authenticate, (0, auth_1.requirePermission)('resolve_anomalies'), async (req, res) => {
    try {
        const { anomalyId } = req.params;
        const { resolution } = req.body;
        const resolvedBy = req.user?.username || 'system';
        if (!resolution) {
            res.status(400).json({ error: '缺少解决方案', code: 'MISSING_RESOLUTION' });
            return;
        }
        const success = await (0, anomalyService_1.resolveAnomaly)(anomalyId, resolution, resolvedBy);
        if (!success) {
            res.status(404).json({ error: '异常记录不存在', code: 'ANOMALY_NOT_FOUND' });
            return;
        }
        res.json({
            success: true,
            message: '异常已解决'
        });
    }
    catch (error) {
        console.error('解决异常失败:', error);
        res.status(500).json({
            error: '解决异常失败',
            code: 'RESOLVE_FAILED'
        });
    }
});
exports.default = router;
