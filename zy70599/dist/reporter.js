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
exports.Reporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class Reporter {
    generateConsoleSummary(result) {
        console.log('\n' + chalk_1.default.bold.blue('='.repeat(60)));
        console.log(chalk_1.default.bold.blue('           数据字典差异分析摘要'));
        console.log(chalk_1.default.bold.blue('='.repeat(60)) + '\n');
        console.log(chalk_1.default.bold('分析时间: ') + new Date(result.timestamp).toLocaleString('zh-CN'));
        console.log(chalk_1.default.bold('参与系统: ') + result.sources.map(s => s.systemName).join(', ') + '\n');
        console.log(chalk_1.default.bold.underline('📊 统计概览'));
        console.log(`  总字段数: ${result.summary.totalFields}`);
        console.log(`  公共字段: ${result.summary.commonFields}`);
        console.log(`  解析错误: ${result.summary.parseErrors}\n`);
        console.log(chalk_1.default.bold.underline('⚠️  冲突统计'));
        if (result.summary.criticalConflicts > 0) {
            console.log(chalk_1.default.red(`  🔴 严重冲突: ${result.summary.criticalConflicts}`));
        }
        else {
            console.log(chalk_1.default.green(`  🔴 严重冲突: 0`));
        }
        if (result.summary.warningConflicts > 0) {
            console.log(chalk_1.default.yellow(`  🟡 警告冲突: ${result.summary.warningConflicts}`));
        }
        else {
            console.log(chalk_1.default.green(`  🟡 警告冲突: 0`));
        }
        if (result.summary.infoConflicts > 0) {
            console.log(chalk_1.default.cyan(`  🔵 说明差异: ${result.summary.infoConflicts}`));
        }
        else {
            console.log(chalk_1.default.green(`  🔵 说明差异: 0`));
        }
        console.log('');
        const criticalConflicts = result.conflicts.filter(c => c.level === 'critical');
        if (criticalConflicts.length > 0) {
            console.log(chalk_1.default.bold.red('🔴 重点关注 - 严重冲突:'));
            criticalConflicts.slice(0, 5).forEach(c => {
                console.log(chalk_1.default.red(`  • ${c.fieldName}: ${c.details.split(': ')[1]?.split(';')[0] || c.details}`));
            });
            if (criticalConflicts.length > 5) {
                console.log(chalk_1.default.red(`  ... 还有 ${criticalConflicts.length - 5} 个严重冲突`));
            }
            console.log('');
        }
        if (result.parseErrors.length > 0) {
            console.log(chalk_1.default.bold.magenta('❌ 解析错误（已保留原始位置）:'));
            result.parseErrors.slice(0, 3).forEach(e => {
                console.log(chalk_1.default.magenta(`  • ${path.basename(e.filePath)} 第${e.lineNumber}行: ${e.reason}`));
            });
            if (result.parseErrors.length > 3) {
                console.log(chalk_1.default.magenta(`  ... 还有 ${result.parseErrors.length - 3} 个解析错误`));
            }
            console.log('');
        }
        console.log(chalk_1.default.gray('💡 完整详情请查看输出报告文件\n'));
    }
    generateJsonReport(result, outputPath) {
        const jsonOutput = {
            ...result,
            sources: result.sources.map(s => ({
                ...s,
                filePath: path.resolve(s.filePath)
            })),
            parseErrors: result.parseErrors.map(e => ({
                ...e,
                filePath: path.resolve(e.filePath)
            }))
        };
        fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');
    }
    generateMarkdownReport(result, outputPath) {
        const lines = [];
        lines.push('# 数据字典差异分析报告');
        lines.push('');
        lines.push(`**生成时间**: ${new Date(result.timestamp).toLocaleString('zh-CN')}`);
        lines.push('');
        lines.push('## 参与系统');
        lines.push('');
        lines.push('| 系统名称 | 文件路径 | 字段数量 | 解析错误 |');
        lines.push('|---------|---------|---------|---------|');
        result.sources.forEach(s => {
            lines.push(`| ${s.systemName} | \`${path.basename(s.filePath)}\` | ${s.fieldCount} | ${s.errorCount} |`);
        });
        lines.push('');
        lines.push('## 统计概览');
        lines.push('');
        lines.push(`- **总字段数**: ${result.summary.totalFields}`);
        lines.push(`- **公共字段**: ${result.summary.commonFields}`);
        lines.push(`- **严重冲突**: ${result.summary.criticalConflicts}`);
        lines.push(`- **警告冲突**: ${result.summary.warningConflicts}`);
        lines.push(`- **说明差异**: ${result.summary.infoConflicts}`);
        lines.push(`- **解析错误**: ${result.summary.parseErrors}`);
        lines.push('');
        if (result.conflicts.length > 0) {
            lines.push('## 冲突详情');
            lines.push('');
            const levelLabels = {
                critical: '🔴 严重',
                warning: '🟡 警告',
                info: '🔵 说明'
            };
            const typeLabels = {
                type_mismatch: '类型不匹配',
                enum_mismatch: '枚举值不匹配',
                description_mismatch: '业务说明不一致',
                missing_field: '字段缺失'
            };
            ['critical', 'warning', 'info'].forEach(level => {
                const levelConflicts = result.conflicts.filter(c => c.level === level);
                if (levelConflicts.length === 0)
                    return;
                lines.push(`### ${levelLabels[level]}冲突 (${levelConflicts.length})`);
                lines.push('');
                lines.push('| 字段名 | 冲突类型 | 详情 |');
                lines.push('|-------|---------|------|');
                levelConflicts.forEach(c => {
                    lines.push(`| \`${c.fieldName}\` | ${typeLabels[c.type]} | ${c.details} |`);
                });
                lines.push('');
            });
        }
        if (result.parseErrors.length > 0) {
            lines.push('## 解析错误（可追溯）');
            lines.push('');
            lines.push('| 文件 | 行号 | 原因 | 原始内容 |');
            lines.push('|------|------|------|----------|');
            result.parseErrors.forEach(e => {
                const rawContent = e.rawContent.length > 50
                    ? e.rawContent.substring(0, 50) + '...'
                    : e.rawContent;
                lines.push(`| \`${path.basename(e.filePath)}\` | ${e.lineNumber} | ${e.reason} | \`${rawContent}\` |`);
            });
            lines.push('');
        }
        lines.push('## 建议');
        lines.push('');
        if (result.summary.criticalConflicts > 0) {
            lines.push('- **优先处理严重冲突**: 类型不匹配和字段缺失会直接影响接口联调');
        }
        if (result.summary.warningConflicts > 0) {
            lines.push('- **统一枚举值**: 建议召开会议，共同确定枚举值的标准定义');
        }
        if (result.summary.infoConflicts > 0) {
            lines.push('- **完善业务说明**: 建议统一字段的业务描述，避免歧义');
        }
        if (result.summary.parseErrors > 0) {
            lines.push('- **修复数据文件**: 请检查并修复上述解析错误，确保数据完整性');
        }
        if (result.summary.criticalConflicts === 0 && result.summary.warningConflicts === 0) {
            lines.push('- ✅ 数据字典一致性良好，建议定期复查');
        }
        lines.push('');
        fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    }
    ensureDir(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
exports.Reporter = Reporter;
