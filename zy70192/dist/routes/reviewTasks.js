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
const reviewTaskService = __importStar(require("../services/reviewTaskService"));
const router = (0, express_1.Router)();
const DEFAULT_OPERATOR = 'system';
const getOperator = (req) => {
    return req.header('x-operator') || DEFAULT_OPERATOR;
};
router.post('/', (req, res) => {
    try {
        const { sampleId, assignee, taskType, priority, dueDate } = req.body;
        if (!sampleId || !assignee || !taskType) {
            return res.status(400).json((0, response_1.errorResponse)('缺少必要参数: sampleId, assignee, taskType'));
        }
        const task = reviewTaskService.createReviewTask({ sampleId, assignee, taskType, priority, dueDate }, getOperator(req));
        res.status(201).json((0, response_1.successResponse)(task, '评审任务创建成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Create review task error:', error);
        res.status(500).json((0, response_1.errorResponse)('创建评审任务失败'));
    }
});
router.get('/', (req, res) => {
    try {
        const { sampleId, assignee, status, taskType, priority, page, pageSize } = req.query;
        const result = reviewTaskService.listReviewTasks({
            sampleId: sampleId,
            assignee: assignee,
            status: status,
            taskType: taskType,
            priority: priority
        }, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        console.error('List review tasks error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取评审任务列表失败'));
    }
});
router.get('/summary', (req, res) => {
    try {
        const { assignee } = req.query;
        const summary = reviewTaskService.getReviewTaskSummary(assignee);
        res.json((0, response_1.successResponse)(summary));
    }
    catch (error) {
        console.error('Get review task summary error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取汇总信息失败'));
    }
});
router.get('/:id', (req, res) => {
    try {
        const task = reviewTaskService.getReviewTaskById(req.params.id);
        res.json((0, response_1.successResponse)(task));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get review task error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取评审任务失败'));
    }
});
router.patch('/:id/status', (req, res) => {
    try {
        const { status, opinion, rating } = req.body;
        if (!status) {
            return res.status(400).json((0, response_1.errorResponse)('缺少参数: status'));
        }
        const task = reviewTaskService.updateReviewTaskStatus(req.params.id, status, getOperator(req), { opinion, rating });
        res.json((0, response_1.successResponse)(task, '任务状态更新成功'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Update review task status error:', error);
        res.status(500).json((0, response_1.errorResponse)('更新任务状态失败'));
    }
});
exports.default = router;
