"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importExportService = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const json2csv_1 = require("json2csv");
const uuid_1 = require("uuid");
const types_1 = require("../types");
const memory_1 = require("../storage/memory");
const correction_1 = require("./correction");
class ImportExportService {
    async importFromCsv(csvContent) {
        const batchId = (0, uuid_1.v4)();
        const results = [];
        const badRows = [];
        let successCount = 0;
        let rowNumber = 0;
        const stream = stream_1.Readable.from(csvContent);
        await new Promise((resolve) => {
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => {
                rowNumber++;
                results.push({ ...data, rowNumber });
            })
                .on('end', () => {
                resolve();
            });
        });
        for (const row of results) {
            try {
                const { video, user, trialRule, sourceSystem } = this.parseRow(row);
                await correction_1.correctionService.createCorrection({
                    video,
                    user,
                    trialRule,
                    sourceSystem,
                    sourceRecordId: String(row.sourceRecordId || ''),
                    operatorId: 'system',
                    operatorName: '批量导入'
                });
                successCount++;
            }
            catch (error) {
                const badRow = {
                    rowNumber: row.rowNumber,
                    rowData: row,
                    errorMessage: error instanceof Error ? error.message : '未知错误',
                    importedAt: new Date().toISOString(),
                    batchId,
                    id: (0, uuid_1.v4)()
                };
                badRows.push(badRow);
                await memory_1.memoryStorage.addBadRow(badRow);
            }
        }
        return {
            success: successCount,
            failed: badRows.length,
            badRows,
            batchId
        };
    }
    parseRow(row) {
        const requiredFields = [
            'videoId', 'videoTitle',
            'userId', 'userName', 'userType',
            'ruleId', 'ruleName', 'ruleVersion', 'effectiveTime',
            'sourceSystem'
        ];
        for (const field of requiredFields) {
            if (!row[field]) {
                throw new Error(`缺失必填字段: ${field}`);
            }
        }
        const video = {
            videoId: String(row.videoId),
            videoTitle: String(row.videoTitle),
            videoDuration: row.videoDuration ? Number(row.videoDuration) : undefined,
            videoCategory: row.videoCategory ? String(row.videoCategory) : undefined
        };
        const userType = String(row.userType);
        if (!['free', 'paid', 'vip'].includes(userType)) {
            throw new Error(`无效的用户类型: ${userType}`);
        }
        const user = {
            userId: String(row.userId),
            userName: String(row.userName),
            userType,
            isPaid: userType !== 'free'
        };
        const trialRule = {
            ruleId: String(row.ruleId),
            ruleName: String(row.ruleName),
            ruleVersion: String(row.ruleVersion),
            trialDuration: row.trialDuration ? Number(row.trialDuration) : undefined,
            trialCount: row.trialCount ? Number(row.trialCount) : undefined,
            effectiveTime: String(row.effectiveTime)
        };
        const sourceSystem = String(row.sourceSystem);
        if (!Object.values(types_1.SourceSystem).includes(sourceSystem)) {
            throw new Error(`无效的来源系统: ${sourceSystem}`);
        }
        return { video, user, trialRule, sourceSystem };
    }
    async exportToCsv(status, sourceSystem) {
        const records = await this.getRecordsForExport(status, sourceSystem);
        const flattenedRecords = records.map(record => this.flattenRecord(record));
        const fields = [
            'id',
            'video.videoId',
            'video.videoTitle',
            'video.videoDuration',
            'video.videoCategory',
            'user.userId',
            'user.userName',
            'user.userType',
            'user.isPaid',
            'trialRule.ruleId',
            'trialRule.ruleName',
            'trialRule.ruleVersion',
            'trialRule.trialDuration',
            'trialRule.trialCount',
            'trialRule.effectiveTime',
            'status',
            'correctionReason',
            'readableReason',
            'sourceSystem',
            'sourceRecordId',
            'conflictInfo.hasConflict',
            'operatorId',
            'operatorName',
            'createdAt',
            'updatedAt',
            'remark'
        ];
        const parser = new json2csv_1.Parser({ fields });
        return parser.parse(flattenedRecords);
    }
    async getRecordsForExport(status, sourceSystem) {
        const allRecords = await memory_1.memoryStorage.getAllRecords();
        return allRecords.filter(record => {
            if (status && record.status !== status)
                return false;
            if (sourceSystem && record.sourceSystem !== sourceSystem)
                return false;
            return true;
        });
    }
    flattenRecord(record) {
        return {
            id: record.id,
            'video.videoId': record.video.videoId,
            'video.videoTitle': record.video.videoTitle,
            'video.videoDuration': record.video.videoDuration ?? '',
            'video.videoCategory': record.video.videoCategory ?? '',
            'user.userId': record.user.userId,
            'user.userName': record.user.userName,
            'user.userType': record.user.userType,
            'user.isPaid': record.user.isPaid,
            'trialRule.ruleId': record.trialRule.ruleId,
            'trialRule.ruleName': record.trialRule.ruleName,
            'trialRule.ruleVersion': record.trialRule.ruleVersion,
            'trialRule.trialDuration': record.trialRule.trialDuration ?? '',
            'trialRule.trialCount': record.trialRule.trialCount ?? '',
            'trialRule.effectiveTime': record.trialRule.effectiveTime,
            status: record.status,
            correctionReason: record.correctionReason,
            readableReason: record.readableReason,
            sourceSystem: record.sourceSystem,
            sourceRecordId: record.sourceRecordId ?? '',
            'conflictInfo.hasConflict': record.conflictInfo?.hasConflict ?? false,
            operatorId: record.operatorId ?? '',
            operatorName: record.operatorName ?? '',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            remark: record.remark ?? ''
        };
    }
}
exports.importExportService = new ImportExportService();
