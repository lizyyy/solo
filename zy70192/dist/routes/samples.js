"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const response_1 = require("../utils/response");
const sampleService = __importStar(require("../services/sampleService"));
const historyService = __importStar(require("../services/historyService"));
const router = (0, express_1.Router)();
const DEFAULT_OPERATOR = 'system';
const getOperator = (req) => {
    return req.header('x-operator') || DEFAULT_OPERATOR;
};
router.post('/', (req, res) => {
    try {
        const { name, supplier, category, quantity, unitPrice } = req.body;
        if (!name || !supplier || !category) {
            return res.status(400).json((0, response_1.errorResponse)('缺少必要参数: name, supplier, category'));
        }
        if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 0)) {
            return res.status(400).json((0, response_1.errorResponse)('quantity 必须是非负数字'));
        }
        if (unitPrice !== undefined && (typeof unitPrice !== 'number' || unitPrice < 0)) {
            return res.status(400).json((0, response_1.errorResponse)('unitPrice 必须是非负数字'));
        }
        const sample = sampleService.createSample({ name, supplier, category, quantity: quantity || 1, unitPrice: unitPrice || 0 }, getOperator(req));
        res.status(201).json((0, response_1.successResponse)(sample, '样品创建成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Create sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('创建样品失败'));
    }
});
router.get('/', (req, res) => {
    try {
        const { status, category, supplier, isFrozen, keyword, page, pageSize } = req.query;
        const result = sampleService.listSamples({
            status: status,
            category: category,
            supplier: supplier,
            isFrozen: isFrozen === 'true' ? true : isFrozen === 'false' ? false : undefined,
            keyword: keyword
        }, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('List samples error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品列表失败'));
    }
});
router.get('/summary', (req, res) => {
    try {
        const summary = sampleService.getSampleSummary();
        res.json((0, response_1.successResponse)(summary));
    }
    catch (error) {
        console.error('Get sample summary error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取汇总信息失败'));
    }
});
router.get('/:id', (req, res) => {
    try {
        const sample = sampleService.getSampleById(req.params.id);
        res.json((0, response_1.successResponse)(sample));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品信息失败'));
    }
});
router.get('/by-no/:sampleNo', (req, res) => {
    try {
        const sample = sampleService.getSampleByNo(req.params.sampleNo);
        res.json((0, response_1.successResponse)(sample));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get sample by no error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品信息失败'));
    }
});
router.patch('/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json((0, response_1.errorResponse)('缺少参数: status'));
        }
        const sample = sampleService.updateSampleStatus(req.params.id, status, getOperator(req));
        res.json((0, response_1.successResponse)(sample, '状态更新成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Update sample status error:', error);
        res.status(500).json((0, response_1.errorResponse)('更新状态失败'));
    }
});
router.patch('/:id/info', (req, res) => {
    try {
        const { name, supplier, category, quantity, unitPrice } = req.body;
        const sample = sampleService.updateSampleInfo(req.params.id, { name, supplier, category, quantity, unitPrice }, getOperator(req));
        res.json((0, response_1.successResponse)(sample, '样品信息更新成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Update sample info error:', error);
        res.status(500).json((0, response_1.errorResponse)('更新样品信息失败'));
    }
});
router.post('/:id/freeze', (req, res) => {
    try {
        const sample = sampleService.freezeSample(req.params.id, getOperator(req));
        res.json((0, response_1.successResponse)(sample, '样品已冻结'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Freeze sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('冻结样品失败'));
    }
});
router.post('/:id/unfreeze', (req, res) => {
    try {
        const sample = sampleService.unfreezeSample(req.params.id, getOperator(req));
        res.json((0, response_1.successResponse)(sample, '样品已解冻'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Unfreeze sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('解冻样品失败'));
    }
});
router.get('/:id/history', (req, res) => {
    try {
        const history = historyService.getHistoryByEntity('SAMPLE', req.params.id);
        res.json((0, response_1.successResponse)(history));
    }
    catch (error) {
        console.error('Get sample history error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取历史记录失败'));
    }
});
exports.default = router;
