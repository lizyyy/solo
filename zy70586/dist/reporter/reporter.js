"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reporter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
class Reporter {
    generateConsoleSummary(result) {
        console.log('\n' + chalk_1.default.bold.cyan('═══════════════════════════════════════════════════════════════════'));
        console.log(chalk_1.default.bold.cyan('                    Feature Flag 死分支扫描报告'));
        console.log(chalk_1.default.bold.cyan('═══════════════════════════════════════════════════════════════════\n'));
        this.printScanInfo(result);
        this.printFlagsSummary(result);
        this.printReferencesSummary(result);
        this.printDeadBranchesSummary(result);
        this.printBadSamplesSummary(result);
        console.log('\n' + chalk_1.default.bold.cyan('═══════════════════════════════════════════════════════════════════\n'));
    }
    printScanInfo(result) {
        console.log(chalk_1.default.bold('📊 扫描信息'));
        const table = new cli_table3_1.default({
            head: ['项目', '值'],
            style: { head: ['cyan'] }
        });
        table.push(['源码目录', result.scanInfo.sourceDir], ['扫描文件数', result.scanInfo.filesScanned.toString()], ['开关清单来源', result.scanInfo.flagsSource], ['开始时间', new Date(result.scanInfo.startTime).toLocaleString('zh-CN')], ['结束时间', new Date(result.scanInfo.endTime).toLocaleString('zh-CN')], ['耗时', `${(new Date(result.scanInfo.endTime).getTime() - new Date(result.scanInfo.startTime).getTime()) / 1000} 秒`]);
        console.log(table.toString() + '\n');
    }
    printFlagsSummary(result) {
        const { flags } = result;
        console.log(chalk_1.default.bold('🚩 开关信息'));
        const table = new cli_table3_1.default({
            head: ['统计项', '数量'],
            style: { head: ['cyan'] }
        });
        table.push(['总开关数', flags.total.toString()], ['已分析', flags.analyzed.toString()], [chalk_1.default.red('含死分支'), chalk_1.default.red(flags.withDeadBranches.toString())]);
        console.log(table.toString() + '\n');
        if (flags.withDeadBranches > 0) {
            console.log(chalk_1.default.bold.yellow('  含死分支的开关：'));
            const deadFlags = new Set(result.deadBranches.list.map(b => b.flagName));
            deadFlags.forEach(flag => {
                const flagInfo = flags.list.find(f => f.name === flag);
                console.log(chalk_1.default.yellow(`    - ${flag} (默认值: ${flagInfo?.defaultValue})`));
            });
            console.log('');
        }
    }
    printReferencesSummary(result) {
        const { references } = result;
        console.log(chalk_1.default.bold('🔗 引用信息'));
        const table = new cli_table3_1.default({
            head: ['统计项', '数量'],
            style: { head: ['cyan'] }
        });
        table.push(['总引用数', references.total.toString()]);
        console.log(table.toString());
        const topFiles = Object.entries(references.byFile)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        if (topFiles.length > 0) {
            console.log(chalk_1.default.gray('\n  引用最多的文件 Top 5:'));
            topFiles.forEach(([file, count]) => {
                console.log(chalk_1.default.gray(`    ${count} 次 - ${file}`));
            });
        }
        console.log('');
    }
    printDeadBranchesSummary(result) {
        const { deadBranches } = result;
        console.log(chalk_1.default.bold('💀 死分支信息'));
        const highCount = deadBranches.list.filter(b => b.confidence === 'high').length;
        const mediumCount = deadBranches.list.filter(b => b.confidence === 'medium').length;
        const lowCount = deadBranches.list.filter(b => b.confidence === 'low').length;
        const table = new cli_table3_1.default({
            head: ['置信度', '数量'],
            style: { head: ['cyan'] }
        });
        table.push([chalk_1.default.red('高 (High)'), chalk_1.default.red(highCount.toString())], [chalk_1.default.yellow('中 (Medium)'), chalk_1.default.yellow(mediumCount.toString())], [chalk_1.default.gray('低 (Low)'), chalk_1.default.gray(lowCount.toString())], [chalk_1.default.bold('总计'), chalk_1.default.bold(deadBranches.total.toString())]);
        console.log(table.toString());
        if (deadBranches.total > 0) {
            console.log(chalk_1.default.bold.red('\n  高置信度死分支示例 (前 5 个):'));
            const highConfidence = deadBranches.list.filter(b => b.confidence === 'high').slice(0, 5);
            highConfidence.forEach(branch => {
                console.log(chalk_1.default.red(`    📍 ${branch.filePath}:${branch.lineNumber}`));
                console.log(chalk_1.default.red(`       开关: ${branch.flagName} (默认值: ${branch.defaultValue})`));
                console.log(chalk_1.default.red(`       类型: ${this.getBranchTypeName(branch.branchType)}`));
                console.log(chalk_1.default.gray(`       代码: ${branch.rawCode}`));
                console.log(chalk_1.default.green(`       建议: ${branch.suggestion}\n`));
            });
        }
    }
    printBadSamplesSummary(result) {
        const { badSamples } = result;
        if (badSamples.length === 0)
            return;
        console.log(chalk_1.default.bold.yellow('⚠️ 异常样本信息'));
        console.log(chalk_1.default.yellow(`  共发现 ${badSamples.length} 个异常样本\n`));
        badSamples.slice(0, 5).forEach(sample => {
            const location = sample.lineNumber ? `${sample.filePath}:${sample.lineNumber}` : sample.filePath;
            console.log(chalk_1.default.yellow(`    📍 ${location}`));
            console.log(chalk_1.default.yellow(`       类型: ${sample.errorType}`));
            console.log(chalk_1.default.yellow(`       原因: ${sample.reason}`));
            if (sample.rawContent) {
                console.log(chalk_1.default.gray(`       内容: ${sample.rawContent.slice(0, 100)}...`));
            }
            console.log('');
        });
        if (badSamples.length > 5) {
            console.log(chalk_1.default.yellow(`    ...还有 ${badSamples.length - 5} 个异常样本，请查看完整报告\n`));
        }
    }
    getBranchTypeName(type) {
        const names = {
            'true-branch': 'if 分支 (true)',
            'false-branch': 'else 分支 (false)',
            'entire-condition': '整个条件判断'
        };
        return names[type] || type;
    }
    async generateJsonReport(result, outputPath) {
        fs_1.default.mkdirSync(path_1.default.dirname(outputPath), { recursive: true });
        fs_1.default.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(chalk_1.default.green(`✅ JSON 报告已生成: ${outputPath}`));
    }
    async generateMarkdownReport(result, outputPath) {
        const content = this.buildMarkdownContent(result);
        fs_1.default.mkdirSync(path_1.default.dirname(outputPath), { recursive: true });
        fs_1.default.writeFileSync(outputPath, content, 'utf-8');
        console.log(chalk_1.default.green(`✅ Markdown 报告已生成: ${outputPath}`));
    }
    buildMarkdownContent(result) {
        let content = `# Feature Flag 死分支扫描报告

## 📊 扫描概览

| 项目 | 详情 |
|------|------|
| 源码目录 | \`${result.scanInfo.sourceDir}\` |
| 扫描文件数 | ${result.scanInfo.filesScanned} |
| 开关清单来源 | \`${result.scanInfo.flagsSource}\` |
| 扫描时间 | ${new Date(result.scanInfo.startTime).toLocaleString('zh-CN')} |
| 耗时 | ${(new Date(result.scanInfo.endTime).getTime() - new Date(result.scanInfo.startTime).getTime()) / 1000} 秒 |

## 🚩 开关统计

| 统计项 | 数量 |
|--------|------|
| 总开关数 | ${result.flags.total} |
| 已分析 | ${result.flags.analyzed} |
| 含死分支 | ${result.flags.withDeadBranches} |

## 💀 死分支统计

| 置信度 | 数量 |
|--------|------|
| 高 | ${result.deadBranches.list.filter(b => b.confidence === 'high').length} |
| 中 | ${result.deadBranches.list.filter(b => b.confidence === 'medium').length} |
| 低 | ${result.deadBranches.list.filter(b => b.confidence === 'low').length} |
| **总计** | **${result.deadBranches.total}** |

## 死分支详情

### 高置信度建议清理

`;
        const highBranches = result.deadBranches.list.filter(b => b.confidence === 'high');
        if (highBranches.length > 0) {
            highBranches.forEach(branch => {
                content += `#### ${branch.flagName} @ ${branch.filePath}:${branch.lineNumber}\n\n`;
                content += `- **默认值**: ${branch.defaultValue}\n`;
                content += `- **分支类型**: ${this.getBranchTypeName(branch.branchType)}\n`;
                content += `- **原始代码**:\n\`\`\`\n${branch.rawCode}\n\`\`\`\n`;
                content += `- **清理建议**: ${branch.suggestion}\n\n`;
            });
        }
        else {
            content += '暂无高置信度死分支。\n\n';
        }
        content += `### 中置信度建议检查

`;
        const mediumBranches = result.deadBranches.list.filter(b => b.confidence === 'medium');
        if (mediumBranches.length > 0) {
            mediumBranches.forEach(branch => {
                content += `- [ ] ${branch.flagName} @ ${branch.filePath}:${branch.lineNumber} - ${branch.suggestion}\n`;
            });
        }
        else {
            content += '暂无中置信度死分支。\n';
        }
        content += `\n## ⚠️ 异常样本

发现 ${result.badSamples.length} 个异常样本：

| 文件 | 行号 | 类型 | 原因 |
|------|------|------|------|
`;
        result.badSamples.forEach(sample => {
            content += `| ${sample.filePath} | ${sample.lineNumber || '-'} | ${sample.errorType} | ${sample.reason} |\n`;
        });
        content += `\n## 🔧 清理行动计划

建议按以下步骤进行清理：

1. **优先处理高置信度死分支**（共 ${highBranches.length} 个）
2. **人工审核中置信度分支**（共 ${mediumBranches.length} 个）
3. **修复异常样本中发现的问题**
4. **提交代码前运行测试确保功能正常**

---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;
        return content;
    }
    async generateHtmlReport(result, outputPath) {
        const content = this.buildHtmlContent(result);
        fs_1.default.mkdirSync(path_1.default.dirname(outputPath), { recursive: true });
        fs_1.default.writeFileSync(outputPath, content, 'utf-8');
        console.log(chalk_1.default.green(`✅ HTML 报告已生成: ${outputPath}`));
    }
    buildHtmlContent(result) {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feature Flag 死分支扫描报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 30px; }
        h2 { color: #34495e; margin-top: 30px; margin-bottom: 15px; }
        h3 { color: #7f8c8d; margin-top: 20px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; }
        tr:hover { background: #f8f9fa; }
        .high { background: #ffebee; }
        .medium { background: #fff8e1; }
        .low { background: #f5f5f5; }
        .dead-branch { background: #fff3f3; border-left: 4px solid #e74c3c; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .code-block { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; font-family: 'Fira Code', monospace; overflow-x: auto; margin: 10px 0; }
        .suggestion { color: #27ae60; font-weight: bold; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-right: 8px; }
        .badge-high { background: #e74c3c; color: white; }
        .badge-medium { background: #f39c12; color: white; }
        .badge-low { background: #95a5a6; color: white; }
        .warning { background: #fff8e1; border-left: 4px solid #f39c12; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 36px; font-weight: bold; color: #3498db; }
        .stat-label { color: #7f8c8d; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚩 Feature Flag 死分支扫描报告</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${result.scanInfo.filesScanned}</div>
                <div class="stat-label">扫描文件数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.flags.total}</div>
                <div class="stat-label">开关总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" style="color: #e74c3c;">${result.deadBranches.total}</div>
                <div class="stat-label">死分支数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${result.badSamples.length}</div>
                <div class="stat-label">异常样本</div>
            </div>
        </div>

        <h2>📊 扫描信息</h2>
        <table>
            <tr><th>项目</th><th>详情</th></tr>
            <tr><td>源码目录</td><td><code>${result.scanInfo.sourceDir}</code></td></tr>
            <tr><td>开关清单来源</td><td><code>${result.scanInfo.flagsSource}</code></td></tr>
            <tr><td>扫描时间</td><td>${new Date(result.scanInfo.startTime).toLocaleString('zh-CN')}</td></tr>
        </table>

        <h2>💀 死分支详情</h2>
        
        <h3>高置信度 - 建议立即清理</h3>
        ${this.renderDeadBranchesHtml(result.deadBranches.list.filter(b => b.confidence === 'high'), 'high')}
        
        <h3>中置信度 - 建议人工审核</h3>
        ${this.renderDeadBranchesHtml(result.deadBranches.list.filter(b => b.confidence === 'medium'), 'medium')}
        
        <h3>低置信度 - 建议进一步检查</h3>
        ${this.renderDeadBranchesHtml(result.deadBranches.list.filter(b => b.confidence === 'low'), 'low')}

        <h2>⚠️ 异常样本</h2>
        ${result.badSamples.length > 0 ? this.renderBadSamplesHtml(result.badSamples) : '<p>暂无异常样本。</p>'}
        
        <h2>📋 清理清单</h2>
        <div style="background: #e8f5e9; padding: 20px; border-radius: 8px;">
            <h3>清理优先级建议：</h3>
            <ol>
                <li>✅ 高置信度死分支 (${result.deadBranches.list.filter(b => b.confidence === 'high').length} 个)</li>
                <li>⚠️ 中置信度死分支 (${result.deadBranches.list.filter(b => b.confidence === 'medium').length} 个)</li>
                <li>🔍 低置信度死分支 (${result.deadBranches.list.filter(b => b.confidence === 'low').length} 个)</li>
                <li>🛠️ 修复异常样本中发现的问题 (${result.badSamples.length} 个)</li>
            </ol>
        </div>
        
        <hr style="margin: 40px 0; border-color: #eee;">
        <p style="text-align: center; color: #95a5a6;">
            报告生成时间: ${new Date().toLocaleString('zh-CN')}
        </p>
    </div>
</body>
</html>`;
    }
    renderDeadBranchesHtml(branches, level) {
        if (branches.length === 0)
            return '<p>暂无此类死分支。</p>';
        return branches.map(branch => `
        <div class="dead-branch ${level}">
            <p>
                <span class="badge badge-${level}">${level === 'high' ? '高' : level === 'medium' ? '中' : '低'}</span>
                <strong>${branch.flagName}</strong> @ <code>${branch.filePath}:${branch.lineNumber}</code>
                (默认值: <strong>${branch.defaultValue}</strong>)
            </p>
            <p>分支类型: ${this.getBranchTypeName(branch.branchType)}</p>
            <div class="code-block">${branch.rawCode}</div>
            <p class="suggestion">💡 清理建议: ${branch.suggestion}</p>
        </div>
    `).join('');
    }
    renderBadSamplesHtml(samples) {
        return samples.map(sample => `
        <div class="warning">
            <p>
                <strong>📍 ${sample.filePath}${sample.lineNumber ? ':' + sample.lineNumber : ''}</strong>
                <span style="color: #e67e22; margin-left: 10px;">[${sample.errorType}]</span>
            </p>
            <p>原因: ${sample.reason}</p>
            ${sample.rawContent ? `<div class="code-block" style="font-size: 12px;">${sample.rawContent.slice(0, 200)}${sample.rawContent.length > 200 ? '...' : ''}</div>` : ''}
        </div>
    `).join('');
    }
}
exports.Reporter = Reporter;
//# sourceMappingURL=reporter.js.map