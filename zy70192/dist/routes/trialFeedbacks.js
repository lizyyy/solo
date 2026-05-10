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
const trialFeedbackService = __importStar(require("../services/trialFeedbackService"));
const router = (0, express_1.Router)();
const DEFAULT_OPERATOR = 'system';
const getOperator = (req) => {
    return req.header('x-operator') || DEFAULT_OPERATOR;
};
router.post('/', (req, res) => {
    try {
        const { sampleId, trialUser, trialDate, trialPeriod, trialLocation, testItems, overallRating, conclusion, suggestions, attachments } = req.body;
        if (!sampleId || !trialUser || !trialDate || !trialPeriod || !trialLocation || !testItems || !overallRating || !conclusion) {
            return res.status(400).json((0, response_1.errorResponse)('缺少必要参数'));
        }
        const feedback = trialFeedbackService.createTrialFeedback({
            sampleId,
            trialUser,
            trialDate,
            trialPeriod,
            trialLocation,
            testItems,
            overallRating,
            conclusion,
            suggestions,
            attachments
        }, getOperator(req));
        res.status(201).json((0, response_1.successResponse)(feedback, '试用反馈提交成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Create trial feedback error:', error);
        res.status(500).json((0, response_1.errorResponse)('提交试用反馈失败'));
    }
});
router.get('/', (req, res) => {
    try {
        const { sampleId, trialUser, minRating, maxRating, page, pageSize } = req.query;
        const result = trialFeedbackService.listTrialFeedbacks({
            sampleId: sampleId,
            trialUser: trialUser,
            minRating: minRating ? parseInt(minRating) : undefined,
            maxRating: maxRating ? parseInt(maxRating) : undefined
        }, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        console.error('List trial feedbacks error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取试用反馈列表失败'));
    }
});
router.get('/summary', (req, res) => {
    try {
        const { sampleId } = req.query;
        const summary = trialFeedbackService.getTrialFeedbackSummary(sampleId);
        res.json((0, response_1.successResponse)(summary));
    }
    catch (error) {
        console.error('Get trial feedback summary error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取汇总信息失败'));
    }
});
router.get('/:id', (req, res) => {
    try {
        const feedback = trialFeedbackService.getTrialFeedbackById(req.params.id);
        res.json((0, response_1.successResponse)(feedback));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get trial feedback error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取试用反馈失败'));
    }
});
router.get('/sample/:sampleId', (req, res) => {
    try {
        const feedbacks = trialFeedbackService.getTrialFeedbacksBySample(req.params.sampleId);
        res.json((0, response_1.successResponse)(feedbacks));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get trial feedbacks by sample error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取样品试用反馈失败'));
    }
});
exports.default = router;
