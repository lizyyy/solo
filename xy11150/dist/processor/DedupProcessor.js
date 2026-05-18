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
exports.DedupProcessor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const sync_1 = require("csv-stringify/sync");
const DedupRules_1 = require("../models/DedupRules");
class DedupProcessor {
    constructor(outputDir) {
        this.historyDir = path.join(outputDir, '.history');
        this.ensureDirectory(this.historyDir);
        this.runId = this.generateRunId();
    }
    process(records, outputDir) {
        const transfers = this.detectTransfers(records);
        const sharedPhones = this.detectSharedPhones(records);
        const dedupResult = this.performDeduplication(records);
        this.ensureDirectory(outputDir);
        const outputPath = this.writeOutput(dedupResult.uniqueRecords, outputDir);
        const reportPath = this.writeReport(dedupResult.uniqueRecords, dedupResult.duplicates, transfers, sharedPhones, outputDir);
        this.saveRunHistory(records, outputPath, outputDir);
        return {
            totalRecords: records.length,
            validRecords: dedupResult.uniqueRecords.length,
            duplicateRecords: dedupResult.duplicates,
            transferRecords: transfers,
            sharedPhoneRecords: sharedPhones,
            invalidRecords: [],
            outputPath,
            reportPath,
            runId: this.runId,
            processedAt: new Date()
        };
    }
    performDeduplication(records) {
        const processedIndices = new Set();
        const uniqueRecords = [];
        const duplicates = [];
        const groups = DedupRules_1.dedupEngine.groupByKey(records);
        for (const [keyStr, group] of groups) {
            if (group.length <= 1)
                continue;
            const [type, value] = keyStr.split(':');
            const key = { type: type, value };
            const groupIndices = group.map(r => records.indexOf(r));
            const unprocessedCount = groupIndices.filter(i => !processedIndices.has(i)).length;
            if (unprocessedCount <= 1)
                continue;
            const unprocessedRecords = group.filter((_, idx) => !processedIndices.has(groupIndices[idx]));
            const bestRecord = DedupRules_1.dedupEngine.selectBestRecord(unprocessedRecords);
            const bestIndex = records.indexOf(bestRecord);
            if (!processedIndices.has(bestIndex)) {
                uniqueRecords.push(bestRecord);
                processedIndices.add(bestIndex);
            }
            const duplicateRecords = unprocessedRecords.filter(r => records.indexOf(r) !== bestIndex);
            if (duplicateRecords.length > 0) {
                duplicates.push({
                    original: bestRecord,
                    duplicates: duplicateRecords,
                    reason: this.getDuplicateReason(key.type),
                    key
                });
                for (const dup of duplicateRecords) {
                    processedIndices.add(records.indexOf(dup));
                }
            }
        }
        for (let i = 0; i < records.length; i++) {
            if (!processedIndices.has(i)) {
                uniqueRecords.push(records[i]);
                processedIndices.add(i);
            }
        }
        return { uniqueRecords, duplicates };
    }
    detectTransfers(records) {
        const transfers = [];
        const employeeRecords = new Map();
        for (const record of records) {
            const key = DedupRules_1.dedupEngine.generateEmployeeIdKey(record);
            if (key) {
                if (!employeeRecords.has(key.value)) {
                    employeeRecords.set(key.value, []);
                }
                employeeRecords.get(key.value).push(record);
            }
        }
        for (const [employeeId, empRecords] of employeeRecords) {
            if (empRecords.length < 2)
                continue;
            const sorted = [...empRecords].sort((a, b) => {
                const dateA = a.registrationDate || '';
                const dateB = b.registrationDate || '';
                return dateA.localeCompare(dateB);
            });
            for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1];
                const curr = sorted[i];
                if (DedupRules_1.dedupEngine.detectTransfer(prev, curr)) {
                    transfers.push({
                        employeeId,
                        employeeName: curr.employeeName,
                        oldRoute: prev.routeName,
                        newRoute: curr.routeName,
                        oldBoardingPoint: prev.boardingPoint,
                        newBoardingPoint: curr.boardingPoint,
                        transferDate: curr.registrationDate || new Date().toISOString().split('T')[0]
                    });
                }
            }
        }
        return transfers;
    }
    detectSharedPhones(records) {
        const phoneGroups = new Map();
        for (const record of records) {
            const phoneKey = DedupRules_1.dedupEngine.generatePhoneKey(record);
            if (phoneKey) {
                if (!phoneGroups.has(phoneKey.value)) {
                    phoneGroups.set(phoneKey.value, []);
                }
                phoneGroups.get(phoneKey.value).push(record);
            }
        }
        const sharedPhones = [];
        for (const [phone, group] of phoneGroups) {
            if (group.length < 2)
                continue;
            const uniqueEmployees = new Map();
            for (const record of group) {
                const empId = record.employeeId || `${record.employeeName}:${record.department}`;
                if (!uniqueEmployees.has(empId)) {
                    uniqueEmployees.set(empId, {
                        employeeId: record.employeeId,
                        employeeName: record.employeeName,
                        department: record.department,
                        routeName: record.routeName
                    });
                }
            }
            if (uniqueEmployees.size >= 2) {
                sharedPhones.push({
                    phone,
                    employees: Array.from(uniqueEmployees.values())
                });
            }
        }
        return sharedPhones;
    }
    getDuplicateReason(type) {
        const reasons = {
            employeeId: '员工编号重复',
            phone: '手机号码重复',
            nameAndPhone: '姓名+手机号码重复'
        };
        return reasons[type] || '重复记录';
    }
    recordToHash(record) {
        const keyData = {
            employeeId: record.employeeId?.trim().toUpperCase(),
            employeeName: record.employeeName?.trim(),
            phone: DedupRules_1.dedupEngine.normalizePhone(record.phone),
            routeName: record.routeName?.trim().toLowerCase(),
            boardingPoint: record.boardingPoint?.trim().toLowerCase()
        };
        return crypto
            .createHash('md5')
            .update(JSON.stringify(keyData))
            .digest('hex');
    }
    generateRunId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `shuttle_${timestamp}_${random}`;
    }
    writeOutput(records, outputDir) {
        const outputPath = path.join(outputDir, `去重结果_${this.runId}.csv`);
        const csvData = records.map(r => ({
            '员工编号': r.employeeId,
            '员工姓名': r.employeeName,
            '部门': r.department,
            '手机号': r.phone,
            '线路名称': r.routeName,
            '上车点': r.boardingPoint,
            '发车时间': r.boardingTime,
            '报名日期': r.registrationDate,
            '状态': r.status,
            '来源文件': r.sourceFile,
            '行号': r.rowNumber
        }));
        const csv = (0, sync_1.stringify)(csvData, { header: true });
        fs.writeFileSync(outputPath, '\uFEFF' + csv, 'utf8');
        return outputPath;
    }
    writeReport(uniqueRecords, duplicates, transfers, sharedPhones, outputDir) {
        const reportPath = path.join(outputDir, `复核报告_${this.runId}.txt`);
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('企业班车报名去重复核报告');
        lines.push(`运行ID: ${this.runId}`);
        lines.push(`处理时间: ${new Date().toLocaleString('zh-CN')}`);
        lines.push('='.repeat(60));
        lines.push('');
        lines.push('【一、总体统计】');
        lines.push(`总记录数: ${uniqueRecords.length + duplicates.reduce((sum, d) => sum + d.duplicates.length, 0)}`);
        lines.push(`去重后有效记录数: ${uniqueRecords.length}`);
        lines.push(`发现重复记录数: ${duplicates.length} 组，共 ${duplicates.reduce((sum, d) => sum + d.duplicates.length, 0)} 条`);
        lines.push(`发现调岗记录数: ${transfers.length} 条`);
        lines.push(`发现多人共用手机号数: ${sharedPhones.length} 个`);
        lines.push('');
        if (duplicates.length > 0) {
            lines.push('【二、重复记录明细】');
            lines.push('');
            for (let i = 0; i < duplicates.length; i++) {
                const dup = duplicates[i];
                lines.push(`第 ${i + 1} 组: ${dup.reason} (${dup.key.value})`);
                lines.push(`  保留记录: ${dup.original.employeeName} (${dup.original.employeeId}) - ${dup.original.routeName} - ${dup.original.sourceFile}:${dup.original.rowNumber}`);
                for (const d of dup.duplicates) {
                    lines.push(`  重复记录: ${d.employeeName} (${d.employeeId}) - ${d.routeName} - ${d.sourceFile}:${d.rowNumber}`);
                }
                lines.push('');
            }
        }
        if (transfers.length > 0) {
            lines.push('【三、调岗记录明细】');
            lines.push('');
            for (let i = 0; i < transfers.length; i++) {
                const t = transfers[i];
                lines.push(`${i + 1}. ${t.employeeName} (${t.employeeId})`);
                lines.push(`   原线路: ${t.oldRoute} - ${t.oldBoardingPoint}`);
                lines.push(`   新线路: ${t.newRoute} - ${t.newBoardingPoint}`);
                lines.push(`   调岗日期: ${t.transferDate}`);
                lines.push('');
            }
        }
        if (sharedPhones.length > 0) {
            lines.push('【四、多人共用手机号明细】');
            lines.push('');
            for (let i = 0; i < sharedPhones.length; i++) {
                const sp = sharedPhones[i];
                lines.push(`${i + 1}. 手机号: ${sp.phone}`);
                for (const emp of sp.employees) {
                    lines.push(`   - ${emp.employeeName} (${emp.employeeId || '无编号'}) - ${emp.department} - ${emp.routeName}`);
                }
                lines.push('');
            }
        }
        lines.push('【五、线路统计】');
        const routeStats = new Map();
        for (const r of uniqueRecords) {
            routeStats.set(r.routeName, (routeStats.get(r.routeName) || 0) + 1);
        }
        for (const [route, count] of Array.from(routeStats.entries()).sort((a, b) => b[1] - a[1])) {
            lines.push(`  ${route}: ${count} 人`);
        }
        lines.push('');
        lines.push('='.repeat(60));
        lines.push('报告结束');
        lines.push('='.repeat(60));
        fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
        return reportPath;
    }
    saveRunHistory(records, outputPath, outputDir) {
        const historyPath = path.join(this.historyDir, 'run_history.json');
        const recordHashes = records.map(r => this.recordToHash(r));
        const outputFingerprint = fs.existsSync(outputPath)
            ? crypto.createHash('md5').update(fs.readFileSync(outputPath)).digest('hex')
            : '';
        const history = {
            runId: this.runId,
            processedAt: new Date().toISOString(),
            inputFiles: [...new Set(records.map(r => r.sourceFile))],
            recordHashes,
            outputFingerprint
        };
        let allHistory = [];
        if (fs.existsSync(historyPath)) {
            try {
                allHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
            catch {
                allHistory = [];
            }
        }
        allHistory.push(history);
        fs.writeFileSync(historyPath, JSON.stringify(allHistory, null, 2), 'utf8');
    }
    findPreviousRun(records) {
        const historyPath = path.join(this.historyDir, 'run_history.json');
        if (!fs.existsSync(historyPath))
            return null;
        try {
            const allHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            const currentHashes = new Set(records.map(r => this.recordToHash(r)));
            for (const history of allHistory.reverse()) {
                const historyHashes = new Set(history.recordHashes);
                const intersection = [...currentHashes].filter(h => historyHashes.has(h));
                if (intersection.length / currentHashes.size > 0.7) {
                    return history;
                }
            }
        }
        catch {
        }
        return null;
    }
    ensureDirectory(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
exports.DedupProcessor = DedupProcessor;
//# sourceMappingURL=DedupProcessor.js.map