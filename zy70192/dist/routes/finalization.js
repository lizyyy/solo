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
const finalizationService = __importStar(require("../services/finalizationService"));
const router = (0, express_1.Router)();
const DEFAULT_OPERATOR = 'system';
const getOperator = (req) => {
    return req.header('x-operator') || DEFAULT_OPERATOR;
};
router.post('/finalize', (req, res) => {
    try {
        const { sampleId, finalQuantity, finalUnitPrice, remarks, attachments } = req.body;
        if (!sampleId || finalQuantity === undefined || finalUnitPrice === undefined) {
            return res.status(400).json((0, response_1.errorResponse)('缺少必要参数: sampleId, finalQuantity, finalUnitPrice'));
        }
        const record = finalizationService.finalizeSample({ sampleId, finalQuantity, finalUnitPrice, remarks, attachments }, getOperator(req));
        res.status(201).json((0, response_1.successResponse)(record, '样品定版成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Finalize sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('样品定版失败'));
    }
});
router.get('/finalizations', (req, res) => {
    try {
        const { sampleId, approvedBy, startTime, endTime, page, pageSize } = req.query;
        const result = finalizationService.listFinalizations({
            sampleId: sampleId,
            approvedBy: approvedBy,
            startTime: startTime,
            endTime: endTime
        }, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        console.error('List finalizations error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取定版记录列表失败'));
    }
});
router.get('/finalizations/:id', (req, res) => {
    try {
        const record = finalizationService.getFinalizationById(req.params.id);
        res.json((0, response_1.successResponse)(record));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get finalization error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取定版记录失败'));
    }
});
router.get('/finalizations/sample/:sampleId', (req, res) => {
    try {
        const record = finalizationService.getFinalizationBySample(req.params.sampleId);
        if (!record) {
            return res.status(404).json((0, response_1.errorResponse)('该样品没有定版记录'));
        }
        res.json((0, response_1.successResponse)(record));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get finalization by sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品定版记录失败'));
    }
});
router.post('/returns', (req, res) => {
    try {
        const { sampleId, returnType, returnReason, returnQuantity, trackingNo, remarks } = req.body;
        if (!sampleId || !returnType || !returnReason || !returnQuantity) {
            return res.status(400).json((0, response_1.errorResponse)('缺少必要参数: sampleId, returnType, returnReason, returnQuantity'));
        }
        const record = finalizationService.createReturnRecord({ sampleId, returnType, returnReason, returnQuantity, trackingNo, remarks }, getOperator(req));
        res.status(201).json((0, response_1.successResponse)(record, '退样记录创建成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Create return record error:', error);
        res.status(500).json((0, response_1.errorResponse)('创建退样记录失败'));
    }
});
router.get('/returns', (req, res) => {
    try {
        const { sampleId, returnType, returnedBy, startTime, endTime, isReceived, page, pageSize } = req.query;
        const result = finalizationService.listReturnRecords({
            sampleId: sampleId,
            returnType: returnType,
            returnedBy: returnedBy,
            startTime: startTime,
            endTime: endTime,
            isReceived: isReceived === 'true' ? true : isReceived === 'false' ? false : undefined
        }, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        console.error('List return records error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取退样记录列表失败'));
    }
});
router.get('/returns/:id', (req, res) => {
    try {
        const record = finalizationService.getReturnRecordById(req.params.id);
        res.json((0, response_1.successResponse)(record));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get return record error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取退样记录失败'));
    }
});
router.get('/returns/sample/:sampleId', (req, res) => {
    try {
        const records = finalizationService.getReturnRecordsBySample(req.params.sampleId);
        res.json((0, response_1.successResponse)(records));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get return records by sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品退样记录失败'));
    }
});
router.post('/returns/:id/confirm', (req, res) => {
    try {
        const record = finalizationService.confirmReturnReceipt(req.params.id, getOperator(req));
        res.json((0, response_1.successResponse)(record, '退样签收确认成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Confirm return receipt error:', error);
        res.status(500).json((0, response_1.errorResponse)('确认退样签收失败'));
    }
});
exports.default = router;
