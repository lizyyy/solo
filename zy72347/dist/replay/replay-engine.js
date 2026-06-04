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
exports.createReplayManifest = createReplayManifest;
exports.saveReplayManifest = saveReplayManifest;
exports.listReplaySessions = listReplaySessions;
exports.executeReplay = executeReplay;
exports.generateReplayReport = generateReplayReport;
exports.createWorkflowReplayCommands = createWorkflowReplayCommands;
exports.getTraceabilityReport = getTraceabilityReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const id_1 = require("../utils/id");
const audit_log_1 = require("../store/audit-log");
const csv_importer_1 = require("../import/csv-importer");
const engine_1 = require("../workflow/engine");
const data_store_1 = require("../store/data-store");
const REPLAY_LOG_FILE = path.join(process.cwd(), 'data', 'replay-log.json');
const DATA_DIR = path.join(process.cwd(), 'data');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadReplayLog() {
    ensureDataDir();
    if (!fs.existsSync(REPLAY_LOG_FILE)) {
        return [];
    }
    try {
        const content = fs.readFileSync(REPLAY_LOG_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
function saveReplayLog(manifests) {
    ensureDataDir();
    fs.writeFileSync(REPLAY_LOG_FILE, JSON.stringify(manifests, null, 2), 'utf-8');
}
function createReplayManifest(createdBy, description, commands) {
    const manifest = {
        sessionId: (0, id_1.generateId)('session'),
        createdAt: Date.now(),
        createdBy,
        description,
        commands,
    };
    return manifest;
}
function saveReplayManifest(manifest) {
    const manifests = loadReplayLog();
    manifests.push(manifest);
    saveReplayLog(manifests);
}
function listReplaySessions() {
    const manifests = loadReplayLog();
    const list = manifests.map((m) => ({
        sessionId: m.sessionId,
        createdAt: new Date(m.createdAt).toLocaleString('zh-CN'),
        createdBy: m.createdBy,
        description: m.description,
        commandCount: m.commands.length,
    }));
    return { success: true, data: list, errors: [], warnings: [] };
}
async function executeReplay(sessionId, operator, clearDataBefore = true) {
    const manifests = loadReplayLog();
    const manifest = manifests.find((m) => m.sessionId === sessionId);
    if (!manifest) {
        return { success: false, errors: [`未找到会话 ${sessionId}`], warnings: [] };
    }
    if (clearDataBefore) {
        (0, data_store_1.clearAllRecords)();
    }
    const session = {
        sessionId: (0, id_1.generateId)('replay'),
        startTime: Date.now(),
        commands: [],
        results: [],
    };
    let currentRecordIds = [];
    (0, audit_log_1.logAction)(operator, 'REPLAY_START', {
        originalSessionId: sessionId,
        newSessionId: session.sessionId,
        commandCount: manifest.commands.length,
    });
    for (const cmd of manifest.commands) {
        session.commands.push(cmd.command);
        let result;
        try {
            switch (cmd.command) {
                case 'import': {
                    result = (0, csv_importer_1.importCsv)(cmd.args);
                    if (result.success && result.data) {
                        currentRecordIds = result.data.importedRecordIds;
                    }
                    break;
                }
                case 'annotate': {
                    const recordId = cmd.recordIndex !== undefined ? currentRecordIds[cmd.recordIndex] : undefined;
                    if (!recordId) {
                        result = { success: false, errors: [`找不到记录索引 ${cmd.recordIndex} 对应的记录ID`], warnings: [] };
                        break;
                    }
                    const args = {
                        ...cmd.args,
                        recordId,
                    };
                    result = (0, engine_1.addAnnotation)(args);
                    break;
                }
                case 'review': {
                    const recordId = cmd.recordIndex !== undefined ? currentRecordIds[cmd.recordIndex] : undefined;
                    if (!recordId) {
                        result = { success: false, errors: [`找不到记录索引 ${cmd.recordIndex} 对应的记录ID`], warnings: [] };
                        break;
                    }
                    const args = {
                        ...cmd.args,
                        recordId,
                    };
                    result = (0, engine_1.reviewRecord)(args);
                    break;
                }
                case 'update': {
                    const recordId = cmd.recordIndex !== undefined ? currentRecordIds[cmd.recordIndex] : undefined;
                    if (!recordId) {
                        result = { success: false, errors: [`找不到记录索引 ${cmd.recordIndex} 对应的记录ID`], warnings: [] };
                        break;
                    }
                    const args = {
                        ...cmd.args,
                        recordId,
                    };
                    result = (0, engine_1.updateRecord)(args);
                    break;
                }
                case 'rollback': {
                    const { recordId, operator: op, reason } = cmd.args;
                    result = (0, engine_1.rollbackRecord)(recordId, op, reason);
                    break;
                }
                default: {
                    result = { success: false, errors: [`未知命令: ${cmd.command}`], warnings: [] };
                }
            }
        }
        catch (e) {
            result = {
                success: false,
                errors: [`命令执行异常: ${e.message}`],
                warnings: [],
            };
        }
        session.results.push(result);
        if (!result.success) {
            (0, audit_log_1.logAction)(operator, 'REPLAY_COMMAND_FAILED', {
                command: cmd.command,
                args: cmd.args,
                errors: result.errors,
            });
            session.endTime = Date.now();
            return {
                success: false,
                data: session,
                errors: [`命令 ${cmd.command} 执行失败: ${result.errors.join(', ')}`],
                warnings: [],
            };
        }
        (0, audit_log_1.logAction)(operator, 'REPLAY_COMMAND_SUCCESS', {
            command: cmd.command,
            args: cmd.args,
        });
    }
    session.endTime = Date.now();
    (0, audit_log_1.logAction)(operator, 'REPLAY_COMPLETE', {
        originalSessionId: sessionId,
        newSessionId: session.sessionId,
        completedCommands: session.commands.length,
    });
    return { success: true, data: session, errors: [], warnings: [] };
}
function generateReplayReport(session) {
    const lines = [];
    lines.push('=== 贝塞尔曲线路径平滑 - 复盘报告 ===');
    lines.push(`会话ID: ${session.sessionId}`);
    lines.push(`开始时间: ${new Date(session.startTime).toLocaleString('zh-CN')}`);
    if (session.endTime) {
        lines.push(`结束时间: ${new Date(session.endTime).toLocaleString('zh-CN')}`);
        lines.push(`耗时: ${((session.endTime - session.startTime) / 1000).toFixed(2)} 秒`);
    }
    lines.push(`命令总数: ${session.commands.length}`);
    lines.push('');
    lines.push('--- 命令执行记录 ---');
    session.commands.forEach((cmd, idx) => {
        const result = session.results[idx];
        const status = result?.success ? '✅ 成功' : '❌ 失败';
        lines.push(`${idx + 1}. ${cmd} - ${status}`);
        if (result && !result.success && result.errors.length > 0) {
            lines.push(`   错误: ${result.errors.join(', ')}`);
        }
    });
    return lines.join('\n');
}
function createWorkflowReplayCommands(importOptions, annotations, reviews, updates, importedRecordIds) {
    const commands = [];
    commands.push({
        id: (0, id_1.generateId)('cmd'),
        timestamp: Date.now(),
        command: 'import',
        args: importOptions,
    });
    annotations.forEach((ann) => {
        commands.push({
            id: (0, id_1.generateId)('cmd'),
            timestamp: Date.now(),
            command: 'annotate',
            recordIndex: ann.recordIndex,
            args: {
                author: ann.author,
                content: ann.content,
                screenshotRef: ann.screenshotRef,
            },
        });
    });
    reviews.forEach((rev) => {
        commands.push({
            id: (0, id_1.generateId)('cmd'),
            timestamp: Date.now(),
            command: 'review',
            recordIndex: rev.recordIndex,
            args: {
                reviewer: rev.reviewer,
                decision: rev.decision,
                comment: rev.comment,
            },
        });
    });
    updates.forEach((upd) => {
        commands.push({
            id: (0, id_1.generateId)('cmd'),
            timestamp: Date.now(),
            command: 'update',
            recordIndex: upd.recordIndex,
            args: {
                operator: upd.operator,
                fieldValues: upd.fieldValues,
                reason: upd.reason,
            },
        });
    });
    return commands;
}
function getTraceabilityReport(recordId) {
    const auditLogs = (0, audit_log_1.getAuditLog)(recordId);
    if (auditLogs.length === 0) {
        return { success: false, errors: [`未找到记录 ${recordId} 的审计日志`], warnings: [] };
    }
    const lines = [];
    lines.push(`=== 追溯报告 - 记录 ${recordId} ===`);
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`操作总数: ${auditLogs.length}`);
    lines.push('');
    lines.push('--- 时间线 ---');
    auditLogs.forEach((log, idx) => {
        lines.push(`${idx + 1}. [${new Date(log.timestamp).toLocaleString('zh-CN')}]`);
        lines.push(`   操作人: ${log.operator}`);
        lines.push(`   操作: ${log.action}`);
        lines.push(`   详情: ${JSON.stringify(log.details, null, 2).split('\n').join('\n         ')}`);
        lines.push('');
    });
    lines.push('--- 来源与下一步 ---');
    lines.push('📌 来源查找:');
    lines.push('   1. 查看"原始行号"字段，对应源文件中的行');
    lines.push('   2. 查看"原始值"部分，了解导入时的原始格式');
    lines.push('   3. 查看变更历史，了解每一次改动的原因');
    lines.push('');
    lines.push('🎯 下一步动作:');
    const lastLog = auditLogs[auditLogs.length - 1];
    if (lastLog.action === 'RECORD_IMPORTED' && lastLog.details.hasMixedFormat) {
        lines.push('   ⚠️  该记录存在百分数/小数混合格式');
        lines.push('   → 需要活动负责人进行复核');
        lines.push('   → 执行: bezier review --id <记录ID> --reviewer "活动负责人" --decision approve');
    }
    else if (lastLog.action === 'REVIEW_COMPLETED') {
        const decision = lastLog.details.decision;
        if (decision === 'approve') {
            lines.push('   ✅ 已批准，可以进行计算明细更新');
            lines.push('   → 执行: bezier update --id <记录ID> --operator "运营规划阿岚"');
        }
        else if (decision === 'reject') {
            lines.push('   ❌ 已拒绝，需要重新导入或联系数据提供方');
        }
        else if (decision === 'rollback') {
            lines.push('   ↩️  已回滚，数据已恢复到导入前状态');
        }
    }
    else if (lastLog.action === 'RECORD_UPDATED') {
        lines.push('   ✅ 已完成，数据已更新');
        lines.push('   → 可导出结果: bezier export --format detail');
    }
    return { success: true, data: lines.join('\n'), errors: [], warnings: [] };
}
//# sourceMappingURL=replay-engine.js.map