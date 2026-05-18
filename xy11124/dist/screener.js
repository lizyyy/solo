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
exports.runScreening = runScreening;
exports.sortRecords = sortRecords;
exports.clearDedupeState = clearDedupeState;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const parser_1 = require("./parser");
const STATE_FILE = path.join(process.cwd(), '.screening-state.json');
function loadDedupeState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const content = fs.readFileSync(STATE_FILE, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch (e) {
    }
    return {
        processedBatches: new Set(),
        processedRecords: new Set()
    };
}
function saveDedupeState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify({
            processedBatches: Array.from(state.processedBatches),
            processedRecords: Array.from(state.processedRecords)
        }, null, 2));
    }
    catch (e) {
    }
}
function generateBatchHash(filePaths) {
    const sortedPaths = [...filePaths].sort();
    const fileHashes = sortedPaths.map(fp => {
        try {
            const content = fs.readFileSync(fp, 'utf-8');
            return crypto.createHash('md5').update(content).digest('hex');
        }
        catch {
            return '';
        }
    });
    return crypto.createHash('md5').update(fileHashes.join('|')).digest('hex');
}
function generateRecordHash(patientId, packageId, screeningDate) {
    return crypto.createHash('md5').update(`${patientId}|${packageId}|${screeningDate}`).digest('hex');
}
function isExpired(expiryDate, screeningDate) {
    return new Date(expiryDate) < new Date(screeningDate);
}
function checkPackageMismatch(pkg, contraindications) {
    const categoryContraindications = {
        '盆底康复': ['盆底肌肉严重损伤', '子宫复旧不良', '活动性出血'],
        '子宫复旧': ['活动性出血', '急性感染', '发热'],
        '形体恢复': ['严重贫血', '高血压', '心脏病'],
        '乳腺护理': ['急性感染', '发热', '恶性肿瘤'],
        '产后心理': ['精神疾病', '产后抑郁'],
        '综合调理': ['高血压', '心脏病', '糖尿病', '肝肾功能异常']
    };
    const expectedTypes = categoryContraindications[pkg.category] || [];
    for (const contType of pkg.contraindications) {
        if (!expectedTypes.includes(contType)) {
            return {
                type: 'package_mismatch',
                severity: 'warning',
                message: `套餐"${pkg.name}"(${pkg.category})包含非预期禁忌类型: ${contType}`,
                details: {
                    packageId: pkg.id,
                    expectedCategory: pkg.category,
                    actualCategory: contType
                },
                source: pkg.source
            };
        }
    }
    return null;
}
function screenPatient(patientId, patientName, pkg, contraindications, screeningDate, batchId) {
    const issues = [];
    const patientContraindications = contraindications.filter(c => c.patientId === patientId);
    for (const ci of patientContraindications) {
        if (isExpired(ci.expiryDate, screeningDate)) {
            issues.push({
                type: 'expired_contraindication',
                severity: 'critical',
                message: `患者"${patientName}"的禁忌"${ci.type}"已过期 (过期日期: ${ci.expiryDate})`,
                details: {
                    contraindicationId: ci.id,
                    contraindicationType: ci.type,
                    expiryDate: ci.expiryDate
                },
                source: ci.source
            });
        }
    }
    const mismatchIssue = checkPackageMismatch(pkg, patientContraindications);
    if (mismatchIssue) {
        issues.push(mismatchIssue);
    }
    let result = 'pass';
    if (issues.some(i => i.severity === 'critical')) {
        result = 'fail';
    }
    else if (issues.length > 0) {
        result = 'warning';
    }
    return {
        id: (0, uuid_1.v4)(),
        batchId,
        patientId,
        patientName,
        treatmentPackageId: pkg.id,
        treatmentPackageName: pkg.name,
        screeningDate,
        result,
        issues,
        sourceFile: pkg.source?.file || '',
        sourceLine: pkg.source?.line || 0,
        processedAt: new Date().toISOString()
    };
}
function runScreening(filePaths, screeningDate = new Date().toISOString().split('T')[0], force = false) {
    const batchId = generateBatchHash(filePaths);
    const state = loadDedupeState();
    if (!force && state.processedBatches.has(batchId)) {
        return {
            batchId,
            processedAt: new Date().toISOString(),
            totalRecords: 0,
            passed: 0,
            failed: 0,
            warnings: 0,
            records: [],
            parseErrors: [],
            inputFiles: filePaths
        };
    }
    const parsed = (0, parser_1.parseFiles)(filePaths);
    const records = [];
    const uniquePatients = new Set(parsed.contraindications.map(c => c.patientId));
    for (const patientId of uniquePatients) {
        const patientContra = parsed.contraindications.find(c => c.patientId === patientId);
        if (!patientContra)
            continue;
        for (const pkg of parsed.packages) {
            const recordHash = generateRecordHash(patientId, pkg.id, screeningDate);
            if (!force && state.processedRecords.has(recordHash)) {
                continue;
            }
            const record = screenPatient(patientId, patientContra.patientName, pkg, parsed.contraindications.filter(c => c.patientId === patientId), screeningDate, batchId);
            records.push(record);
            state.processedRecords.add(recordHash);
        }
    }
    state.processedBatches.add(batchId);
    saveDedupeState(state);
    const passed = records.filter(r => r.result === 'pass').length;
    const failed = records.filter(r => r.result === 'fail').length;
    const warnings = records.filter(r => r.result === 'warning').length;
    return {
        batchId,
        processedAt: new Date().toISOString(),
        totalRecords: records.length,
        passed,
        failed,
        warnings,
        records: sortRecords(records),
        parseErrors: parsed.errors,
        inputFiles: filePaths
    };
}
function sortRecords(records) {
    return [...records].sort((a, b) => {
        if (a.result !== b.result) {
            const order = { fail: 0, warning: 1, pass: 2 };
            return order[a.result] - order[b.result];
        }
        if (a.patientId !== b.patientId) {
            return a.patientId.localeCompare(b.patientId);
        }
        return a.treatmentPackageId.localeCompare(b.treatmentPackageId);
    });
}
function clearDedupeState() {
    if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
}
