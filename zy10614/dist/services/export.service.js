"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = exports.ExportService = void 0;
const json2csv_1 = require("json2csv");
const types_1 = require("../types");
const candidate_service_1 = require("./candidate.service");
class ExportService {
    mapStatusToChinese(status) {
        const statusMap = {
            [types_1.CandidateStatus.PENDING_MERGE]: '待合并',
            [types_1.CandidateStatus.CONFLICT_REVIEW]: '冲突待审',
            [types_1.CandidateStatus.MERGED]: '已合并',
            [types_1.CandidateStatus.KEEP_INDEPENDENT]: '保留独立'
        };
        return statusMap[status] || status;
    }
    mapSourceChannelToChinese(channel) {
        const channelMap = {
            [types_1.SourceChannel.HEADHUNTER]: '猎头',
            [types_1.SourceChannel.OFFICIAL_WEBSITE]: '官网',
            [types_1.SourceChannel.INTERNAL_RECOMMENDATION]: '内推',
            [types_1.SourceChannel.ZHAOPIN]: '智联',
            [types_1.SourceChannel.LIEPIN]: '猎聘',
            [types_1.SourceChannel.BOSS]: 'BOSS直聘',
            [types_1.SourceChannel.OTHER]: '其他'
        };
        return channelMap[channel] || channel;
    }
    formatDate(date) {
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }
    candidateToExportFormat(candidate) {
        return {
            '候选人ID': candidate.id,
            '姓名': candidate.name,
            '手机号': candidate.phone,
            '邮箱': candidate.email,
            '来源渠道': this.mapSourceChannelToChinese(candidate.sourceChannel),
            '状态': this.mapStatusToChinese(candidate.status),
            '应聘职位': candidate.position,
            '创建时间': this.formatDate(candidate.createdAt),
            '更新时间': this.formatDate(candidate.updatedAt),
            '合并到候选人ID': candidate.mergedIntoId,
            '冲突候选人ID': candidate.conflictCandidateIds?.join(', ')
        };
    }
    exportToCsv(query) {
        const result = candidate_service_1.candidateService.listCandidates({
            ...query,
            page: 1,
            pageSize: 10000
        });
        const exportData = result.data.map(c => this.candidateToExportFormat(c));
        const fields = [
            '候选人ID',
            '姓名',
            '手机号',
            '邮箱',
            '来源渠道',
            '状态',
            '应聘职位',
            '创建时间',
            '更新时间',
            '合并到候选人ID',
            '冲突候选人ID'
        ];
        const parser = new json2csv_1.Parser({ fields });
        return '\uFEFF' + parser.parse(exportData);
    }
    exportToJson(query) {
        const result = candidate_service_1.candidateService.listCandidates({
            ...query,
            page: 1,
            pageSize: 10000
        });
        return result.data.map(c => this.candidateToExportFormat(c));
    }
}
exports.ExportService = ExportService;
exports.exportService = new ExportService();
