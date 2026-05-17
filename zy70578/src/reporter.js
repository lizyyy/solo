import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { CATEGORIES } from './models.js';

export class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './output',
      colors: options.colors !== false,
      ...options
    };
  }

  generateConsoleSummary(result) {
    const lines = [];
    const jsonResult = result.toJSON();
    const summary = jsonResult.summary;

    lines.push('');
    lines.push(chalk.bold.cyan('╔════════════════════════════════════════════════╗'));
    lines.push(chalk.bold.cyan('║           GitHub 评论采样分析报告                  ║'));
    lines.push(chalk.bold.cyan('╚════════════════════════════════════════════════╝'));
    lines.push('');

    lines.push(chalk.bold('📊 总体统计'));
    lines.push(`  总评论数: ${chalk.yellow(summary.totalComments)}`);
    lines.push(`  总线程数: ${chalk.yellow(summary.totalThreads)}`);
    lines.push(`  参与作者: ${chalk.yellow(summary.uniqueAuthors)}`);
    lines.push(`  涉及文件: ${chalk.yellow(summary.affectedFiles)}`);
    lines.push('');

    lines.push(chalk.bold('📁 分类统计'));
    lines.push(`  ${chalk.red('🔴 阻塞线程:')} ${chalk.red.bold(summary.blockingThreads)}`);
    lines.push(`  ${chalk.blue('🔵 非阻塞线程:')} ${summary.nonBlockingThreads}`);
    lines.push(`  ${chalk.green('🟢 已解决线程:')} ${summary.resolvedThreads}`);
    lines.push(`  ${chalk.yellow('🟡 重复讨论:')} ${summary.duplicateThreads}`);
    lines.push(`  ${chalk.gray('⚠️  解析错误:')} ${summary.parseErrors}`);
    lines.push('');

    if (Object.keys(result.authors).length > 0) {
      lines.push(chalk.bold('👥 活跃作者 (Top 10)'));
      const sortedAuthors = Object.entries(result.authors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      for (const [author, count] of sortedAuthors) {
        const percentage = ((count / summary.totalComments) * 100).toFixed(1);
        lines.push(`  ${author}: ${count} (${percentage}%)`);
      }
      lines.push('');
    }

    if (Object.keys(result.files).length > 0) {
      lines.push(chalk.bold('📄 热点文件 (Top 10)'));
      const sortedFiles = Object.entries(result.files)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      for (const [file, count] of sortedFiles) {
        lines.push(`  ${file}: ${count}`);
      }
      lines.push('');
    }

    if (result.duplicateGroups.length > 0) {
      lines.push(chalk.bold('🔄 重复讨论组'));
      for (const group of result.duplicateGroups) {
        lines.push(`  组 ${group.id}: ${group.threads.length} 个线程 (相似度: ${(group.similarity * 100).toFixed(1)}%)`);
        for (const thread of group.threads) {
          lines.push(`    - ${thread.filePath || 'global'}: ${thread.getFirstComment()?.body?.substring(0, 50) || ''}...`);
        }
      }
      lines.push('');
    }

    if (result.parseErrors.length > 0) {
      lines.push(chalk.bold.yellow('⚠️  解析错误详情'));
      for (const error of result.parseErrors.slice(0, 5)) {
        lines.push(`  行 ${error.lineNumber}: ${error.reason}`);
        lines.push(`    ${error.error}`);
      }
      if (result.parseErrors.length > 5) {
        lines.push(`  ... 还有 ${result.parseErrors.length - 5} 个错误`);
      }
      lines.push('');
    }

    lines.push(chalk.bold('💡 提示'));
    lines.push('  使用 --json 输出生成机器可读结果');
    lines.push('  使用 --markdown 生成详细报告');
    lines.push('  使用 --help 查看更多选项');
    lines.push('');

    return lines.join('\n');
  }

  generateJSON(result, pretty = true) {
    return JSON.stringify(result.toJSON(), null, pretty ? 2 : 0);
  }

  generateMarkdown(result, options = {}) {
    const lines = [];
    const jsonResult = result.toJSON();
    const summary = jsonResult.summary;
    const metadata = jsonResult.metadata;

    lines.push('# GitHub PR 评论采样分析报告');
    lines.push('');
    lines.push(`生成时间: ${new Date(metadata.generatedAt).toLocaleString('zh-CN')}`);
    lines.push(`输入文件: ${metadata.inputFile || 'N/A'}`);
    lines.push('');

    lines.push('## 📊 执行摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总评论数 | ${summary.totalComments} |`);
    lines.push(`| 总线程数 | ${summary.totalThreads} |`);
    lines.push(`| 阻塞线程 | ${summary.blockingThreads} |`);
    lines.push(`| 重复讨论 | ${summary.duplicateThreads} |`);
    lines.push(`| 已解决线程 | ${summary.resolvedThreads} |`);
    lines.push(`| 非阻塞线程 | ${summary.nonBlockingThreads} |`);
    lines.push(`| 解析错误 | ${summary.parseErrors} |`);
    lines.push(`| 参与作者 | ${summary.uniqueAuthors} |`);
    lines.push(`| 涉及文件 | ${summary.affectedFiles} |`);
    lines.push('');

    lines.push('## 🔴 阻塞意见 (需要关注)');
    lines.push('');
    const blockingThreads = result.categories[CATEGORIES.BLOCKING].threads;
    if (blockingThreads.length > 0) {
      for (const thread of blockingThreads) {
        lines.push(`### ${thread.filePath || '全局讨论'} (行 ${thread.line || 'N/A'})`);
        lines.push('');
        lines.push(`- **状态**: ${thread.status}`);
        lines.push(`- **作者**: ${thread.getAuthors().join(', ')}`);
        lines.push(`- **评论数**: ${thread.getCommentCount()}`);
        lines.push('');
        lines.push('**讨论内容:**');
        lines.push('');
        for (const comment of thread.comments) {
          lines.push(`> **${comment.author}** (${new Date(comment.createdAt).toLocaleString('zh-CN')}):`);
          lines.push('>');
          lines.push(`> ${comment.body.replace(/\n/g, '\n> ')}`);
          lines.push('');
        }
        lines.push('---');
        lines.push('');
      }
    } else {
      lines.push('没有发现阻塞意见 🎉');
      lines.push('');
    }

    lines.push('## 🟡 重复讨论');
    lines.push('');
    if (result.duplicateGroups.length > 0) {
      for (const group of result.duplicateGroups) {
        lines.push(`### 重复组 ${group.id.substring(0, 8)} (相似度: ${(group.similarity * 100).toFixed(1)}%)`);
        lines.push('');
        lines.push('**涉及线程:**');
        for (const thread of group.threads) {
          lines.push(`- ${thread.filePath || 'global'} (${thread.getCommentCount()} 评论)`);
        }
        lines.push('');
        lines.push('**代表性内容:**');
        lines.push('');
        lines.push(`> ${group.representative.substring(0, 200)}...`);
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    } else {
      lines.push('没有发现重复讨论 🎉');
      lines.push('');
    }

    lines.push('## 🟢 已解决问题');
    lines.push('');
    const resolvedThreads = result.categories[CATEGORIES.RESOLVED].threads;
    if (resolvedThreads.length > 0) {
      lines.push(`共 ${resolvedThreads.length} 个已解决的线程:`);
      lines.push('');
      for (const thread of resolvedThreads.slice(0, 20)) {
        const firstComment = thread.getFirstComment();
        const preview = firstComment?.body?.substring(0, 80) || '';
        lines.push(`- [x] ${thread.filePath || '全局'}: ${preview}... (${thread.getAuthors().join(', ')})`);
      }
      if (resolvedThreads.length > 20) {
        lines.push(`... 还有 ${resolvedThreads.length - 20} 个已解决线程`);
      }
    } else {
      lines.push('没有已解决的线程');
    }
    lines.push('');

    lines.push('## 🔵 其他讨论');
    lines.push('');
    const nonBlockingThreads = result.categories[CATEGORIES.NON_BLOCKING].threads;
    if (nonBlockingThreads.length > 0) {
      lines.push(`共 ${nonBlockingThreads.length} 个非阻塞线程:`);
      lines.push('');
      for (const thread of nonBlockingThreads.slice(0, 30)) {
        const firstComment = thread.getFirstComment();
        const preview = firstComment?.body?.substring(0, 80) || '';
        lines.push(`- [ ] ${thread.filePath || '全局'}: ${preview}... (${thread.getCommentCount()} 评论)`);
      }
      if (nonBlockingThreads.length > 30) {
        lines.push(`... 还有 ${nonBlockingThreads.length - 30} 个其他线程`);
      }
    } else {
      lines.push('没有其他讨论');
    }
    lines.push('');

    lines.push('## 👥 作者统计');
    lines.push('');
    const sortedAuthors = Object.entries(result.authors)
      .sort((a, b) => b[1] - a[1]);
    
    lines.push('| 作者 | 评论数 | 占比 |');
    lines.push('|------|--------|------|');
    for (const [author, count] of sortedAuthors) {
        const percentage = ((count / summary.totalComments) * 100).toFixed(1);
        lines.push(`| ${author} | ${count} | ${percentage}% |`);
      }
    lines.push('');

    lines.push('## 📄 文件统计');
    lines.push('');
    const sortedFiles = Object.entries(result.files)
      .sort((a, b) => b[1] - a[1]);
    
    lines.push('| 文件 | 评论数 |');
    lines.push('|------|--------|');
    for (const [file, count] of sortedFiles) {
      lines.push(`| ${file} | ${count} |`);
    }
    lines.push('');

    if (result.parseErrors.length > 0) {
      lines.push('## ⚠️ 解析错误');
      lines.push('');
      lines.push('| 行号 | 原因 | 错误 |');
      lines.push('|------|------|------|');
      for (const error of result.parseErrors) {
        lines.push(`| ${error.lineNumber} | ${error.reason} | ${error.error} |`);
      }
      lines.push('');
      lines.push('**原始数据已保留在 JSON 输出中。');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 GitHub Comment Sampler 自动生成*');

    return lines.join('\n');
  }

  async writeToFile(result, format, filename) {
    const outputDir = this.options.outputDir;
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    const filePath = path.join(outputDir, filename);
    
    let content;
    if (format === 'json') {
      content = this.generateJSON(result);
    } else if (format === 'markdown') {
      content = this.generateMarkdown(result);
    } else {
      throw new Error(`不支持的格式: ${format}`);
    }

    await fs.promises.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  printConsole(result) {
    const summary = this.generateConsoleSummary(result);
    console.log(summary);
  }

  static generateConsole(result, options = {}) {
    const generator = new ReportGenerator(options);
    return {
      console: generator.generateConsoleSummary(result),
      json: generator.generateJSON(result),
      markdown: generator.generateMarkdown(result)
    };
  }
}

export default ReportGenerator;