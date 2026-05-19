"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportAdjudications = exportAdjudications;
exports.exportBadRecords = exportBadRecords;
exports.exportAuditLogs = exportAuditLogs;
exports.generateAdjudicationReport = generateAdjudicationReport;
const fs_1 = __importDefault(require("fs"));
const dao_1 = require("../database/dao");
const masking_1 = require("../security/masking");
function formatTime(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}
async function exportAdjudications(options, outputPath) {
    const adjudications = await dao_1.dao.getAllAdjudications();
    let processedData = adjudications;
    if (!options.includeSensitive) {
        processedData = adjudications.map(a => (0, masking_1.maskAdjudication)(a, options.userRole));
    }
    if (options.format === 'csv') {
        const csvContent = adjudicationsToCSV(processedData, options.includeSensitive, options.userRole);
        fs_1.default.writeFileSync(outputPath, csvContent, 'utf-8');
    }
    else {
        fs_1.default.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
    }
    await dao_1.dao.insertAuditLog({
        entityType: 'export',
        entityId: 0,
        action: 'export_adjudications',
        details: JSON.stringify({
            format: options.format,
            includeSensitive: options.includeSensitive,
            outputPath,
            recordCount: processedData.length
        }),
        operator: 'cli',
        timestamp: formatTime(new Date())
    });
    return processedData.length;
}
async function exportBadRecords(options, outputPath) {
    const badRecords = await dao_1.dao.getBadRecords();
    let processedData = badRecords;
    if (!options.includeSensitive) {
        processedData = badRecords.map(r => (0, masking_1.maskBadRecord)(r, options.userRole));
    }
    if (options.format === 'csv') {
        const csvContent = badRecordsToCSV(processedData);
        fs_1.default.writeFileSync(outputPath, csvContent, 'utf-8');
    }
    else {
        fs_1.default.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
    }
    return processedData.length;
}
async function exportAuditLogs(options, outputPath) {
    const auditLogs = await dao_1.dao.getAuditLogs();
    let processedData = auditLogs;
    if (!options.includeSensitive) {
        processedData = auditLogs.map(log => ({
            ...log,
            details: log.details ? (0, masking_1.maskAuditLogDetails)(log.details, options.userRole) : log.details
        }));
    }
    if (options.format === 'csv') {
        const csvContent = auditLogsToCSV(processedData);
        fs_1.default.writeFileSync(outputPath, csvContent, 'utf-8');
    }
    else {
        fs_1.default.writeFileSync(outputPath, JSON.stringify(processedData, null, 2), 'utf-8');
    }
    return processedData.length;
}
function adjudicationsToCSV(adjudications, includeSensitive, userRole) {
    const headers = [
        'ID',
        '申诉ID',
        '裁定结果',
        '置信度',
        '裁定理由',
        '裁定人',
        '裁定时间',
        '复核状态',
        '复核人',
        '复核时间',
        '复核备注'
    ];
    const resultLabels = {
        driver_fault: '司机责任',
        traffic_fault: '交通原因',
        parent_fault: '家长原因',
        system_error: '系统错误',
        undetermined: '待复核'
    };
    const reviewLabels = {
        confirmed: '已确认',
        overturned: '已推翻',
        pending_review: '待复核'
    };
    const rows = adjudications.map(a => [
        a.id,
        a.complaintId,
        resultLabels[a.result] || a.result,
        `${(a.confidence * 100).toFixed(1)}%`,
        a.reasons.join('; '),
        a.adjudicator,
        a.adjudicatedAt,
        reviewLabels[a.reviewStatus] || a.reviewStatus,
        a.reviewedBy || '',
        a.reviewedAt || '',
        a.reviewNotes || ''
    ]);
    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}
function badRecordsToCSV(badRecords) {
    const headers = [
        'ID',
        '来源类型',
        '原始数据',
        '行号',
        '失败原因',
        '修改建议',
        '创建时间'
    ];
    const sourceLabels = {
        schedule_csv: '站点时刻表CSV',
        gps_json: 'GPS JSON',
        complaint: '申诉单',
        checkin: '打卡记录'
    };
    const rows = badRecords.map(r => [
        r.id,
        sourceLabels[r.sourceType] || r.sourceType,
        r.rawData.substring(0, 100),
        r.rowNumber || '',
        r.failureReason,
        r.suggestedFix,
        r.createdAt || ''
    ]);
    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}
function auditLogsToCSV(auditLogs) {
    const headers = [
        'ID',
        '实体类型',
        '实体ID',
        '操作',
        '操作人',
        '时间',
        '详情'
    ];
    const rows = auditLogs.map(log => [
        log.id,
        log.entityType,
        log.entityId,
        log.action,
        log.operator,
        log.timestamp,
        (log.details || '').substring(0, 200)
    ]);
    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
}
async function generateAdjudicationReport(adjudicationId, outputPath) {
    const adjudication = await dao_1.dao.getAdjudicationByMatchId(adjudicationId);
    if (!adjudication) {
        throw new Error('裁定记录不存在');
    }
    const complaint = await dao_1.dao.getComplaintById(adjudication.complaintId);
    const match = await dao_1.dao.getMatchByComplaintId(adjudication.complaintId);
    const reportLines = [];
    reportLines.push('========================================');
    reportLines.push('         校车调度责任裁定报告           ');
    reportLines.push('========================================');
    reportLines.push('');
    reportLines.push('【申诉信息】');
    if (complaint) {
        reportLines.push(`申诉单号: ${complaint.complaintId}`);
        reportLines.push(`家长姓名: ${complaint.parentName}`);
        reportLines.push(`学生姓名: ${complaint.studentName}`);
        reportLines.push(`线路ID: ${complaint.routeId}`);
        reportLines.push(`站点ID: ${complaint.stopId}`);
        reportLines.push(`计划时间: ${complaint.scheduledDate} ${complaint.scheduledTime}`);
        reportLines.push(`申诉类型: ${complaint.complaintType}`);
        reportLines.push(`申诉描述: ${complaint.description}`);
    }
    reportLines.push('');
    reportLines.push('【匹配信息】');
    if (match) {
        reportLines.push(`匹配置信度: ${(match.matchConfidence * 100).toFixed(1)}%`);
        reportLines.push(`时间差异: ${match.timeDiscrepancyMinutes > 0 ? '晚' : '早'} ${Math.abs(match.timeDiscrepancyMinutes).toFixed(1)} 分钟`);
        reportLines.push(`距离差异: ${match.distanceDiscrepancyMeters.toFixed(1)} 米`);
        reportLines.push(`GPS记录数: ${match.gpsRecords.length}`);
        reportLines.push(`打卡记录数: ${match.checkinRecords.length}`);
    }
    reportLines.push('');
    reportLines.push('【裁定结果】');
    const resultLabels = {
        driver_fault: '司机责任',
        traffic_fault: '交通或路况原因',
        parent_fault: '家长原因',
        system_error: '系统错误',
        undetermined: '待人工复核'
    };
    reportLines.push(`裁定结果: ${resultLabels[adjudication.result] || adjudication.result}`);
    reportLines.push(`裁定置信度: ${(adjudication.confidence * 100).toFixed(1)}%`);
    reportLines.push(`裁定时间: ${adjudication.adjudicatedAt}`);
    reportLines.push(`裁定人: ${adjudication.adjudicator}`);
    reportLines.push('');
    reportLines.push('【裁定理由】');
    adjudication.reasons.forEach((reason, index) => {
        reportLines.push(`${index + 1}. ${reason}`);
    });
    reportLines.push('');
    if (adjudication.reviewStatus !== 'pending_review') {
        reportLines.push('【复核信息】');
        reportLines.push(`复核状态: ${adjudication.reviewStatus === 'confirmed' ? '已确认' : '已推翻'}`);
        reportLines.push(`复核人: ${adjudication.reviewedBy}`);
        if (adjudication.reviewNotes) {
            reportLines.push(`复核备注: ${adjudication.reviewNotes}`);
        }
        reportLines.push('');
    }
    reportLines.push('========================================');
    reportLines.push('报告生成时间: ' + formatTime(new Date()));
    reportLines.push('========================================');
    fs_1.default.writeFileSync(outputPath, reportLines.join('\n'), 'utf-8');
}
