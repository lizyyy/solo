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
exports.OutputGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
class OutputGenerator {
    constructor(result, outputDir) {
        this.result = result;
        this.outputDir = outputDir || process.cwd();
        this.ensureOutputDir();
    }
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    getOutputPath(extension) {
        return path.join(this.outputDir, `${this.result.outputBase}${extension}`);
    }
    writeJson() {
        const outputPath = this.getOutputPath('.json');
        const jsonData = {
            success: this.result.success,
            exitCode: this.result.exitCode,
            inputFile: this.result.inputFile,
            timestamp: this.result.timestamp,
            statistics: this.result.statistics,
            anchors: this.result.anchors.map((a) => ({
                name: a.name,
                location: a.location,
                valuePreview: this.getValuePreview(a.value),
            })),
            mergeNodes: this.result.mergeNodes,
            overrides: this.result.overrides.map((o) => ({
                ...o,
                oldValuePreview: this.getValuePreview(o.oldValue),
                newValuePreview: this.getValuePreview(o.newValue),
            })),
            errors: this.result.errors,
            warnings: this.result.warnings,
            expandedYaml: this.result.expandedYaml,
        };
        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
        return outputPath;
    }
    writeMarkdown() {
        const outputPath = this.getOutputPath('.md');
        const content = this.generateMarkdown();
        fs.writeFileSync(outputPath, content, 'utf-8');
        return outputPath;
    }
    writeExpandedYaml() {
        const outputPath = this.getOutputPath('.expanded.yaml');
        fs.writeFileSync(outputPath, this.result.expandedYaml, 'utf-8');
        return outputPath;
    }
    getValuePreview(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'object') {
            return `[${Array.isArray(value) ? 'Array' : 'Object'}]`;
        }
        return String(value);
    }
    generateMarkdown() {
        const lines = [];
        lines.push(`# YAML锚点展开报告`);
        lines.push('');
        lines.push(`> 生成时间: ${new Date(this.result.timestamp).toLocaleString()}`);
        lines.push(`> 输入文件: \`${this.result.inputFile}\``);
        lines.push(`> 执行状态: ${this.result.success ? '✅ 成功' : '❌ 失败'}`);
        lines.push(`> 退出码: \`${this.result.exitCode}\``);
        lines.push('');
        lines.push('## 统计摘要');
        lines.push('');
        lines.push('| 指标 | 数量 |');
        lines.push('|------|------|');
        lines.push(`| 锚点总数 | ${this.result.statistics.totalAnchors} |`);
        lines.push(`| 合并操作数 | ${this.result.statistics.totalMerges} |`);
        lines.push(`| 覆盖操作数 | ${this.result.statistics.totalOverrides} |`);
        lines.push(`| 错误数 | ${this.result.statistics.totalErrors} |`);
        lines.push(`| 警告数 | ${this.result.statistics.totalWarnings} |`);
        lines.push('');
        if (this.result.anchors.length > 0) {
            lines.push('## 锚点定义');
            lines.push('');
            for (const anchor of this.result.anchors) {
                lines.push(`### &${anchor.name}`);
                lines.push(`- 位置: 第 ${anchor.location.line} 行, 第 ${anchor.location.column} 列`);
                lines.push('- 值预览:');
                lines.push('```yaml');
                lines.push(this.formatValue(anchor.value)
                    .split('\n')
                    .map((l) => '  ' + l)
                    .join('\n'));
                lines.push('```');
                lines.push('');
            }
        }
        if (this.result.mergeNodes.length > 0) {
            lines.push('## 合并操作 (<<)');
            lines.push('');
            for (const merge of this.result.mergeNodes) {
                lines.push(`### 节点路径: \`${merge.path || '(根节点)'}\``);
                lines.push(`- 合并位置: 第 ${merge.location.line} 行`);
                lines.push('- 合并来源:');
                for (const source of merge.sources) {
                    lines.push(`  - \`*${source.anchorName}\` (第 ${source.location.line} 行)`);
                    lines.push(`    - 包含键: ${source.keys.join(', ')}`);
                }
                lines.push('');
            }
        }
        if (this.result.overrides.length > 0) {
            lines.push('## 值覆盖详情');
            lines.push('');
            lines.push('| 路径 | 键 | 原始值 | 新值 | 来源锚点 |');
            lines.push('|------|----|--------|------|----------|');
            for (const override of this.result.overrides) {
                const oldVal = this.getValuePreview(override.oldValue);
                const newVal = this.getValuePreview(override.newValue);
                const source = override.sourceAnchor ? `*${override.sourceAnchor}` : '-';
                lines.push(`| \`${override.path || '(根)'}\` | \`${override.key}\` | \`${oldVal}\` | \`${newVal}\` | ${source} |`);
            }
            lines.push('');
        }
        if (this.result.errors.length > 0) {
            lines.push('## ❌ 错误信息');
            lines.push('');
            for (const error of this.result.errors) {
                lines.push(`### 第 ${error.location.line} 行错误`);
                lines.push(`- 消息: ${error.message}`);
                lines.push(`- 位置: 第 ${error.location.line} 行, 第 ${error.location.column} 列`);
                if (error.context) {
                    lines.push('- 上下文:');
                    lines.push('```');
                    lines.push(error.context);
                    lines.push('```');
                }
                lines.push('');
            }
        }
        if (this.result.warnings.length > 0) {
            lines.push('## ⚠️ 警告信息');
            lines.push('');
            for (const warning of this.result.warnings) {
                lines.push(`- 第 ${warning.location.line} 行: ${warning.message}`);
            }
            lines.push('');
        }
        lines.push('## 展开后的YAML');
        lines.push('');
        lines.push('```yaml');
        lines.push(this.result.expandedYaml);
        lines.push('```');
        lines.push('');
        return lines.join('\n');
    }
    formatValue(value) {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            }
            catch {
                return '[复杂对象]';
            }
        }
        return String(value);
    }
    printTerminalSummary() {
        console.log('');
        console.log(chalk_1.default.bold('📊 YAML锚点展开摘要'));
        console.log('');
        if (this.result.success) {
            console.log(chalk_1.default.green('✅ 展开成功'));
        }
        else {
            console.log(chalk_1.default.red(`❌ 展开失败 (退出码: ${this.result.exitCode})`));
        }
        console.log('');
        console.log(chalk_1.default.underline('统计信息:'));
        console.log(`  锚点数量: ${chalk_1.default.cyan(String(this.result.statistics.totalAnchors))}`);
        console.log(`  合并操作: ${chalk_1.default.cyan(String(this.result.statistics.totalMerges))}`);
        console.log(`  覆盖操作: ${chalk_1.default.cyan(String(this.result.statistics.totalOverrides))}`);
        if (this.result.errors.length > 0) {
            console.log(chalk_1.default.red(`  错误: ${this.result.errors.length}`));
            for (const error of this.result.errors) {
                console.log(chalk_1.default.red(`    - 第 ${error.location.line} 行: ${error.message}`));
            }
        }
        if (this.result.warnings.length > 0) {
            console.log(chalk_1.default.yellow(`  警告: ${this.result.warnings.length}`));
        }
        console.log('');
        console.log(chalk_1.default.underline('输出文件:'));
        console.log(`  JSON结果: ${chalk_1.default.magenta(this.getOutputPath('.json'))}`);
        console.log(`  Markdown报告: ${chalk_1.default.magenta(this.getOutputPath('.md'))}`);
        console.log(`  展开YAML: ${chalk_1.default.magenta(this.getOutputPath('.expanded.yaml'))}`);
        console.log('');
    }
}
exports.OutputGenerator = OutputGenerator;
