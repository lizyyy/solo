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
exports.generateMarkdownReport = generateMarkdownReport;
exports.writeMarkdownReport = writeMarkdownReport;
exports.writeLatestMarkdownReport = writeLatestMarkdownReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const severityEmoji = {
    critical: '🔴',
    high: '🔴',
    medium: '🟡',
    low: '🔵'
};
const severityLabels = {
    critical: '严重',
    high: '高危',
    medium: '中危',
    low: '低危'
};
function maskValue(value) {
    if (value.length <= 8) {
        return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
}
function generateMarkdownReport(result) {
    const lines = [];
    lines.push('# Helm Values 泄密扫描报告');
    lines.push('');
    lines.push(`> 生成时间: ${result.metadata.scannedAt}`);
    lines.push(`> 环境: ${result.metadata.environment}`);
    lines.push('');
    lines.push('## 📋 扫描信息');
    lines.push('');
    lines.push('| 项目 | 内容 |');
    lines.push('|------|------|');
    lines.push(`| 扫描时间 | ${result.metadata.scannedAt} |`);
    lines.push(`| 环境 | ${result.metadata.environment} |`);
    lines.push(`| Values 文件 | \`${result.metadata.valuesFile}\` |`);
    if (result.metadata.templateDir) {
        lines.push(`| 模板目录 | \`${result.metadata.templateDir}\` |`);
    }
    if (result.metadata.rulesFile) {
        lines.push(`| 规则文件 | \`${result.metadata.rulesFile}\` |`);
    }
    if (result.metadata.exceptionsFile) {
        lines.push(`| 例外配置 | \`${result.metadata.exceptionsFile}\` |`);
    }
    lines.push('');
    lines.push('## 📊 扫描摘要');
    lines.push('');
    lines.push('| 统计项 | 数量 |');
    lines.push('|--------|------|');
    lines.push(`| 扫描文件数 | ${result.summary.totalFiles} |`);
    lines.push(`| 发现问题数 | ${result.summary.totalFindings} |`);
    lines.push(`| 🔴 严重 | ${result.summary.bySeverity.critical} |`);
    lines.push(`| 🔴 高危 | ${result.summary.bySeverity.high} |`);
    lines.push(`| 🟡 中危 | ${result.summary.bySeverity.medium} |`);
    lines.push(`| 🔵 低危 | ${result.summary.bySeverity.low} |`);
    lines.push(`| 📌 已例外 | ${result.summary.excepted} |`);
    lines.push(`| ⚠️  过期例外 | ${result.summary.expiredExceptions} |`);
    lines.push('');
    const activeFindings = result.findings.filter(f => !f.excepted);
    if (activeFindings.length > 0) {
        lines.push('## 🔍 发现的敏感信息');
        lines.push('');
        const bySeverity = ['critical', 'high', 'medium', 'low'];
        for (const sev of bySeverity) {
            const sevFindings = activeFindings.filter(f => f.severity === sev);
            if (sevFindings.length === 0)
                continue;
            lines.push(`### ${severityEmoji[sev]} ${severityLabels[sev]}级别 (${sevFindings.length} 项)`);
            lines.push('');
            for (const finding of sevFindings) {
                lines.push(...formatFinding(finding));
                lines.push('');
            }
        }
    }
    else {
        lines.push('## ✅ 未发现敏感信息');
        lines.push('');
        lines.push('扫描未发现任何敏感信息。');
        lines.push('');
    }
    if (result.summary.excepted > 0) {
        lines.push('## 📌 已例外的项目');
        lines.push('');
        const exceptedFindings = result.findings.filter(f => f.excepted);
        for (const finding of exceptedFindings) {
            lines.push(`- **[${finding.ruleName}]** ${finding.location.path}`);
            if (finding.exception?.reason) {
                lines.push(`  - 例外原因: ${finding.exception.reason}`);
            }
            if (finding.exception?.createdBy) {
                lines.push(`  - 创建人: ${finding.exception.createdBy}`);
            }
            if (finding.exception?.expiresAt) {
                lines.push(`  - 过期时间: ${finding.exception.expiresAt}`);
            }
            lines.push('');
        }
    }
    if (result.summary.expiredExceptions > 0) {
        lines.push('## ⚠️  已过期的例外（需要处理！）');
        lines.push('');
        const expiredFindings = result.findings.filter(f => f.exceptionExpired);
        for (const finding of expiredFindings) {
            lines.push(`- **[${finding.ruleName}]** ${finding.location.path}`);
            lines.push(`  - 过期时间: ${finding.exception?.expiresAt}`);
            if (finding.exception?.reason) {
                lines.push(`  - 例外原因: ${finding.exception.reason}`);
            }
            lines.push('');
        }
    }
    if (result.errors.length > 0) {
        lines.push('## ❌ 错误');
        lines.push('');
        for (const err of result.errors) {
            lines.push(`- ${err}`);
        }
        lines.push('');
    }
    if (result.warnings.length > 0) {
        lines.push('## ⚠️  警告');
        lines.push('');
        for (const warn of result.warnings) {
            lines.push(`- ${warn}`);
        }
        lines.push('');
    }
    lines.push('## 📖 扫描说明');
    lines.push('');
    lines.push('### 严重级别说明');
    lines.push('- **严重 (Critical)**: 明确的凭证泄露，如 AWS 密钥、数据库密码');
    lines.push('- **高危 (High)**: 敏感配置、API 密钥、认证信息');
    lines.push('- **中危 (Medium)**: 内网地址、编码后的敏感数据');
    lines.push('- **低危 (Low)**: 内部域名、证书文件等');
    lines.push('');
    lines.push('### 例外配置');
    lines.push('如需例外某些发现，请在例外配置文件中添加例外项。例外项支持按规则 ID、路径、值进行匹配，并可设置过期时间。');
    lines.push('');
    lines.push('### Base64 检测');
    lines.push('本工具会自动检测并解码 Base64 编码的值，然后检查解码后的内容是否包含敏感信息。');
    lines.push('');
    return lines.join('\n');
}
function formatFinding(finding) {
    const lines = [];
    lines.push(`#### ${finding.ruleName}`);
    lines.push('');
    lines.push('| 属性 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 规则 ID | \`${finding.ruleId}\` |`);
    lines.push(`| 严重级别 | ${severityEmoji[finding.severity]} ${severityLabels[finding.severity]} |`);
    lines.push(`| 分类 | ${finding.category} |`);
    lines.push(`| 文件 | \`${finding.location.file}\` |`);
    lines.push(`| 路径 | \`${finding.location.path}\` |`);
    if (finding.location.line) {
        lines.push(`| 行号 | ${finding.location.line} |`);
    }
    if (finding.isBase64Encoded) {
        lines.push(`| 编码方式 | Base64 |`);
    }
    lines.push('');
    lines.push('**描述:**');
    lines.push(finding.description);
    lines.push('');
    lines.push('**证据:**');
    lines.push('```');
    lines.push(finding.evidence);
    lines.push('```');
    lines.push('');
    if (finding.isBase64Encoded && finding.decodedValue) {
        lines.push('**Base64 解码后 (已脱敏):**');
        lines.push('```');
        lines.push(maskValue(finding.decodedValue));
        lines.push('```');
        lines.push('');
    }
    return lines;
}
function writeMarkdownReport(result, outputDir) {
    const fileName = `scan-report-${result.metadata.environment}-${Date.now()}.md`;
    const filePath = path.join(outputDir, fileName);
    const markdownContent = generateMarkdownReport(result);
    fs.writeFileSync(filePath, markdownContent, 'utf-8');
    return filePath;
}
function writeLatestMarkdownReport(result, outputDir) {
    const fileName = 'latest-report.md';
    const filePath = path.join(outputDir, fileName);
    const markdownContent = generateMarkdownReport(result);
    fs.writeFileSync(filePath, markdownContent, 'utf-8');
    return filePath;
}
