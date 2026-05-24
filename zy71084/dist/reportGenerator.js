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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const types_1 = require("./types");
class ReportGenerator {
    static generateReport(report, outputDir, formats) {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        if (formats.terminal) {
            this.printTerminalSummary(report);
        }
        if (formats.json) {
            const jsonPath = path.join(outputDir, 'cert-check-report.json');
            this.writeJsonReport(report, jsonPath);
            console.log(chalk_1.default.gray(`\n📄 JSON 报告已保存: ${jsonPath}`));
        }
        if (formats.markdown) {
            const mdPath = path.join(outputDir, 'cert-check-report.md');
            this.writeMarkdownReport(report, mdPath);
            console.log(chalk_1.default.gray(`📄 Markdown 报告已保存: ${mdPath}`));
        }
    }
    static printTerminalSummary(report) {
        console.log('\n' + chalk_1.default.bold.cyan('═══════════════════════════════════════════════════'));
        console.log(chalk_1.default.bold.cyan('           Xcode 证书体检报告'));
        console.log(chalk_1.default.bold.cyan('═══════════════════════════════════════════════════'));
        console.log(chalk_1.default.gray(`生成时间: ${report.generatedAt.toLocaleString()}\n`));
        this.printSummaryStats(report);
        this.printProfileResults(report);
        this.printCertificateResults(report);
        this.printTargetResults(report);
        this.printAllIssues(report);
        this.printFinalResult(report);
    }
    static printSummaryStats(report) {
        const { summary } = report;
        console.log(chalk_1.default.bold('📊 检查统计'));
        console.log('─────────────────────────────────────────────────────');
        const stats = [
            { label: '总检查项', value: summary.total, color: chalk_1.default.white },
            { label: '✅ 通过', value: summary.passed, color: chalk_1.default.green },
            { label: '⚠️  警告', value: summary.warnings, color: chalk_1.default.yellow },
            { label: '❌ 错误', value: summary.errors, color: chalk_1.default.red },
            { label: '⏭️  跳过', value: summary.skipped, color: chalk_1.default.gray }
        ];
        stats.forEach(stat => {
            console.log(`  ${stat.color(stat.label.padEnd(12))}: ${stat.color.bold(stat.value.toString())}`);
        });
        console.log('');
    }
    static printProfileResults(report) {
        if (report.profiles.length === 0)
            return;
        console.log(chalk_1.default.bold('📱 Profile 检查结果'));
        console.log('─────────────────────────────────────────────────────');
        report.profiles.forEach(result => {
            const statusIcon = this.getStatusIcon(result.overallStatus);
            const statusColor = this.getStatusColor(result.overallStatus);
            console.log(`\n  ${statusIcon} ${chalk_1.default.bold(result.profile.name)}`);
            console.log(`     ${chalk_1.default.gray(`UUID: ${result.profile.uuid}`)}`);
            console.log(`     ${chalk_1.default.gray(`Bundle ID: ${result.profile.bundleId}`)}`);
            console.log(`     ${chalk_1.default.gray(`Team ID: ${result.profile.teamId}`)}`);
            console.log(`     ${chalk_1.default.gray(`过期时间: ${result.profile.expirationDate.toLocaleDateString()}`)}`);
            result.checks.forEach(check => {
                if (check.status !== types_1.CheckStatus.PASS) {
                    const icon = this.getStatusIcon(check.status);
                    const color = this.getStatusColor(check.status);
                    console.log(`     ${icon} ${color(check.message)}`);
                    if (check.details) {
                        console.log(`        ${chalk_1.default.gray(check.details)}`);
                    }
                }
            });
        });
        console.log('');
    }
    static printCertificateResults(report) {
        if (report.certificates.length === 0)
            return;
        console.log(chalk_1.default.bold('🔐 证书检查结果'));
        console.log('─────────────────────────────────────────────────────');
        report.certificates.forEach(result => {
            const statusIcon = this.getStatusIcon(result.overallStatus);
            console.log(`\n  ${statusIcon} ${chalk_1.default.bold(result.certificate.name || result.certificate.commonName)}`);
            console.log(`     ${chalk_1.default.gray(`类型: ${result.certificate.type}`)}`);
            console.log(`     ${chalk_1.default.gray(`Team ID: ${result.certificate.teamId}`)}`);
            console.log(`     ${chalk_1.default.gray(`过期时间: ${result.certificate.notAfter.toLocaleDateString()}`)}`);
            result.checks.forEach(check => {
                if (check.status !== types_1.CheckStatus.PASS) {
                    const icon = this.getStatusIcon(check.status);
                    const color = this.getStatusColor(check.status);
                    console.log(`     ${icon} ${color(check.message)}`);
                    if (check.details) {
                        console.log(`        ${chalk_1.default.gray(check.details)}`);
                    }
                }
            });
        });
        console.log('');
    }
    static printTargetResults(report) {
        if (report.targets.length === 0)
            return;
        console.log(chalk_1.default.bold('🎯 Target 检查结果'));
        console.log('─────────────────────────────────────────────────────');
        report.targets.forEach(result => {
            const statusIcon = this.getStatusIcon(result.overallStatus);
            const location = result.target.source !== 'cli'
                ? `${result.target.source}:${result.target.lineNumber}`
                : 'CLI';
            console.log(`\n  ${statusIcon} ${chalk_1.default.bold(result.target.name)}`);
            console.log(`     ${chalk_1.default.gray(`Bundle ID: ${result.target.bundleId}`)}`);
            console.log(`     ${chalk_1.default.gray(`来源: ${location}`)}`);
            if (result.matchedProfile) {
                console.log(`     ${chalk_1.default.green('✓')} 匹配 Profile: ${result.matchedProfile.name}`);
            }
            if (result.matchedCertificate) {
                console.log(`     ${chalk_1.default.green('✓')} 匹配证书: ${result.matchedCertificate.name}`);
            }
            result.checks.forEach(check => {
                if (check.status !== types_1.CheckStatus.PASS) {
                    const icon = this.getStatusIcon(check.status);
                    const color = this.getStatusColor(check.status);
                    const loc = check.location?.line ? ` [行 ${check.location.line}]` : '';
                    console.log(`     ${icon} ${color(check.message)}${loc}`);
                    if (check.details) {
                        console.log(`        ${chalk_1.default.gray(check.details)}`);
                    }
                }
            });
        });
        console.log('');
    }
    static printAllIssues(report) {
        const allIssues = [];
        report.profiles.forEach(r => allIssues.push(...r.checks.filter(c => c.status !== types_1.CheckStatus.PASS)));
        report.certificates.forEach(r => allIssues.push(...r.checks.filter(c => c.status !== types_1.CheckStatus.PASS)));
        report.targets.forEach(r => allIssues.push(...r.checks.filter(c => c.status !== types_1.CheckStatus.PASS)));
        if (allIssues.length === 0)
            return;
        console.log(chalk_1.default.bold('🔍 问题清单'));
        console.log('─────────────────────────────────────────────────────');
        const errors = allIssues.filter(c => c.status === types_1.CheckStatus.ERROR);
        const warnings = allIssues.filter(c => c.status === types_1.CheckStatus.WARN);
        if (errors.length > 0) {
            console.log(`\n  ${chalk_1.default.red.bold(`❌ 错误 (${errors.length})`)}`);
            errors.forEach((check, i) => {
                const location = check.location
                    ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
                    : '';
                console.log(`     ${i + 1}. ${chalk_1.default.red(check.message)}`);
                if (location) {
                    console.log(`        ${chalk_1.default.gray(location)}`);
                }
                if (check.details) {
                    console.log(`        ${chalk_1.default.gray(check.details)}`);
                }
            });
        }
        if (warnings.length > 0) {
            console.log(`\n  ${chalk_1.default.yellow.bold(`⚠️  警告 (${warnings.length})`)}`);
            warnings.forEach((check, i) => {
                const location = check.location
                    ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
                    : '';
                console.log(`     ${i + 1}. ${chalk_1.default.yellow(check.message)}`);
                if (location) {
                    console.log(`        ${chalk_1.default.gray(location)}`);
                }
                if (check.details) {
                    console.log(`        ${chalk_1.default.gray(check.details)}`);
                }
            });
        }
        console.log('');
    }
    static printFinalResult(report) {
        console.log('─────────────────────────────────────────────────────');
        if (report.exitCode === 0) {
            if (report.summary.warnings > 0) {
                console.log(chalk_1.default.yellow.bold('\n🎉 检查完成 (有警告)'));
                console.log(chalk_1.default.yellow(`   发现 ${report.summary.warnings} 个警告，请检查报告`));
            }
            else {
                console.log(chalk_1.default.green.bold('\n🎉 检查通过！'));
                console.log(chalk_1.default.green('   所有检查项均通过，可以放心打包'));
            }
        }
        else {
            console.log(chalk_1.default.red.bold('\n❌ 检查失败！'));
            console.log(chalk_1.default.red(`   发现 ${report.summary.errors} 个错误，请修复后重试`));
        }
        console.log(chalk_1.default.cyan(`\n退出码: ${report.exitCode}`));
        console.log(chalk_1.default.cyan('═══════════════════════════════════════════════════\n'));
    }
    static getStatusIcon(status) {
        switch (status) {
            case types_1.CheckStatus.PASS: return '✅';
            case types_1.CheckStatus.WARN: return '⚠️';
            case types_1.CheckStatus.ERROR: return '❌';
            case types_1.CheckStatus.SKIP: return '⏭️';
            default: return '❓';
        }
    }
    static getStatusColor(status) {
        switch (status) {
            case types_1.CheckStatus.PASS: return chalk_1.default.green;
            case types_1.CheckStatus.WARN: return chalk_1.default.yellow;
            case types_1.CheckStatus.ERROR: return chalk_1.default.red;
            case types_1.CheckStatus.SKIP: return chalk_1.default.gray;
            default: return chalk_1.default.white;
        }
    }
    static writeJsonReport(report, filePath) {
        const jsonData = JSON.stringify(report, null, 2);
        fs.writeFileSync(filePath, jsonData, 'utf8');
    }
    static writeMarkdownReport(report, filePath) {
        const content = this.generateMarkdownContent(report);
        fs.writeFileSync(filePath, content, 'utf8');
    }
    static generateMarkdownContent(report) {
        const lines = [];
        lines.push('# Xcode 证书体检报告');
        lines.push('');
        lines.push(`> 生成时间: ${report.generatedAt.toLocaleString()}`);
        lines.push(`> 退出码: ${report.exitCode}`);
        lines.push('');
        lines.push('## 📊 检查统计');
        lines.push('');
        lines.push('| 状态 | 数量 |');
        lines.push('|------|------|');
        lines.push(`| ✅ 通过 | ${report.summary.passed} |`);
        lines.push(`| ⚠️ 警告 | ${report.summary.warnings} |`);
        lines.push(`| ❌ 错误 | ${report.summary.errors} |`);
        lines.push(`| ⏭️ 跳过 | ${report.summary.skipped} |`);
        lines.push(`| **总计** | **${report.summary.total}** |`);
        lines.push('');
        if (report.profiles.length > 0) {
            lines.push('## 📱 Profile 检查结果');
            lines.push('');
            report.profiles.forEach(result => {
                const statusBadge = this.getMarkdownStatusBadge(result.overallStatus);
                lines.push(`### ${statusBadge} ${result.profile.name}`);
                lines.push('');
                lines.push('- **UUID**: ' + result.profile.uuid);
                lines.push('- **Bundle ID**: ' + result.profile.bundleId);
                lines.push('- **Team ID**: ' + result.profile.teamId);
                lines.push('- **Team Name**: ' + (result.profile.teamName || 'N/A'));
                lines.push('- **过期时间**: ' + result.profile.expirationDate.toLocaleString());
                lines.push('');
                const issues = result.checks.filter(c => c.status !== types_1.CheckStatus.PASS);
                if (issues.length > 0) {
                    lines.push('#### 问题');
                    lines.push('');
                    issues.forEach(check => {
                        const icon = this.getStatusIcon(check.status);
                        lines.push(`- ${icon} **${check.checkName}**: ${check.message}`);
                        if (check.details) {
                            lines.push(`  - ${check.details}`);
                        }
                    });
                    lines.push('');
                }
            });
        }
        if (report.certificates.length > 0) {
            lines.push('## 🔐 证书检查结果');
            lines.push('');
            report.certificates.forEach(result => {
                const statusBadge = this.getMarkdownStatusBadge(result.overallStatus);
                const name = result.certificate.name || result.certificate.commonName;
                lines.push(`### ${statusBadge} ${name}`);
                lines.push('');
                lines.push('- **类型**: ' + result.certificate.type);
                lines.push('- **Team ID**: ' + (result.certificate.teamId || 'N/A'));
                lines.push('- **Team Name**: ' + (result.certificate.teamName || 'N/A'));
                lines.push('- **生效时间**: ' + result.certificate.notBefore.toLocaleString());
                lines.push('- **过期时间**: ' + result.certificate.notAfter.toLocaleString());
                lines.push('');
                const issues = result.checks.filter(c => c.status !== types_1.CheckStatus.PASS);
                if (issues.length > 0) {
                    lines.push('#### 问题');
                    lines.push('');
                    issues.forEach(check => {
                        const icon = this.getStatusIcon(check.status);
                        lines.push(`- ${icon} **${check.checkName}**: ${check.message}`);
                        if (check.details) {
                            lines.push(`  - ${check.details}`);
                        }
                    });
                    lines.push('');
                }
            });
        }
        if (report.targets.length > 0) {
            lines.push('## 🎯 Target 检查结果');
            lines.push('');
            report.targets.forEach(result => {
                const statusBadge = this.getMarkdownStatusBadge(result.overallStatus);
                lines.push(`### ${statusBadge} ${result.target.name}`);
                lines.push('');
                lines.push('- **Bundle ID**: ' + result.target.bundleId);
                lines.push('- **来源**: ' + result.target.source + (result.target.lineNumber > 0 ? ` (行 ${result.target.lineNumber})` : ''));
                if (result.matchedProfile) {
                    lines.push('- **匹配 Profile**: ' + result.matchedProfile.name);
                }
                if (result.matchedCertificate) {
                    lines.push('- **匹配证书**: ' + result.matchedCertificate.name);
                }
                lines.push('');
                const issues = result.checks.filter(c => c.status !== types_1.CheckStatus.PASS);
                if (issues.length > 0) {
                    lines.push('#### 问题');
                    lines.push('');
                    issues.forEach(check => {
                        const icon = this.getStatusIcon(check.status);
                        const loc = check.location?.line ? ` (行 ${check.location.line})` : '';
                        lines.push(`- ${icon} **${check.checkName}**: ${check.message}${loc}`);
                        if (check.details) {
                            lines.push(`  - ${check.details}`);
                        }
                    });
                    lines.push('');
                }
            });
        }
        lines.push('## 📋 完整问题清单');
        lines.push('');
        const allChecks = [
            ...report.profiles.flatMap(r => r.checks),
            ...report.certificates.flatMap(r => r.checks),
            ...report.targets.flatMap(r => r.checks)
        ];
        const issues = allChecks.filter(c => c.status !== types_1.CheckStatus.PASS);
        if (issues.length === 0) {
            lines.push('✅ 没有发现任何问题！');
        }
        else {
            const errors = issues.filter(c => c.status === types_1.CheckStatus.ERROR);
            const warnings = issues.filter(c => c.status === types_1.CheckStatus.WARN);
            if (errors.length > 0) {
                lines.push(`### ❌ 错误 (${errors.length})`);
                lines.push('');
                errors.forEach((check, i) => {
                    const location = check.location
                        ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
                        : '未知位置';
                    lines.push(`${i + 1}. **${check.checkName}**: ${check.message}`);
                    lines.push(`   - 位置: ${location}`);
                    if (check.details) {
                        lines.push(`   - ${check.details}`);
                    }
                    lines.push('');
                });
            }
            if (warnings.length > 0) {
                lines.push(`### ⚠️ 警告 (${warnings.length})`);
                lines.push('');
                warnings.forEach((check, i) => {
                    const location = check.location
                        ? `${check.location.file}${check.location.line ? `:${check.location.line}` : ''}`
                        : '未知位置';
                    lines.push(`${i + 1}. **${check.checkName}**: ${check.message}`);
                    lines.push(`   - 位置: ${location}`);
                    if (check.details) {
                        lines.push(`   - ${check.details}`);
                    }
                    lines.push('');
                });
            }
        }
        lines.push('---');
        lines.push('');
        lines.push('*报告由 Xcode 证书体检 CLI 自动生成*');
        return lines.join('\n');
    }
    static getMarkdownStatusBadge(status) {
        switch (status) {
            case types_1.CheckStatus.PASS: return '✅ **通过**';
            case types_1.CheckStatus.WARN: return '⚠️ **警告**';
            case types_1.CheckStatus.ERROR: return '❌ **错误**';
            case types_1.CheckStatus.SKIP: return '⏭️ **跳过**';
            default: return '❓';
        }
    }
}
exports.ReportGenerator = ReportGenerator;
//# sourceMappingURL=reportGenerator.js.map