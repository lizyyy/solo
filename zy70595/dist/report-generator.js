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
const table_1 = require("table");
class ReportGenerator {
    generateTerminalReport(report) {
        const lines = [];
        lines.push(chalk_1.default.bold.blue('\n╔════════════════════════════════════════════════════════════╗'));
        lines.push(chalk_1.default.bold.blue('║           TypeScript Path Alias Diagnostic Report          ║'));
        lines.push(chalk_1.default.bold.blue('╚════════════════════════════════════════════════════════════╝\n'));
        lines.push(this.generateEnvironmentSummary(report));
        lines.push(this.generateSummary(report));
        lines.push(this.generateDirtyLinesTable(report.dirtyLines));
        lines.push(this.generateConflictsTable(report.conflicts));
        lines.push(this.generateResolutionsSummary(report));
        return lines.join('\n');
    }
    generateEnvironmentSummary(report) {
        const lines = [];
        lines.push(chalk_1.default.bold('🌍 Environment Configurations'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        for (const envConfig of report.environmentConfigs) {
            lines.push(`${chalk_1.default.cyan.bold(envConfig.name)}: ${chalk_1.default.gray(envConfig.tsconfigPath)}`);
            const aliasCount = Object.keys(envConfig.paths).length;
            lines.push(`   ${chalk_1.default.gray(`${aliasCount} path alias(es) configured`)}`);
        }
        lines.push('');
        return lines.join('\n');
    }
    generateSummary(report) {
        const { summary } = report;
        const lines = [];
        lines.push(chalk_1.default.bold('📊 Summary'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        const summaryData = [
            [chalk_1.default.white('Total Imports'), chalk_1.default.cyan(summary.totalImports.toString())],
            [chalk_1.default.white('Valid Imports'), chalk_1.default.green(summary.validImports.toString())],
            [chalk_1.default.white('Dirty Lines'), summary.dirtyLines > 0 ? chalk_1.default.yellow(summary.dirtyLines.toString()) : chalk_1.default.green('0')],
            [chalk_1.default.white('Conflicts'), summary.conflicts > 0 ? chalk_1.default.red(summary.conflicts.toString()) : chalk_1.default.green('0')],
        ];
        lines.push((0, table_1.table)(summaryData, {
            border: {
                topBody: '',
                topJoin: '',
                topLeft: '',
                topRight: '',
                bottomBody: '',
                bottomJoin: '',
                bottomLeft: '',
                bottomRight: '',
                bodyLeft: '│',
                bodyRight: '│',
                bodyJoin: '│',
                joinBody: '',
                joinLeft: '',
                joinRight: '',
                joinJoin: '',
            },
            drawHorizontalLine: () => false,
        }));
        return lines.join('\n');
    }
    generateDirtyLinesTable(dirtyLines) {
        if (dirtyLines.length === 0)
            return '';
        const lines = [];
        lines.push(chalk_1.default.bold.yellow('\n⚠️  Dirty Lines (Parse Errors)'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        const data = [
            [chalk_1.default.bold('Line'), chalk_1.default.bold('Category'), chalk_1.default.bold('Reason'), chalk_1.default.bold('Raw Line')],
            ...dirtyLines.map(dl => [
                chalk_1.default.yellow(dl.lineNumber.toString()),
                chalk_1.default.magenta(dl.category),
                chalk_1.default.red(dl.reason),
                chalk_1.default.gray(dl.rawLine.slice(0, 40) + (dl.rawLine.length > 40 ? '...' : '')),
            ]),
        ];
        lines.push((0, table_1.table)(data, {
            columns: [{ width: 6 }, { width: 15 }, { width: 20 }, { width: 45 }],
        }));
        return lines.join('\n');
    }
    generateConflictsTable(conflicts) {
        if (conflicts.length === 0)
            return '';
        const lines = [];
        lines.push(chalk_1.default.bold.red('\n❌ Conflicts Detected'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        for (const conflict of conflicts) {
            lines.push(`${chalk_1.default.red('●')} ${chalk_1.default.bold(conflict.importPath)}`);
            lines.push(`   ${chalk_1.default.gray('Type:')} ${chalk_1.default.magenta(conflict.type)}`);
            lines.push(`   ${chalk_1.default.gray('Description:')} ${conflict.description}`);
            lines.push(`   ${chalk_1.default.gray('Environment differences:')}`);
            for (const [env, data] of Object.entries(conflict.environments)) {
                const status = data.fileExists ? chalk_1.default.green('✓') : chalk_1.default.red('✗');
                lines.push(`     ${status} ${chalk_1.default.cyan(env)}: ${chalk_1.default.gray(data.resolvedPath)}`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    generateResolutionsSummary(report) {
        const lines = [];
        lines.push(chalk_1.default.bold.green('\n✅ Resolution Results by Environment'));
        lines.push(chalk_1.default.gray('─'.repeat(60)));
        for (const envResolution of report.resolutions) {
            const successCount = envResolution.results.filter(r => r.fileExists).length;
            const totalCount = envResolution.results.length;
            const percentage = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
            lines.push(`\n${chalk_1.default.cyan.bold(envResolution.environment)}: ${chalk_1.default.green(`${successCount}/${totalCount}`)} files exist (${percentage}%)`);
        }
        return lines.join('\n');
    }
    generateMachineReadableReport(report, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    }
    generateHumanReadableReport(report, outputPath) {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const markdown = this.generateMarkdownReport(report);
        fs.writeFileSync(outputPath, markdown, 'utf-8');
    }
    generateMarkdownReport(report) {
        const lines = [];
        lines.push('# TypeScript Path Alias Diagnostic Report');
        lines.push(`Generated: ${report.timestamp}`);
        lines.push('');
        lines.push('## Summary');
        lines.push('| Metric | Count | Status |');
        lines.push('|--------|-------|--------|');
        lines.push(`| Total Imports | ${report.summary.totalImports} | |`);
        lines.push(`| Valid Imports | ${report.summary.validImports} | ✅ |`);
        lines.push(`| Dirty Lines | ${report.summary.dirtyLines} | ${report.summary.dirtyLines > 0 ? '⚠️' : '✅'} |`);
        lines.push(`| Conflicts | ${report.summary.conflicts} | ${report.summary.conflicts > 0 ? '❌' : '✅'} |`);
        lines.push('');
        if (report.dirtyLines.length > 0) {
            lines.push('## ⚠️ Dirty Lines (Parse Errors)');
            lines.push('');
            lines.push('| Line | Category | Reason | Raw Line |');
            lines.push('|------|----------|--------|----------|');
            for (const dl of report.dirtyLines) {
                const escapedLine = dl.rawLine.replace(/\|/g, '\\|');
                lines.push(`| ${dl.lineNumber} | ${dl.category} | ${dl.reason} | \`${escapedLine}\` |`);
            }
            lines.push('');
        }
        if (report.conflicts.length > 0) {
            lines.push('## ❌ Conflicts Detected');
            lines.push('');
            for (const conflict of report.conflicts) {
                lines.push(`### \`${conflict.importPath}\``);
                lines.push(`- **Type**: ${conflict.type}`);
                lines.push(`- **Description**: ${conflict.description}`);
                lines.push('');
                lines.push('| Environment | Resolved Path | File Exists |');
                lines.push('|-------------|---------------|-------------|');
                for (const [env, data] of Object.entries(conflict.environments)) {
                    lines.push(`| ${env} | \`${data.resolvedPath}\` | ${data.fileExists ? '✅ Yes' : '❌ No'} |`);
                }
                lines.push('');
            }
        }
        lines.push('## Environment Configurations');
        lines.push('');
        for (const envConfig of report.environmentConfigs) {
            lines.push(`### ${envConfig.name}`);
            lines.push(`- **tsconfig path**: \`${envConfig.tsconfigPath}\``);
            lines.push('');
            lines.push('| Alias | Target Paths |');
            lines.push('|-------|--------------|');
            for (const [alias, targets] of Object.entries(envConfig.paths)) {
                lines.push(`| \`${alias}\` | ${targets.map(t => `\`${t}\``).join(', ')} |`);
            }
            lines.push('');
        }
        lines.push('## Resolution Details');
        lines.push('');
        for (const envResolution of report.resolutions) {
            lines.push(`### ${envResolution.environment}`);
            lines.push('');
            lines.push('| Import Path | Resolved Path | File Exists | Matched Alias |');
            lines.push('|-------------|---------------|-------------|---------------|');
            for (const result of envResolution.results) {
                lines.push(`| \`${result.originalPath}\` | \`${result.resolvedPath}\` | ${result.fileExists ? '✅' : '❌'} | ${result.matchedAlias ? `\`${result.matchedAlias}\`` : '-'} |`);
            }
            lines.push('');
        }
        return lines.join('\n');
    }
    getExitCode(report) {
        if (report.summary.conflicts > 0 || report.summary.dirtyLines > 0) {
            return 1;
        }
        return 0;
    }
}
exports.ReportGenerator = ReportGenerator;
