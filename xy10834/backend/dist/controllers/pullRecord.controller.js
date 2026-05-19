"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportPullResult = reportPullResult;
exports.getPullRecords = getPullRecords;
exports.getFailedRecords = getFailedRecords;
exports.retryFailed = retryFailed;
exports.detectOldValues = detectOldValues;
const pullRecord_service_1 = __importDefault(require("../services/pullRecord.service"));
async function reportPullResult(req, res, next) {
    try {
        const result = await pullRecord_service_1.default.reportPullResult(req.body);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getPullRecords(req, res, next) {
    try {
        const result = await pullRecord_service_1.default.findAll({
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            configId: req.query.configId,
            instanceId: req.query.instanceId,
            pullStatus: req.query.pullStatus,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getFailedRecords(req, res, next) {
    try {
        const result = await pullRecord_service_1.default.getFailedRecords(req.query.configId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function retryFailed(req, res, next) {
    try {
        const result = await pullRecord_service_1.default.retryFailed(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function detectOldValues(req, res, next) {
    try {
        const result = await pullRecord_service_1.default.detectOldValues(req.params.configId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
