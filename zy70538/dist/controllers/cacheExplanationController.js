"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheExplanationController = exports.CacheExplanationController = void 0;
const cacheExplanationStore_1 = require("../store/cacheExplanationStore");
const exportService_1 = require("../services/exportService");
const types_1 = require("../types");
class CacheExplanationController {
    async createExplanation(req, res) {
        try {
            const request = req.body;
            const explanation = cacheExplanationStore_1.cacheExplanationStore.create(request);
            res.status(201).json({
                success: true,
                data: explanation,
                message: '缓存解释记录创建成功'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: '创建缓存解释记录失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async getExplanationById(req, res) {
        const { id } = req.params;
        const explanation = cacheExplanationStore_1.cacheExplanationStore.findById(id);
        if (!explanation) {
            res.status(404).json({
                success: false,
                error: '未找到缓存解释记录'
            });
            return;
        }
        res.json({
            success: true,
            data: explanation
        });
    }
    async getExplanationByCacheKey(req, res) {
        const { cacheKey } = req.params;
        const explanation = cacheExplanationStore_1.cacheExplanationStore.findByCacheKey(cacheKey);
        if (!explanation) {
            res.status(404).json({
                success: false,
                error: '未找到对应缓存键的解释记录'
            });
            return;
        }
        res.json({
            success: true,
            data: explanation
        });
    }
    async queryExplanations(req, res) {
        try {
            const params = req.query;
            const result = cacheExplanationStore_1.cacheExplanationStore.query(params);
            res.json({
                success: true,
                data: result.data,
                pagination: {
                    page: params.page || 1,
                    pageSize: params.pageSize || 20,
                    total: result.total,
                    totalPages: Math.ceil(result.total / (params.pageSize || 20))
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: '查询缓存解释记录失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async updateStatus(req, res) {
        const { id } = req.params;
        const { status, updatedBy } = req.body;
        if (!Object.values(types_1.CacheExplanationStatus).includes(status)) {
            res.status(400).json({
                success: false,
                error: '无效的状态值',
                validStatuses: Object.values(types_1.CacheExplanationStatus)
            });
            return;
        }
        const explanation = cacheExplanationStore_1.cacheExplanationStore.updateStatus(id, status, updatedBy);
        if (!explanation) {
            res.status(404).json({
                success: false,
                error: '未找到缓存解释记录'
            });
            return;
        }
        res.json({
            success: true,
            data: explanation,
            message: '状态更新成功'
        });
    }
    async manualCorrection(req, res) {
        try {
            const request = req.body;
            const explanation = cacheExplanationStore_1.cacheExplanationStore.manualCorrection(request);
            if (!explanation) {
                res.status(404).json({
                    success: false,
                    error: '未找到缓存解释记录'
                });
                return;
            }
            res.json({
                success: true,
                data: explanation,
                message: '人工修正成功'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: '人工修正失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async recordHit(req, res) {
        const { cacheKey, requestId, clientIp } = req.body;
        const explanation = cacheExplanationStore_1.cacheExplanationStore.recordHit(cacheKey, requestId, clientIp);
        if (!explanation) {
            res.status(404).json({
                success: false,
                error: '未找到对应缓存键的解释记录'
            });
            return;
        }
        res.json({
            success: true,
            message: '命中记录已更新',
            hitCount: explanation.hitHistory.length
        });
    }
    async forceRefresh(req, res) {
        try {
            const request = req.body;
            const explanation = cacheExplanationStore_1.cacheExplanationStore.forceRefresh(request);
            if (!explanation) {
                res.status(404).json({
                    success: false,
                    error: '未找到对应缓存键的解释记录'
                });
                return;
            }
            res.json({
                success: true,
                data: explanation,
                message: '缓存已强制刷新并标记为已撤销'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: '强制刷新失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async recordFailure(req, res) {
        try {
            const { id, rawInput, processingBasis, finalConclusion, errorStack } = req.body;
            const explanation = cacheExplanationStore_1.cacheExplanationStore.recordFailure(id, rawInput, processingBasis, finalConclusion, errorStack);
            if (!explanation) {
                res.status(404).json({
                    success: false,
                    error: '未找到缓存解释记录'
                });
                return;
            }
            res.json({
                success: true,
                data: explanation,
                message: '失败详情已记录，状态已更新为被拦截'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: '记录失败详情失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async getDetailedReport(req, res) {
        const { id } = req.params;
        const explanation = cacheExplanationStore_1.cacheExplanationStore.findById(id);
        if (!explanation) {
            res.status(404).json({
                success: false,
                error: '未找到缓存解释记录'
            });
            return;
        }
        const report = exportService_1.exportService.generateDetailedReport(explanation);
        res.json({
            success: true,
            data: report
        });
    }
    async exportToCSV(req, res) {
        try {
            const explanations = cacheExplanationStore_1.cacheExplanationStore.getAllForExport();
            const filePath = exportService_1.exportService.exportToCSV(explanations);
            res.json({
                success: true,
                message: 'CSV导出成功',
                filePath,
                recordCount: explanations.length
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'CSV导出失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async exportToJSON(req, res) {
        try {
            const explanations = cacheExplanationStore_1.cacheExplanationStore.getAllForExport();
            const filePath = exportService_1.exportService.exportToJSON(explanations);
            res.json({
                success: true,
                message: 'JSON导出成功',
                filePath,
                recordCount: explanations.length
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'JSON导出失败',
                details: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async getHitHistory(req, res) {
        const { id } = req.params;
        const explanation = cacheExplanationStore_1.cacheExplanationStore.findById(id);
        if (!explanation) {
            res.status(404).json({
                success: false,
                error: '未找到缓存解释记录'
            });
            return;
        }
        res.json({
            success: true,
            data: {
                hitHistory: explanation.hitHistory,
                totalHits: explanation.hitHistory.length
            }
        });
    }
}
exports.CacheExplanationController = CacheExplanationController;
exports.cacheExplanationController = new CacheExplanationController();
//# sourceMappingURL=cacheExplanationController.js.map