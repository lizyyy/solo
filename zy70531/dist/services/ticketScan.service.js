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
exports.createScanRequest = createScanRequest;
exports.getScanRecordById = getScanRecordById;
exports.getScanRecordsByTicketId = getScanRecordsByTicketId;
exports.getAllScanRecords = getAllScanRecords;
exports.getScanRecordsByStatus = getScanRecordsByStatus;
exports.updateScanStatus = updateScanStatus;
exports.handleScanFailure = handleScanFailure;
exports.manualCorrection = manualCorrection;
exports.exportScanRecords = exportScanRecords;
exports.generateExportSummary = generateExportSummary;
const ticketScanDao = __importStar(require("../dao/ticketScan.dao"));
const types_1 = require("../types");
async function createScanRequest(request) {
    if (!request.ticketId || !request.attachments || request.attachments.length === 0) {
        throw new Error('工单编号和附件清单不能为空');
    }
    const scanEngine = request.scanEngine || types_1.ScanEngine.CLAMAV;
    const record = await ticketScanDao.createTicketScanRecord(request.ticketId, request.attachments, scanEngine);
    await ticketScanDao.updateTicketScanStatus(record.id, types_1.ScanStatus.QUEUED, {
        processingSummary: '附件已进入扫描队列，等待扫描引擎处理'
    });
    return await ticketScanDao.getTicketScanRecordById(record.id);
}
async function getScanRecordById(id) {
    return await ticketScanDao.getTicketScanRecordById(id);
}
async function getScanRecordsByTicketId(ticketId) {
    return await ticketScanDao.getTicketScanRecordsByTicketId(ticketId);
}
async function getAllScanRecords(page = 1, pageSize = 20) {
    return await ticketScanDao.getAllTicketScanRecords(page, pageSize);
}
async function getScanRecordsByStatus(status) {
    return await ticketScanDao.getTicketScanRecordsByStatus(status);
}
async function updateScanStatus(id, request) {
    const existingRecord = await ticketScanDao.getTicketScanRecordById(id);
    if (!existingRecord) {
        throw new Error('扫描记录不存在');
    }
    const { status, scanReport, virusFound, riskLevel, processingSummary } = request;
    let isolationAction = existingRecord.isolationAction;
    if (virusFound && virusFound.length > 0) {
        if (riskLevel === types_1.RiskLevel.CRITICAL || riskLevel === types_1.RiskLevel.HIGH) {
            isolationAction = types_1.IsolationAction.QUARANTINE;
        }
        else if (riskLevel === types_1.RiskLevel.MEDIUM) {
            isolationAction = types_1.IsolationAction.HOLD;
        }
    }
    let finalSummary = processingSummary;
    if (!finalSummary) {
        if (status === types_1.ScanStatus.SUCCESS) {
            if (virusFound && virusFound.length > 0) {
                finalSummary = `扫描完成，发现 ${virusFound.length} 个病毒：${virusFound.join(', ')}`;
            }
            else {
                finalSummary = '扫描完成，未发现病毒威胁';
            }
        }
        else if (status === types_1.ScanStatus.SCANNING) {
            finalSummary = '正在执行病毒扫描...';
        }
        else if (status === types_1.ScanStatus.FAILED) {
            finalSummary = '扫描失败，需要重试或人工介入';
        }
    }
    return await ticketScanDao.updateTicketScanStatus(id, status, {
        scanReport,
        virusFound,
        riskLevel,
        isolationAction,
        processingSummary: finalSummary
    });
}
async function handleScanFailure(id, errorMessage, rawInput) {
    const failureRecord = {
        step: 'scan_execution',
        errorMessage,
        rawInput,
        processingBasis: '扫描引擎返回错误，无法完成病毒检测',
        finalConclusion: '扫描失败，已记录错误信息，等待人工处理或重试',
        timestamp: new Date()
    };
    await ticketScanDao.addFailureRecord(id, failureRecord);
    return await ticketScanDao.updateTicketScanStatus(id, types_1.ScanStatus.MANUAL_REVIEW, {
        processingSummary: `扫描失败：${errorMessage}，已进入人工审核队列`
    });
}
async function manualCorrection(id, request) {
    const existingRecord = await ticketScanDao.getTicketScanRecordById(id);
    if (!existingRecord) {
        throw new Error('扫描记录不存在');
    }
    let newStatus;
    let isolationAction = existingRecord.isolationAction;
    let summary = request.processingSummary || '';
    switch (request.action) {
        case 'release':
            newStatus = types_1.ScanStatus.RELEASED;
            isolationAction = types_1.IsolationAction.NONE;
            if (!summary) {
                summary = `人工审核通过，由 ${request.reviewedBy} 放行。原因：${request.reviewComment}`;
            }
            break;
        case 'isolate':
            newStatus = types_1.ScanStatus.ISOLATED;
            isolationAction = types_1.IsolationAction.QUARANTINE;
            if (!summary) {
                summary = `人工审核确认隔离，由 ${request.reviewedBy} 执行。原因：${request.reviewComment}`;
            }
            break;
        case 'retry':
            newStatus = types_1.ScanStatus.QUEUED;
            if (!summary) {
                summary = `人工触发重试扫描，由 ${request.reviewedBy} 执行。原因：${request.reviewComment}`;
            }
            break;
        default:
            throw new Error('无效的操作类型');
    }
    return await ticketScanDao.manualCorrectRecord(id, request.reviewedBy, request.reviewComment, {
        status: newStatus,
        riskLevel: request.riskLevel,
        isolationAction,
        processingSummary: summary
    });
}
async function exportScanRecords(filters) {
    let records;
    if (filters?.ticketId) {
        records = await ticketScanDao.getTicketScanRecordsByTicketId(filters.ticketId);
    }
    else if (filters?.status) {
        records = await ticketScanDao.getTicketScanRecordsByStatus(filters.status);
    }
    else {
        const result = await ticketScanDao.getAllTicketScanRecords(1, 1000);
        records = result.records;
    }
    if (filters?.startDate) {
        const start = new Date(filters.startDate);
        records = records.filter(r => r.createdAt >= start);
    }
    if (filters?.endDate) {
        const end = new Date(filters.endDate);
        records = records.filter(r => r.createdAt <= end);
    }
    return records;
}
function generateExportSummary(records) {
    const total = records.length;
    const successCount = records.filter(r => r.status === types_1.ScanStatus.SUCCESS).length;
    const isolatedCount = records.filter(r => r.isolationAction === types_1.IsolationAction.QUARANTINE).length;
    const virusFoundCount = records.filter(r => r.virusFound && r.virusFound.length > 0).length;
    return `
工单附件病毒扫描导出报告
========================
导出时间: ${new Date().toISOString()}
记录总数: ${total}
扫描成功: ${successCount}
发现病毒: ${virusFoundCount}
隔离文件: ${isolatedCount}

风险等级分布:
- 安全: ${records.filter(r => r.riskLevel === types_1.RiskLevel.SAFE).length}
- 低危: ${records.filter(r => r.riskLevel === types_1.RiskLevel.LOW).length}
- 中危: ${records.filter(r => r.riskLevel === types_1.RiskLevel.MEDIUM).length}
- 高危: ${records.filter(r => r.riskLevel === types_1.RiskLevel.HIGH).length}
- 严重: ${records.filter(r => r.riskLevel === types_1.RiskLevel.CRITICAL).length}
  `.trim();
}
