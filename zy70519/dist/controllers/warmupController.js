"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSourceController = exports.NodeController = exports.WarmupController = void 0;
const warmupService_1 = require("../services/warmupService");
const types_1 = require("../models/types");
exports.WarmupController = {
    async createBatch(req, res) {
        try {
            const result = await warmupService_1.WarmupService.createBatch(req.body);
            res.status(201).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async getBatch(req, res) {
        try {
            const { batchId } = req.params;
            const result = await warmupService_1.WarmupService.getBatchById(batchId);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    },
    async listBatches(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const batches = await warmupService_1.WarmupService.listBatches(limit, offset);
            res.json({
                success: true,
                data: batches
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    async startBatch(req, res) {
        try {
            const { batchId } = req.params;
            const result = await warmupService_1.WarmupService.startBatch(batchId);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async updateBatchStatus(req, res) {
        try {
            const { batchId } = req.params;
            const { status } = req.body;
            if (!Object.values(types_1.BatchStatus).includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid batch status'
                });
            }
            await warmupService_1.WarmupService.recalculateBatchCounts(batchId);
            const result = await warmupService_1.WarmupService.getBatchById(batchId);
            res.json({
                success: true,
                data: result.batch
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async updateKeyStatus(req, res) {
        try {
            const result = await warmupService_1.WarmupService.updateKeyStatus(req.body);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async manualFix(req, res) {
        try {
            const result = await warmupService_1.WarmupService.manualFix(req.body);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async getFailedKeys(req, res) {
        try {
            const { batchId } = req.params;
            const failedKeys = await warmupService_1.WarmupService.getFailedKeys(batchId);
            res.json({
                success: true,
                data: failedKeys
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    async getRetryRecords(req, res) {
        try {
            const { cacheKeyId } = req.params;
            const retryRecords = await warmupService_1.WarmupService.getRetryRecords(cacheKeyId);
            res.json({
                success: true,
                data: retryRecords
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    },
    async getReport(req, res) {
        try {
            const { batchId } = req.params;
            const report = await warmupService_1.WarmupService.generateReport(batchId);
            res.json({
                success: true,
                data: report
            });
        }
        catch (error) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    },
    async exportBatch(req, res) {
        try {
            const { batchId } = req.params;
            const exportData = await warmupService_1.WarmupService.exportBatchData(batchId);
            const format = req.query.format;
            if (format === 'csv') {
                const csvData = [
                    Object.keys(exportData.records[0]).join(','),
                    ...exportData.records.map(record => Object.values(record).map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(','))
                ].join('\n');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="warmup_batch_${batchId}.csv"`);
                res.send(csvData);
            }
            else {
                res.json({
                    success: true,
                    data: exportData
                });
            }
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};
exports.NodeController = {
    async registerNode(req, res) {
        try {
            const { name, ip } = req.body;
            const node = await warmupService_1.NodeService.registerNode(name, ip);
            res.status(201).json({
                success: true,
                data: node
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async heartbeat(req, res) {
        try {
            const { nodeId } = req.params;
            const node = await warmupService_1.NodeService.heartbeat(nodeId);
            res.json({
                success: true,
                data: node
            });
        }
        catch (error) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    },
    async updateStatus(req, res) {
        try {
            const { nodeId } = req.params;
            const { status } = req.body;
            if (!Object.values(types_1.NodeStatus).includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid node status'
                });
            }
            const node = await warmupService_1.NodeService.updateNodeStatus(nodeId, status);
            res.json({
                success: true,
                data: node
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async listNodes(req, res) {
        try {
            const nodes = await warmupService_1.NodeService.listNodes();
            res.json({
                success: true,
                data: nodes
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};
exports.DataSourceController = {
    async createDataSource(req, res) {
        try {
            const { name, type, config } = req.body;
            const dataSource = await warmupService_1.DataSourceService.createDataSource(name, type, config);
            res.status(201).json({
                success: true,
                data: dataSource
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    },
    async listDataSources(req, res) {
        try {
            const dataSources = await warmupService_1.DataSourceService.listDataSources();
            res.json({
                success: true,
                data: dataSources
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
};
