"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whitelistController = exports.WhitelistController = void 0;
const whitelist_service_1 = require("../services/whitelist.service");
class WhitelistController {
    async create(req, res) {
        try {
            const request = {
                ...req.body,
                effectiveDate: new Date(req.body.effectiveDate),
                expiryDate: new Date(req.body.expiryDate)
            };
            const record = whitelist_service_1.whitelistService.create(request);
            res.status(201).json({
                success: true,
                data: record,
                message: '创建成功'
            });
        }
        catch (error) {
            if (error instanceof whitelist_service_1.WhitelistValidationError) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: '服务器内部错误'
                });
            }
        }
    }
    async findAll(req, res) {
        try {
            const { tenantId, apiGroupId, status } = req.query;
            const filters = {
                tenantId: tenantId,
                apiGroupId: apiGroupId,
                status: status
            };
            const records = whitelist_service_1.whitelistService.findAll(filters);
            res.json({
                success: true,
                data: records,
                total: records.length
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
    async findById(req, res) {
        try {
            const { id } = req.params;
            const record = whitelist_service_1.whitelistService.findById(id);
            if (!record) {
                res.status(404).json({
                    success: false,
                    message: '记录不存在'
                });
                return;
            }
            res.json({
                success: true,
                data: record
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
    async update(req, res) {
        try {
            const { id } = req.params;
            const { operator, ...updates } = req.body;
            if (updates.effectiveDate) {
                updates.effectiveDate = new Date(updates.effectiveDate);
            }
            if (updates.expiryDate) {
                updates.expiryDate = new Date(updates.expiryDate);
            }
            const record = whitelist_service_1.whitelistService.update(id, updates, operator);
            res.json({
                success: true,
                data: record,
                message: '更新成功'
            });
        }
        catch (error) {
            if (error instanceof whitelist_service_1.WhitelistValidationError) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: '服务器内部错误'
                });
            }
        }
    }
    async approve(req, res) {
        try {
            const { id } = req.params;
            const record = whitelist_service_1.whitelistService.approve(id, req.body);
            res.json({
                success: true,
                data: record,
                message: '审批通过'
            });
        }
        catch (error) {
            if (error instanceof whitelist_service_1.WhitelistValidationError) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: '服务器内部错误'
                });
            }
        }
    }
    async reject(req, res) {
        try {
            const { id } = req.params;
            const { approver, remark } = req.body;
            const record = whitelist_service_1.whitelistService.reject(id, approver, remark);
            res.json({
                success: true,
                data: record,
                message: '已拒绝'
            });
        }
        catch (error) {
            if (error instanceof whitelist_service_1.WhitelistValidationError) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: '服务器内部错误'
                });
            }
        }
    }
    async revoke(req, res) {
        try {
            const { id } = req.params;
            const { operator, remark } = req.body;
            const record = whitelist_service_1.whitelistService.revoke(id, operator, remark);
            res.json({
                success: true,
                data: record,
                message: '已撤回'
            });
        }
        catch (error) {
            if (error instanceof whitelist_service_1.WhitelistValidationError) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: '服务器内部错误'
                });
            }
        }
    }
    async resubmit(req, res) {
        try {
            const { id } = req.params;
            const { operator } = req.body;
            const record = whitelist_service_1.whitelistService.resubmit(id, operator);
            res.json({
                success: true,
                data: record,
                message: '重新提交成功'
            });
        }
        catch (error) {
            if (error instanceof whitelist_service_1.WhitelistValidationError) {
                res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    message: '服务器内部错误'
                });
            }
        }
    }
    async getHistories(req, res) {
        try {
            const { id } = req.params;
            const histories = whitelist_service_1.whitelistService.getHistories(id);
            res.json({
                success: true,
                data: histories
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
    async checkWhitelist(req, res) {
        try {
            const { tenantId, apiGroupId } = req.query;
            const result = whitelist_service_1.whitelistService.checkWhitelist(tenantId, apiGroupId);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
    async bulkImport(req, res) {
        try {
            const data = req.body.map((item) => ({
                ...item,
                effectiveDate: new Date(item.effectiveDate),
                expiryDate: new Date(item.expiryDate)
            }));
            const result = whitelist_service_1.whitelistService.bulkImport(data);
            res.json({
                success: true,
                data: {
                    success: result.success,
                    failed: result.failed,
                    successCount: result.success.length,
                    failedCount: result.failed.length
                },
                message: `导入完成：成功${result.success.length}条，失败${result.failed.length}条`
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
    async export(req, res) {
        try {
            const records = whitelist_service_1.whitelistService.export();
            res.json({
                success: true,
                data: records,
                total: records.length
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
    async refreshStatuses(req, res) {
        try {
            whitelist_service_1.whitelistService.refreshStatuses();
            res.json({
                success: true,
                message: '状态刷新完成'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: '服务器内部错误'
            });
        }
    }
}
exports.WhitelistController = WhitelistController;
exports.whitelistController = new WhitelistController();
