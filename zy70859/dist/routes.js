"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutes = createRoutes;
const express_1 = require("express");
function createRoutes(service) {
    const router = (0, express_1.Router)();
    router.post('/batches', async (req, res) => {
        try {
            const { createdBy, description } = req.body;
            if (!createdBy) {
                return res.status(400).json({ error: 'createdBy 是必填字段' });
            }
            const batch = await service.createBatch(createdBy, description);
            res.json(batch);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/batches', async (_req, res) => {
        try {
            const batches = await service.getAllBatches();
            res.json(batches);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/batches/:batchId', async (req, res) => {
        try {
            const batch = await service.getBatch(req.params.batchId);
            if (!batch) {
                return res.status(404).json({ error: '批次不存在' });
            }
            res.json(batch);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/batches/:batchId/materials', async (req, res) => {
        try {
            const materials = await service.getMaterialsByBatch(req.params.batchId);
            res.json(materials);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.post('/batches/:batchId/materials', async (req, res) => {
        try {
            const { materialData, processedBy } = req.body;
            if (!processedBy) {
                return res.status(400).json({ error: 'processedBy 是必填字段' });
            }
            const result = await service.registerMaterial(req.params.batchId, materialData, processedBy);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.post('/batches/:batchId/recalculate', async (req, res) => {
        try {
            const { processedBy } = req.body;
            if (!processedBy) {
                return res.status(400).json({ error: 'processedBy 是必填字段' });
            }
            const result = await service.recalculateBatch(req.params.batchId, processedBy);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/materials/:materialId', async (req, res) => {
        try {
            const material = await service.getMaterial(req.params.materialId);
            if (!material) {
                return res.status(404).json({ error: '材料不存在' });
            }
            res.json(material);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/materials/:materialId/trail', async (req, res) => {
        try {
            const trail = await service.getMaterialTrail(req.params.materialId);
            res.json(trail);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/materials/:materialId/processing-trails', async (req, res) => {
        try {
            const trails = await service.getProcessingTrails(req.params.materialId);
            res.json(trails);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/materials/:materialId/audit-logs', async (req, res) => {
        try {
            const logs = await service.getAuditLogs(req.params.materialId);
            res.json(logs);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.patch('/materials/:materialId/status', async (req, res) => {
        try {
            const { newStatus, statusReason, modifiedBy, changeReason } = req.body;
            if (!newStatus || !statusReason || !modifiedBy || !changeReason) {
                return res.status(400).json({
                    error: 'newStatus, statusReason, modifiedBy, changeReason 都是必填字段'
                });
            }
            const material = await service.updateMaterialStatus(req.params.materialId, newStatus, statusReason, modifiedBy, changeReason);
            res.json(material);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    router.get('/statistics', async (_req, res) => {
        try {
            const stats = await service.getStatistics();
            res.json(stats);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    return router;
}
