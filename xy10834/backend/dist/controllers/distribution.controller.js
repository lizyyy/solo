"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishVersion = publishVersion;
exports.getAllVersions = getAllVersions;
exports.getVersions = getVersions;
exports.getVersionDetail = getVersionDetail;
exports.forceRefresh = forceRefresh;
const distribution_service_1 = __importDefault(require("../services/distribution.service"));
async function publishVersion(req, res, next) {
    try {
        const result = await distribution_service_1.default.publishVersion(req.body);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getAllVersions(req, res, next) {
    try {
        const result = await distribution_service_1.default.getAllVersions({
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 20,
            configId: req.query.configId,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getVersions(req, res, next) {
    try {
        const result = await distribution_service_1.default.getVersions(req.params.configId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getVersionDetail(req, res, next) {
    try {
        const result = await distribution_service_1.default.getVersionDetail(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function forceRefresh(req, res, next) {
    try {
        const result = await distribution_service_1.default.forceRefresh(req.params.configId);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
