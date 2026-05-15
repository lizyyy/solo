"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const handoverService_1 = require("../services/handoverService");
const router = express_1.default.Router();
router.post('/', (req, res) => {
    try {
        const request = req.body;
        const requiredFields = ['tenantId', 'tenantName', 'handler', 'serviceRecords'];
        const missingFields = requiredFields.filter(f => !(f in request));
        if (missingFields.length > 0) {
            const response = {
                code: 400,
                message: '缺少必填字段',
                errors: missingFields.map(f => `字段 ${f} 不能为空`)
            };
            return res.status(400).json(response);
        }
        if (!Array.isArray(request.serviceRecords) || request.serviceRecords.length === 0) {
            const response = {
                code: 400,
                message: 'serviceRecords 必须是非空数组'
            };
            return res.status(400).json(response);
        }
        const form = handoverService_1.handoverService.createHandoverForm(request);
        const response = {
            code: 200,
            message: '交接单创建成功',
            data: form
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '创建交接单失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(500).json(response);
    }
});
router.get('/', (req, res) => {
    try {
        const forms = handoverService_1.handoverService.getAllHandoverForms();
        const response = {
            code: 200,
            message: '获取交接单列表成功',
            data: forms
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '获取交接单列表失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(500).json(response);
    }
});
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const form = handoverService_1.handoverService.getHandoverForm(id);
        if (!form) {
            const response = {
                code: 404,
                message: `交接单不存在: ${id}`
            };
            return res.status(404).json(response);
        }
        const response = {
            code: 200,
            message: '获取交接单成功',
            data: form
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '获取交接单失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(500).json(response);
    }
});
router.post('/:id/process', (req, res) => {
    try {
        const { id } = req.params;
        const form = handoverService_1.handoverService.processHandoverForm(id);
        const response = {
            code: 200,
            message: '交接单处理成功',
            data: form
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 400,
            message: '处理交接单失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(400).json(response);
    }
});
router.post('/:id/manual-fix', (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const requiredFields = ['serviceRecordId', 'manualConclusion', 'remark', 'operator'];
        const missingFields = requiredFields.filter(f => !(f in request));
        if (missingFields.length > 0) {
            const response = {
                code: 400,
                message: '缺少必填字段',
                errors: missingFields.map(f => `字段 ${f} 不能为空`)
            };
            return res.status(400).json(response);
        }
        const form = handoverService_1.handoverService.manualFix(id, request);
        const response = {
            code: 200,
            message: '人工修正成功',
            data: form
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 400,
            message: '人工修正失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(400).json(response);
    }
});
router.post('/:id/material-summary', (req, res) => {
    try {
        const { id } = req.params;
        const request = req.body;
        const requiredFields = ['serviceRecordId', 'type', 'content'];
        const missingFields = requiredFields.filter(f => !(f in request));
        if (missingFields.length > 0) {
            const response = {
                code: 400,
                message: '缺少必填字段',
                errors: missingFields.map(f => `字段 ${f} 不能为空`)
            };
            return res.status(400).json(response);
        }
        const form = handoverService_1.handoverService.addMaterialSummary(id, request.serviceRecordId, request.type, request.content);
        const response = {
            code: 200,
            message: '添加材料摘要成功',
            data: form
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 400,
            message: '添加材料摘要失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(400).json(response);
    }
});
router.get('/history/all', (req, res) => {
    try {
        const history = handoverService_1.handoverService.getAllHistory();
        const response = {
            code: 200,
            message: '获取历史记录成功',
            data: history
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '获取历史记录失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(500).json(response);
    }
});
router.get('/history/query', (req, res) => {
    try {
        const { resourceRange } = req.query;
        if (!resourceRange || typeof resourceRange !== 'string') {
            const response = {
                code: 400,
                message: 'resourceRange 参数必填'
            };
            return res.status(400).json(response);
        }
        const history = handoverService_1.handoverService.getHistoryByResourceRange(resourceRange);
        const response = {
            code: 200,
            message: '查询历史记录成功',
            data: history
        };
        res.status(200).json(response);
    }
    catch (error) {
        const response = {
            code: 500,
            message: '查询历史记录失败',
            errors: [error instanceof Error ? error.message : '未知错误']
        };
        res.status(500).json(response);
    }
});
exports.default = router;
