"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatistics = getStatistics;
exports.getRecentActivity = getRecentActivity;
exports.getFailedDetails = getFailedDetails;
const overview_service_1 = __importDefault(require("../services/overview.service"));
async function getStatistics(req, res, next) {
    try {
        const result = await overview_service_1.default.getStatistics();
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getRecentActivity(req, res, next) {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const result = await overview_service_1.default.getRecentActivity(limit);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getFailedDetails(req, res, next) {
    try {
        const result = await overview_service_1.default.getFailedDetails();
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
