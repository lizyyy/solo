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
const backgroundTaskService = __importStar(require("../services/backgroundTaskService"));
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    try {
        const { taskType, payload, maxRetries } = req.body;
        if (!taskType || !payload) {
            return res.status(400).json((0, response_1.errorResponse)('缺少必要参数: taskType, payload'));
        }
        const validTaskTypes = ['GENERATE_REPORT', 'SEND_NOTIFICATION', 'EXPORT_DATA', 'BATCH_UPDATE', 'SYNC_DATA'];
        if (!validTaskTypes.includes(taskType)) {
            return res.status(400).json((0, response_1.errorResponse)(`无效的任务类型: ${taskType}`));
        }
        const task = backgroundTaskService.createBackgroundTask(taskType, payload, maxRetries || 3);
        res.status(202).json((0, response_1.successResponse)(task, '后台任务已创建'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Create background task error:', error);
        res.status(500).json((0, response_1.errorResponse)('创建后台任务失败'));
    }
});
router.get('/', (req, res) => {
    try {
        const { status, taskType, page, pageSize } = req.query;
        const result = backgroundTaskService.listBackgroundTasks({
            status: status,
            taskType: taskType
        }, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json((0, response_1.successResponse)(result));
    }
    catch (error) {
        console.error('List background tasks error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取后台任务列表失败'));
    }
});
router.get('/status', (req, res) => {
    try {
        const status = backgroundTaskService.getTaskQueueStatus();
        res.json((0, response_1.successResponse)(status));
    }
    catch (error) {
        console.error('Get task queue status error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取任务队列状态失败'));
    }
});
router.post('/queue/start', (req, res) => {
    try {
        backgroundTaskService.startTaskQueue();
        res.json((0, response_1.successResponse)(backgroundTaskService.getTaskQueueStatus(), '任务队列已启动'));
    }
    catch (error) {
        console.error('Start task queue error:', error);
        res.status(500).json((0, response_1.errorResponse)('启动任务队列失败'));
    }
});
router.post('/queue/stop', (req, res) => {
    try {
        backgroundTaskService.stopTaskQueue();
        res.json((0, response_1.successResponse)(backgroundTaskService.getTaskQueueStatus(), '任务队列已停止'));
    }
    catch (error) {
        console.error('Stop task queue error:', error);
        res.status(500).json((0, response_1.errorResponse)('停止任务队列失败'));
    }
});
router.get('/:id', (req, res) => {
    try {
        const task = backgroundTaskService.getBackgroundTaskById(req.params.id);
        res.json((0, response_1.successResponse)(task));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Get background task error:', error);
        res.status(500).json((0, response_1.errorResponse)('获取后台任务失败'));
    }
});
router.post('/:id/retry', (req, res) => {
    try {
        const task = backgroundTaskService.retryBackgroundTask(req.params.id);
        res.json((0, response_1.successResponse)(task, '任务已重置，将重新执行'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Retry background task error:', error);
        res.status(500).json((0, response_1.errorResponse)('重试任务失败'));
    }
});
router.post('/:id/cancel', (req, res) => {
    try {
        const task = backgroundTaskService.cancelBackgroundTask(req.params.id);
        res.json((0, response_1.successResponse)(task, '任务已取消'));
    }
    catch (error) {
        if (error instanceof response_1.AppError) {
            return res.status(error.statusCode).json((0, response_1.errorResponse)(error.message, error.errorCode));
        }
        console.error('Cancel background task error:', error);
        res.status(500).json((0, response_1.errorResponse)('取消任务失败'));
    }
});
exports.default = router;
