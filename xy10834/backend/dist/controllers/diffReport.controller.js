"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDiffReport = generateDiffReport;
exports.getConfigVersions = getConfigVersions;
exports.getDiffReports = getDiffReports;
exports.getDiffReport = getDiffReport;
exports.exportReportToCSV = exportReportToCSV;
exports.exportEffectiveStatesToCSV = exportEffectiveStatesToCSV;
const diffReport_service_1 = __importDefault(require("../services/diffReport.service"));
async function generateDiffReport(req, res, next) {
    try {
        const result = await diffReport_service_1.default.generateReport(req.body);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getConfigVersions(req, res, next) {
    try {
        const result = await diffReport_service_1.default.getConfigVersions(req.params.key);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function getDiffReports(req, res, next) {
    try {
        const result = await diffReport_service_1.default.findAll({
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
async function getDiffReport(req, res, next) {
    try {
        const result = await diffReport_service_1.default.findById(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
}
async function exportReportToCSV(req, res, next) {
    try {
        const filePath = await diffReport_service_1.default.exportToCSV(req.params.id);
        res.download(filePath, (err) => {
            if (err) {
                next(err);
            }
        });
    }
    catch (error) {
        next(error);
    }
}
async function exportEffectiveStatesToCSV(req, res, next) {
    try {
        const filePath = await diffReport_service_1.default.exportEffectiveStatesCSV(req.params.configId);
        res.download(filePath, (err) => {
            if (err) {
                next(err);
            }
        });
    }
    catch (error) {
        next(error);
    }
}
