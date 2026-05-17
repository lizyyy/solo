import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
export async function parseScanReport(filePath) {
    const absolutePath = path.resolve(filePath);
    const ext = path.extname(filePath).toLowerCase();
    try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        if (ext === '.json') {
            return parseJsonReport(content);
        }
        else if (ext === '.csv') {
            return parseCsvReport(content);
        }
        else {
            return {
                success: false,
                findings: [],
                errors: [{
                        row: 0,
                        raw: ext,
                        reason: `不支持的文件格式: ${ext}，仅支持 .json 和 .csv`
                    }]
            };
        }
    }
    catch (error) {
        return {
            success: false,
            findings: [],
            errors: [{
                    row: 0,
                    raw: filePath,
                    reason: `读取文件失败: ${error.message}`
                }]
        };
    }
}
function parseJsonReport(content) {
    const errors = [];
    const findings = [];
    try {
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                try {
                    const finding = validateAndTransformFinding(item, index);
                    findings.push(finding);
                }
                catch (error) {
                    errors.push({
                        row: index,
                        raw: JSON.stringify(item),
                        reason: error.message
                    });
                }
            });
        }
        else {
            errors.push({
                row: 0,
                raw: content.substring(0, 100),
                reason: 'JSON根节点必须是数组'
            });
        }
    }
    catch (error) {
        errors.push({
            row: 0,
            raw: content.substring(0, 100),
            reason: `JSON解析失败: ${error.message}`
        });
    }
    return {
        success: errors.length === 0,
        findings,
        errors
    };
}
function parseCsvReport(content) {
    const errors = [];
    const findings = [];
    try {
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        records.forEach((item, index) => {
            try {
                const finding = validateAndTransformFinding(item, index);
                findings.push(finding);
            }
            catch (error) {
                errors.push({
                    row: index + 1,
                    raw: JSON.stringify(item),
                    reason: error.message
                });
            }
        });
    }
    catch (error) {
        errors.push({
            row: 0,
            raw: content.substring(0, 100),
            reason: `CSV解析失败: ${error.message}`
        });
    }
    return {
        success: errors.length === 0,
        findings,
        errors
    };
}
function validateAndTransformFinding(item, index) {
    const requiredFields = ['File', 'Secret', 'Fingerprint', 'RuleID'];
    const missingFields = requiredFields.filter(f => !item[f] && item[f] !== '');
    if (missingFields.length > 0) {
        throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
    }
    return {
        Description: String(item.Description || item.description || ''),
        StartLine: parseInt(item.StartLine || item.start_line || item.startLine || 0, 10),
        EndLine: parseInt(item.EndLine || item.end_line || item.endLine || 0, 10),
        StartColumn: parseInt(item.StartColumn || item.start_column || item.startColumn || 0, 10),
        EndColumn: parseInt(item.EndColumn || item.end_column || item.endColumn || 0, 10),
        Match: String(item.Match || item.match || ''),
        Secret: String(item.Secret || item.secret || ''),
        File: String(item.File || item.file || ''),
        SymlinkFile: String(item.SymlinkFile || item.symlink_file || ''),
        Commit: String(item.Commit || item.commit || ''),
        Entropy: parseFloat(item.Entropy || item.entropy || 0),
        Author: String(item.Author || item.author || ''),
        Email: String(item.Email || item.email || ''),
        Date: String(item.Date || item.date || ''),
        Message: String(item.Message || item.message || ''),
        Tags: Array.isArray(item.Tags) ? item.Tags : (typeof item.Tags === 'string' ? item.Tags.split(',') : []),
        RuleID: String(item.RuleID || item.ruleID || item.rule_id || ''),
        Fingerprint: String(item.Fingerprint || item.fingerprint || '')
    };
}
export async function parseBaseline(filePath) {
    const absolutePath = path.resolve(filePath);
    const errors = [];
    const baseline = [];
    try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
            return {
                success: false,
                baseline: [],
                errors: [{
                        row: 0,
                        raw: content.substring(0, 100),
                        reason: '基线文件必须是JSON数组'
                    }]
            };
        }
        data.forEach((item, index) => {
            try {
                if (!item.fingerprint || !item.file) {
                    throw new Error('缺少必填字段: fingerprint 或 file');
                }
                baseline.push({
                    fingerprint: String(item.fingerprint),
                    file: String(item.file),
                    line: parseInt(item.line || 0, 10),
                    status: item.status || 'to_fix',
                    notes: item.notes ? String(item.notes) : undefined,
                    addedAt: item.addedAt || new Date().toISOString()
                });
            }
            catch (error) {
                errors.push({
                    row: index,
                    raw: JSON.stringify(item),
                    reason: error.message
                });
            }
        });
    }
    catch (error) {
        errors.push({
            row: 0,
            raw: filePath,
            reason: `读取基线文件失败: ${error.message}`
        });
    }
    return {
        success: errors.length === 0,
        baseline,
        errors
    };
}
