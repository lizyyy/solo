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
exports.logAction = logAction;
exports.getAuditLog = getAuditLog;
exports.generateAuditReport = generateAuditReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const id_1 = require("../utils/id");
const AUDIT_LOG_FILE = path.join(process.cwd(), 'data', 'audit-log.json');
const DATA_DIR = path.join(process.cwd(), 'data');
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}
function loadAuditLog() {
    ensureDataDir();
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
        return [];
    }
    try {
        const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
function saveAuditLog(logs) {
    ensureDataDir();
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}
function logAction(operator, action, details, recordId) {
    const entry = {
        id: (0, id_1.generateId)('audit'),
        timestamp: Date.now(),
        operator,
        action,
        recordId,
        details,
    };
    const logs = loadAuditLog();
    logs.push(entry);
    saveAuditLog(logs);
    return entry;
}
function getAuditLog(recordId) {
    const logs = loadAuditLog();
    if (recordId) {
        return logs.filter((l) => l.recordId === recordId);
    }
    return logs;
}
function generateAuditReport() {
    const logs = loadAuditLog();
    if (logs.length === 0) {
        return { success: true, data: '暂无审计记录', errors: [], warnings: [] };
    }
    const lines = [];
    lines.push('=== 贝塞尔曲线路径平滑 - 审计追踪报告 ===');
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`总操作数: ${logs.length}`);
    lines.push('');
    const actions = new Map();
    const operators = new Map();
    logs.forEach((log) => {
        actions.set(log.action, (actions.get(log.action) || 0) + 1);
        operators.set(log.operator, (operators.get(log.operator) || 0) + 1);
        lines.push(`[${new Date(log.timestamp).toLocaleString('zh-CN')}]`);
        lines.push(`  操作人: ${log.operator}`);
        lines.push(`  操作: ${log.action}`);
        if (log.recordId) {
            lines.push(`  记录ID: ${log.recordId}`);
        }
        lines.push(`  详情: ${JSON.stringify(log.details, null, 2).split('\n').join('\n          ')}`);
        lines.push('');
    });
    lines.push('=== 操作统计 ===');
    lines.push('操作类型分布:');
    actions.forEach((count, action) => {
        lines.push(`  ${action}: ${count} 次`);
    });
    lines.push('');
    lines.push('操作人分布:');
    operators.forEach((count, op) => {
        lines.push(`  ${op}: ${count} 次`);
    });
    return {
        success: true,
        data: lines.join('\n'),
        errors: [],
        warnings: [],
    };
}
//# sourceMappingURL=audit-log.js.map