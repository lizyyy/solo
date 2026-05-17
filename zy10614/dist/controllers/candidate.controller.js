"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidateController = exports.CandidateController = void 0;
const candidate_service_1 = require("../services/candidate.service");
const import_service_1 = require("../services/import.service");
const export_service_1 = require("../services/export.service");
class CandidateController {
    async create(req, res) {
        try {
            const result = candidate_service_1.candidateService.createCandidate(req.body);
            res.status(201).json({
                success: true,
                data: result.candidate,
                message: result.conflicts.length > 0
                    ? `发现 ${result.conflicts.length} 个重复候选人，需审核处理`
                    : '创建成功'
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '创建失败'
            });
        }
    }
    async get(req, res) {
        const { id } = req.params;
        const candidate = candidate_service_1.candidateService.getCandidate(id);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: '候选人不存在'
            });
        }
        const history = candidate_service_1.candidateService.getMergeHistory(id);
        res.json({
            success: true,
            data: {
                candidate,
                mergeHistory: history
            }
        });
    }
    async update(req, res) {
        const { id } = req.params;
        const candidate = candidate_service_1.candidateService.updateCandidate(id, req.body);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: '候选人不存在'
            });
        }
        res.json({
            success: true,
            data: candidate
        });
    }
    async list(req, res) {
        const query = {
            status: req.query.status,
            sourceChannel: req.query.sourceChannel,
            keyword: req.query.keyword,
            page: req.query.page ? parseInt(req.query.page) : 1,
            pageSize: req.query.pageSize ? parseInt(req.query.pageSize) : 20
        };
        const result = candidate_service_1.candidateService.listCandidates(query);
        res.json({
            success: true,
            data: result.data,
            pagination: {
                total: result.total,
                page: result.page,
                pageSize: result.pageSize
            }
        });
    }
    async review(req, res) {
        try {
            const candidate = candidate_service_1.candidateService.reviewCandidate(req.body);
            if (!candidate) {
                return res.status(404).json({
                    success: false,
                    message: '候选人不存在'
                });
            }
            res.json({
                success: true,
                data: candidate,
                message: '审核成功'
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '审核失败'
            });
        }
    }
    async getHistory(req, res) {
        const { id } = req.params;
        const history = candidate_service_1.candidateService.getMergeHistory(id);
        res.json({
            success: true,
            data: history
        });
    }
    async getAllHistory(req, res) {
        const history = candidate_service_1.candidateService.getAllMergeHistories();
        res.json({
            success: true,
            data: history
        });
    }
    async importCsv(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: '请上传CSV文件'
                });
            }
            const result = await import_service_1.importService.importFromCsv(req.file.originalname, req.file.buffer);
            res.json({
                success: true,
                data: result,
                message: `导入完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`
            });
        }
        catch (error) {
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : '导入失败'
            });
        }
    }
    async getImportRecords(req, res) {
        const records = import_service_1.importService.getAllImportRecords();
        res.json({
            success: true,
            data: records
        });
    }
    async getImportRecord(req, res) {
        const { id } = req.params;
        const record = import_service_1.importService.getImportRecord(id);
        if (!record) {
            return res.status(404).json({
                success: false,
                message: '导入记录不存在'
            });
        }
        res.json({
            success: true,
            data: record
        });
    }
    async exportCsv(req, res) {
        const query = {
            status: req.query.status,
            sourceChannel: req.query.sourceChannel,
            keyword: req.query.keyword
        };
        const csv = export_service_1.exportService.exportToCsv(query);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=candidates_${Date.now()}.csv`);
        res.send(csv);
    }
    async exportJson(req, res) {
        const query = {
            status: req.query.status,
            sourceChannel: req.query.sourceChannel,
            keyword: req.query.keyword
        };
        const data = export_service_1.exportService.exportToJson(query);
        res.json({
            success: true,
            data
        });
    }
}
exports.CandidateController = CandidateController;
exports.candidateController = new CandidateController();
