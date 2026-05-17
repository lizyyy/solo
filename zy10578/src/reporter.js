const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

class Reporter {
  constructor(options) {
    this.options = options;
    this.outputDir = options.output;
  }

  async generateAll(results) {
    await this.ensureOutputDir();
    this.printTerminalSummary(results);
    await this.generateMachineReadable(results);
    await this.generateHumanReport(results);
  }

  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (e) {}
  }

  printTerminalSummary(results) {
    const stats = results.statistics;
    
    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan('📊 正则规则回归测试摘要'));
    console.log(chalk.cyan('='.repeat(60)));
    
    const table = new Table({
      head: [chalk.white('指标'), chalk.white('数值')],
      colWidths: [30, 30]
    });
    
    table.push(
      ['总样本数', stats.totalSamples],
      ['总规则数', stats.totalRules],
      ['命中样本数', stats.matchedSamples],
      ['命中率', stats.matchRate],
      ['误报 (False Positives)', chalk.red(stats.falsePositives)],
      ['漏报 (False Negatives)', chalk.yellow(stats.falseNegatives)],
      ['差异项', chalk.magenta(stats.differences)],
      ['错误数', chalk.red(stats.errors)]
    );
    
    if (stats.accuracy) {
      table.push(['准确率', stats.accuracy]);
    }
    
    console.log(table.toString());
    
    if (results.falsePositives.length > 0) {
      console.log('\n' + chalk.red('❌ 误报样本 (前10条):'));
      results.falsePositives.slice(0, 10).forEach(item => {
        console.log(`  ${chalk.gray(item.sampleId)}: ${item.sampleContent.substring(0, 60)}...`);
      });
    }
    
    if (results.falseNegatives.length > 0) {
      console.log('\n' + chalk.yellow('⚠️  漏报样本 (前10条):'));
      results.falseNegatives.slice(0, 10).forEach(item => {
        console.log(`  ${chalk.gray(item.sampleId)}: ${item.sampleContent.substring(0, 60)}...`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log('\n' + chalk.red('🔥 错误记录:'));
      results.errors.forEach(err => {
        console.log(`  ${chalk.gray(err.type)}: ${err.error}`);
      });
    }
    
    const pass = stats.falsePositives === 0 && stats.falseNegatives === 0 && stats.errors === 0;
    console.log('\n' + (pass ? chalk.green('✅ 回归测试通过!') : chalk.red('❌ 回归测试失败!')));
  }

  async generateMachineReadable(results) {
    const jsonPath = path.join(this.outputDir, 'results.json');
    await fs.writeFile(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(chalk.gray(`\n📄 机器可读结果已保存: ${jsonPath}`));
  }

  async generateHumanReport(results) {
    const stats = results.statistics;
    const pass = stats.falsePositives === 0 && stats.falseNegatives === 0 && stats.errors === 0;
    
    let md = `# 正则规则回归测试报告\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    md += `## 测试结果\n\n`;
    md += `**整体状态**: ${pass ? '✅ 通过' : '❌ 失败'}\n\n`;
    
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总样本数 | ${stats.totalSamples} |\n`;
    md += `| 总规则数 | ${stats.totalRules} |\n`;
    md += `| 命中样本数 | ${stats.matchedSamples} |\n`;
    md += `| 命中率 | ${stats.matchRate} |\n`;
    md += `| 误报 | ${stats.falsePositives} |\n`;
    md += `| 漏报 | ${stats.falseNegatives} |\n`;
    md += `| 差异项 | ${stats.differences} |\n`;
    md += `| 错误数 | ${stats.errors} |\n`;
    if (stats.accuracy) {
      md += `| 准确率 | ${stats.accuracy} |\n`;
    }
    
    if (Object.keys(stats.ruleHitCount).length > 0) {
      md += `\n## 规则命中统计\n\n`;
      md += `| 规则ID | 命中次数 |\n`;
      md += `|--------|----------|\n`;
      Object.entries(stats.ruleHitCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([ruleId, count]) => {
          md += `| ${ruleId} | ${count} |\n`;
        });
    }
    
    if (results.falsePositives.length > 0) {
      md += `\n## ❌ 误报详情 (False Positives)\n\n`;
      md += `预期不命中但实际命中的样本：\n\n`;
      results.falsePositives.forEach((item, idx) => {
        md += `### ${idx + 1}. ${item.sampleId}\n\n`;
        md += `- **命中规则**: ${item.matchedRules.join(', ')}\n`;
        md += `- **原因**: ${item.reason}\n`;
        md += `- **样本内容**: \n\`\`\`\n${item.sampleContent}\n\`\`\`\n\n`;
      });
    }
    
    if (results.falseNegatives.length > 0) {
      md += `\n## ⚠️  漏报详情 (False Negatives)\n\n`;
      md += `预期命中但实际未命中的样本：\n\n`;
      results.falseNegatives.forEach((item, idx) => {
        md += `### ${idx + 1}. ${item.sampleId}\n\n`;
        md += `- **预期规则**: ${item.expectedRules.join(', ')}\n`;
        md += `- **原因**: ${item.reason}\n`;
        md += `- **样本内容**: \n\`\`\`\n${item.sampleContent}\n\`\`\`\n\n`;
      });
    }
    
    if (results.differences.length > 0) {
      md += `\n## 🔀 差异详情\n\n`;
      const unexpected = results.differences.filter(d => d.type === 'unexpected_match');
      const mismatch = results.differences.filter(d => d.type === 'rule_mismatch');
      
      if (unexpected.length > 0) {
        md += `### 未预期命中 (${unexpected.length}条)\n\n`;
        unexpected.forEach(item => {
          md += `- **${item.sampleId}**: 命中规则 ${item.matchedRules.join(', ')}\n`;
          md += `  > 样本: ${item.sampleContent.substring(0, 100)}...\n\n`;
        });
      }
      
      if (mismatch.length > 0) {
        md += `### 规则不匹配 (${mismatch.length}条)\n\n`;
        mismatch.forEach(item => {
          md += `- **${item.sampleId}**:\n`;
          if (item.missingRules.length) md += `  - 缺失规则: ${item.missingRules.join(', ')}\n`;
          if (item.extraRules.length) md += `  - 额外规则: ${item.extraRules.join(', ')}\n`;
          md += `  > 样本: ${item.sampleContent.substring(0, 100)}...\n\n`;
        });
      }
    }
    
    if (results.errors.length > 0) {
      md += `\n## 🔥 错误记录\n\n`;
      md += `| 类型 | 位置 | 错误信息 |\n`;
      md += `|------|------|----------|\n`;
      results.errors.forEach(err => {
        const pos = err.sampleId || err.ruleId || 'unknown';
        md += `| ${err.type} | ${pos} | ${err.error} |\n`;
      });
    }
    
    md += `\n---\n\n`;
    md += `*此报告由 regex-regress CLI 工具自动生成*\n`;
    
    const mdPath = path.join(this.outputDir, 'regression-report.md');
    await fs.writeFile(mdPath, md, 'utf-8');
    console.log(chalk.gray(`📄 人类友好报告已保存: ${mdPath}`));
  }
}

module.exports = Reporter;
