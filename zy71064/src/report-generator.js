const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || process.cwd();
    this.verbose = options.verbose !== false;
  }

  generate(data) {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: this._buildSummary(data),
      headings: data.headings || [],
      chapters: data.chapters || [],
      ownerMatches: data.ownerMatches || [],
      brokenLinks: data.brokenLinks || [],
      unparsedRecords: data.unparsedRecords || [],
      statistics: data.statistics || {}
    };

    return report;
  }

  _buildSummary(data) {
    const summary = {
      totalFiles: (data.files || []).length,
      totalHeadings: (data.headings || []).length,
      totalChapters: (data.chapters || []).length,
      chaptersWithOwner: 0,
      chaptersWithoutOwner: 0,
      brokenLinks: (data.brokenLinks || []).length,
      unparsedRecords: (data.unparsedRecords || []).length,
      ownerMatchErrors: 0,
      exitCode: 0
    };

    (data.chapters || []).forEach(chapter => {
      if (chapter.owner) {
        summary.chaptersWithOwner++;
      } else {
        summary.chaptersWithoutOwner++;
      }
    });

    (data.ownerMatches || []).forEach(match => {
      if (!match.matched) {
        summary.ownerMatchErrors++;
      }
    });

    if (summary.chaptersWithoutOwner > 0 || summary.brokenLinks > 0 || summary.ownerMatchErrors > 0) {
      summary.exitCode = 1;
    }

    return summary;
  }

  printTerminalSummary(report) {
    const { summary } = report;

    console.log('\n');
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.blue('                    章节归属分析报告'));
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log(`生成时间: ${new Date(report.generatedAt).toLocaleString()}`);
    console.log('');

    console.log(chalk.bold.yellow('📊 统计摘要'));
    console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
    console.log(`  文件数量:        ${summary.totalFiles}`);
    console.log(`  标题总数:        ${summary.totalHeadings}`);
    console.log(`  章节总数:        ${summary.totalChapters}`);
    console.log(`  有负责人章节:    ${chalk.green(summary.chaptersWithOwner)}`);
    console.log(`  无负责人章节:    ${summary.chaptersWithoutOwner > 0 ? chalk.red(summary.chaptersWithoutOwner) : chalk.green('0')}`);
    console.log(`  断链数量:        ${summary.brokenLinks > 0 ? chalk.red(summary.brokenLinks) : chalk.green('0')}`);
    console.log(`  负责人匹配错误:  ${summary.ownerMatchErrors > 0 ? chalk.red(summary.ownerMatchErrors) : chalk.green('0')}`);
    console.log(`  未解析记录:      ${summary.unparsedRecords > 0 ? chalk.yellow(summary.unparsedRecords) : chalk.green('0')}`);
    console.log('');

    if (report.unparsedRecords && report.unparsedRecords.length > 0) {
      console.log(chalk.bold.yellow('⚠️  未解析记录'));
      console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
      report.unparsedRecords.forEach(record => {
        console.log(`  ${chalk.cyan(`${record.filePath}:${record.lineNumber}`)}`);
        console.log(`    内容: ${record.content}`);
        if (record.error) console.log(`    ${chalk.red('错误:')} ${record.error}`);
        if (record.warning) console.log(`    ${chalk.yellow('警告:')} ${record.warning}`);
        console.log('');
      });
    }

    if (report.ownerMatches && report.ownerMatches.some(m => !m.matched)) {
      console.log(chalk.bold.red('❌ 负责人匹配失败'));
      console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
      report.ownerMatches.filter(m => !m.matched).forEach(match => {
        const source = match.source || {};
        console.log(`  输入: ${chalk.red(match.input)}`);
        if (source.filePath) {
          console.log(`    位置: ${chalk.cyan(`${source.filePath}:${source.lineNumber}`)}`);
        }
        if (match.suggestions && match.suggestions.length > 0) {
          console.log(`    建议: ${chalk.yellow(match.suggestions.join(', '))}`);
        }
        console.log('');
      });
    }

    if (report.brokenLinks && report.brokenLinks.length > 0) {
      console.log(chalk.bold.red('🔗 断链列表'));
      console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
      report.brokenLinks.forEach(link => {
        console.log(`  ${chalk.cyan(`${link.filePath}:${link.lineNumber}`)}`);
        console.log(`    链接文本: ${link.text || '(无文本)'}`);
        console.log(`    目标: ${chalk.red(link.target)}`);
        console.log(`    错误: ${link.error}`);
        if (link.suggestions && link.suggestions.length > 0) {
          console.log(`    相似锚点: ${chalk.yellow(link.suggestions.map(s => `#${s.anchor}`).join(', '))}`);
        }
        console.log('');
      });
    }

    if (summary.chaptersWithoutOwner > 0) {
      console.log(chalk.bold.yellow('📝 无负责人章节'));
      console.log(chalk.gray('───────────────────────────────────────────────────────────────'));
      report.chapters.filter(c => !c.owner).forEach(chapter => {
        console.log(`  ${chalk.cyan(`${chapter.filePath}:${chapter.heading.lineNumber}`)}`);
        console.log(`    标题: ${chapter.heading.text}`);
        console.log(`    级别: H${chapter.heading.level}`);
        console.log('');
      });
    }

    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    if (summary.exitCode === 0) {
      console.log(chalk.bold.green('✅ 检查完成，未发现问题'));
    } else {
      console.log(chalk.bold.red('⚠️  检查完成，发现需要关注的问题'));
    }
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log('');

    return summary.exitCode;
  }

  writeJsonReport(report, filename = 'report.json') {
    const filePath = path.join(this.outputDir, filename);
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const jsonContent = JSON.stringify(report, null, 2);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');
    
    if (this.verbose) {
      console.log(chalk.green(`✅ JSON 报告已生成: ${filePath}`));
    }
    
    return filePath;
  }

  writeMarkdownReport(report, filename = 'report.md') {
    const filePath = path.join(this.outputDir, filename);
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const content = this._generateMarkdownContent(report);
    fs.writeFileSync(filePath, content, 'utf-8');
    
    if (this.verbose) {
      console.log(chalk.green(`✅ Markdown 报告已生成: ${filePath}`));
    }
    
    return filePath;
  }

  _generateMarkdownContent(report) {
    const { summary } = report;
    const lines = [];

    lines.push('# 章节归属分析报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date(report.generatedAt).toLocaleString()}`);
    lines.push('');

    lines.push('## 📊 统计摘要');
    lines.push('');
    lines.push('| 指标 | 数值 | 状态 |');
    lines.push('|------|------|------|');
    lines.push(`| 文件数量 | ${summary.totalFiles} | ✅ |`);
    lines.push(`| 标题总数 | ${summary.totalHeadings} | ✅ |`);
    lines.push(`| 章节总数 | ${summary.totalChapters} | ✅ |`);
    lines.push(`| 有负责人章节 | ${summary.chaptersWithOwner} | ✅ |`);
    lines.push(`| 无负责人章节 | ${summary.chaptersWithoutOwner} | ${summary.chaptersWithoutOwner > 0 ? '⚠️' : '✅'} |`);
    lines.push(`| 断链数量 | ${summary.brokenLinks} | ${summary.brokenLinks > 0 ? '❌' : '✅'} |`);
    lines.push(`| 负责人匹配错误 | ${summary.ownerMatchErrors} | ${summary.ownerMatchErrors > 0 ? '❌' : '✅'} |`);
    lines.push(`| 未解析记录 | ${summary.unparsedRecords} | ${summary.unparsedRecords > 0 ? '⚠️' : '✅'} |`);
    lines.push('');

    if (report.unparsedRecords && report.unparsedRecords.length > 0) {
      lines.push('## ⚠️ 未解析记录');
      lines.push('');
      lines.push('| 文件 | 行号 | 内容 | 问题 |');
      lines.push('|------|------|------|------|');
      report.unparsedRecords.forEach(record => {
        const issue = record.error || record.warning || '';
        lines.push(`| \`${record.filePath}\` | ${record.lineNumber} | \`${record.content.replace(/\|/g, '\\|')}\` | ${issue} |`);
      });
      lines.push('');
    }

    if (report.ownerMatches && report.ownerMatches.some(m => !m.matched)) {
      lines.push('## ❌ 负责人匹配失败');
      lines.push('');
      lines.push('| 输入名称 | 文件位置 | 建议匹配 |');
      lines.push('|----------|----------|----------|');
      report.ownerMatches.filter(m => !m.matched).forEach(match => {
        const source = match.source || {};
        const location = source.filePath ? `\`${source.filePath}:${source.lineNumber}\`` : '-';
        const suggestions = match.suggestions ? match.suggestions.join(', ') : '-';
        lines.push(`| \`${match.input}\` | ${location} | ${suggestions} |`);
      });
      lines.push('');
    }

    if (report.brokenLinks && report.brokenLinks.length > 0) {
      lines.push('## 🔗 断链列表');
      lines.push('');
      lines.push('| 文件位置 | 链接文本 | 目标 | 错误信息 | 建议锚点 |');
      lines.push('|----------|----------|------|----------|----------|');
      report.brokenLinks.forEach(link => {
        const location = `\`${link.filePath}:${link.lineNumber}\``;
        const suggestions = link.suggestions ? link.suggestions.map(s => `#${s.anchor}`).join(', ') : '-';
        lines.push(`| ${location} | ${link.text || '-'} | \`${link.target}\` | ${link.error} | ${suggestions} |`);
      });
      lines.push('');
    }

    if (summary.chaptersWithoutOwner > 0) {
      lines.push('## 📝 无负责人章节');
      lines.push('');
      lines.push('| 文件位置 | 标题 | 级别 |');
      lines.push('|----------|------|------|');
      report.chapters.filter(c => !c.owner).forEach(chapter => {
        const location = `\`${chapter.filePath}:${chapter.heading.lineNumber}\``;
        lines.push(`| ${location} | ${chapter.heading.text} | H${chapter.heading.level} |`);
      });
      lines.push('');
    }

    lines.push('## 📋 章节归属明细');
    lines.push('');
    
    const files = [...new Set(report.chapters.map(c => c.filePath))];
    files.forEach(file => {
      const fileChapters = report.chapters.filter(c => c.filePath === file);
      lines.push(`### ${path.basename(file)}`);
      lines.push('');
      lines.push(`> 文件: \`${file}\``);
      lines.push('');
      lines.push('| 行号 | 标题 | 负责人 | 评审人 | 状态 |');
      lines.push('|------|------|--------|--------|------|');
      
      fileChapters.forEach(chapter => {
        const indent = '  '.repeat(chapter.heading.level - 1);
        const owner = chapter.owner ? 
          (chapter.owner.inherited ? `${chapter.owner.name} (继承)` : chapter.owner.name) : 
          '❌ 未分配';
        const reviewers = chapter.reviewers && chapter.reviewers.length > 0 ? 
          chapter.reviewers.map(r => r.name).join(', ') : '-';
        const status = chapter.status || '-';
        
        lines.push(`| ${chapter.heading.lineNumber} | ${indent}${chapter.heading.text} | ${owner} | ${reviewers} | ${status} |`);
      });
      
      lines.push('');
    });

    lines.push('## 🔍 锚点索引');
    lines.push('');
    
    const anchorFiles = [...new Set(report.headings.map(h => h.filePath))];
    anchorFiles.forEach(file => {
      const fileHeadings = report.headings.filter(h => h.filePath === file);
      lines.push(`### ${path.basename(file)} 锚点`);
      lines.push('');
      lines.push('| 行号 | 标题 | 锚点 |');
      lines.push('|------|------|------|');
      
      fileHeadings.forEach(heading => {
        lines.push(`| ${heading.lineNumber} | ${heading.text} | \`#${heading.anchor}\` |`);
      });
      
      lines.push('');
    });

    lines.push('---');
    lines.push('');
    lines.push('<p align="center">本报告由 md-chapter-owner 工具自动生成</p>');

    return lines.join('\n');
  }

  writeAllReports(report, basename = 'chapter-owner-report') {
    const jsonPath = this.writeJsonReport(report, `${basename}.json`);
    const mdPath = this.writeMarkdownReport(report, `${basename}.md`);
    
    return { jsonPath, mdPath };
  }
}

module.exports = ReportGenerator;
