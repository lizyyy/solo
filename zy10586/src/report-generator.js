const chalk = require('chalk');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || process.cwd();
    this.errors = [];
  }

  printConsoleSummary(result) {
    const { classifiedCommits, groups, gitErrors, classifyErrors, pathAnalysis } = result;
    
    console.log('\n');
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('           Git 提交分类汇总 '));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log('');

    console.log(chalk.bold.white(`📊 统计概览`));
    console.log(chalk.gray(`   总提交数: ${classifiedCommits.length}`));
    console.log('');

    const statTable = new Table({
      head: ['分类', '数量', '占比'],
      colWidths: [15, 8, 10],
      style: { head: ['cyan'] }
    });

    let totalCommits = classifiedCommits.length;
    for (const key in groups) {
      const group = groups[key];
      const count = group.commits.length;
      if (count === 0) continue;
      
      const percentage = ((count / totalCommits) * 100).toFixed(1) + '%';
      const colorMethod = chalk[group.category.color] || chalk.gray;
      statTable.push([
        colorMethod(group.category.name),
        count.toString(),
        percentage
      ]);
    }

    console.log(statTable.toString());
    console.log('');

    for (const key in groups) {
      const group = groups[key];
      if (group.commits.length === 0) continue;

      const colorMethod = chalk[group.category.color] || chalk.gray;
      console.log(colorMethod.bold(`📁 ${group.category.name} (${group.commits.length})`));
      
      group.commits.slice(0, 10).forEach(commit => {
        const confidence = commit.classification.confidence > 0 ? '✓' : '?';
        console.log(`   ${chalk.gray(commit.shortHash)} ${confidence} ${commit.subject.substring(0, 60)}${commit.subject.length > 60 ? '...' : ''}`);
      });
      
      if (group.commits.length > 10) {
        console.log(chalk.gray(`   ... 还有 ${group.commits.length - 10} 条提交`));
      }
      console.log('');
    }

    if (pathAnalysis && pathAnalysis.moduleChanges && pathAnalysis.moduleChanges.length > 0) {
      console.log(chalk.bold.white(`🔧 模块变更统计`));
      const moduleTable = new Table({
        head: ['模块', '提交数', '文件数'],
        colWidths: [15, 10, 10],
        style: { head: ['cyan'] }
      });

      for (const module of pathAnalysis.moduleChanges) {
        moduleTable.push([
          module.name,
          module.commitCount.toString(),
          module.fileCount.toString()
        ]);
      }
      console.log(moduleTable.toString());
      console.log('');
    }

    const allErrors = [...(gitErrors || []), ...(classifyErrors || [])];
    if (allErrors.length > 0) {
      console.log(chalk.bold.yellow(`⚠️  异常记录 (${allErrors.length})`));
      allErrors.slice(0, 5).forEach(error => {
        console.log(chalk.yellow(`   行${error.lineNumber || '-'}: [${error.type}] ${error.reason}`));
        if (error.content) {
          console.log(chalk.gray(`      内容: ${error.content.substring(0, 50)}...`));
        }
      });
      if (allErrors.length > 5) {
        console.log(chalk.gray(`   ... 还有 ${allErrors.length - 5} 条错误记录`));
      }
      console.log('');
    }

    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════'));
    console.log('');
  }

  exportJson(result, filename = 'commit-classification.json') {
    try {
      const filePath = path.join(this.outputDir, filename);
      const jsonData = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalCommits: result.classifiedCommits.length,
          categories: {}
        },
        categories: {},
        errors: [...(result.gitErrors || []), ...(result.classifyErrors || [])],
        rawData: result.classifiedCommits.map(commit => ({
          hash: commit.hash,
          shortHash: commit.shortHash,
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          date: commit.date,
          subject: commit.subject,
          category: commit.classification.category.key,
          categoryName: commit.classification.category.name,
          matchedPattern: commit.classification.matchedPattern,
          files: commit.files
        }))
      };

      for (const key in result.groups) {
        jsonData.summary.categories[key] = result.groups[key].commits.length;
        jsonData.categories[key] = {
          name: result.groups[key].category.name,
          count: result.groups[key].commits.length,
          commits: result.groups[key].commits.map(c => ({
            hash: c.shortHash,
            subject: c.subject,
            author: c.authorName,
            date: c.date
          }))
        };
      }

      if (result.pathAnalysis) {
        jsonData.pathAnalysis = {
          moduleChanges: result.pathAnalysis.moduleChanges,
          topPathChanges: result.pathAnalysis.topPathChanges
        };
      }

      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
      console.log(chalk.green(`✓ JSON报告已导出: ${filePath}`));
      return filePath;
    } catch (error) {
      this.errors.push({
        type: 'json_export_error',
        reason: error.message
      });
      console.error(chalk.red(`✗ JSON导出失败: ${error.message}`));
      return null;
    }
  }

  generateMarkdownReport(result, filename = 'release-notes.md') {
    try {
      const filePath = path.join(this.outputDir, filename);
      const generatedDate = new Date().toLocaleString('zh-CN');

      let md = `# 📋 发版说明\n\n`;
      md += `> 生成时间: ${generatedDate}\n\n`;

      md += `## 📊 概览\n\n`;
      md += `| 分类 | 数量 | 占比 |\n`;
      md += `|------|------|------|\n`;
      
      const total = result.classifiedCommits.length;
      for (const key in result.groups) {
        const group = result.groups[key];
        if (group.commits.length === 0) continue;
        const percentage = ((group.commits.length / total) * 100).toFixed(1);
        md += `| ${group.category.name} | ${group.commits.length} | ${percentage}% |\n`;
      }
      md += `| **总计** | **${total}** | **100%** |\n\n`;

      for (const key in result.groups) {
        const group = result.groups[key];
        if (group.commits.length === 0) continue;

        md += `## ${this.getCategoryEmoji(group.category.key)} ${group.category.name}\n\n`;
        
        for (const commit of group.commits) {
          md += `- **${commit.shortHash}** ${commit.subject} (${commit.authorName})\n`;
        }
        md += '\n';
      }

      if (result.pathAnalysis && result.pathAnalysis.moduleChanges && result.pathAnalysis.moduleChanges.length > 0) {
        md += `## 🔧 模块变更统计\n\n`;
        md += `| 模块 | 提交数 | 文件数 |\n`;
        md += `|------|--------|--------|\n`;
        for (const module of result.pathAnalysis.moduleChanges) {
          md += `| ${module.name} | ${module.commitCount} | ${module.fileCount} |\n`;
        }
        md += '\n';
      }

      const allErrors = [...(result.gitErrors || []), ...(result.classifyErrors || [])];
      if (allErrors.length > 0) {
        md += `## ⚠️ 异常记录\n\n`;
        for (const error of allErrors) {
          md += `- **[${error.type}]** (行${error.lineNumber || '-'}) ${error.reason}\n`;
          if (error.content) {
            md += `  > ${error.content.substring(0, 100)}\n`;
          }
        }
        md += '\n';
      }

      md += `---\n\n`;
      md += `*本报告由 git-commit-classifier 自动生成*\n`;

      fs.writeFileSync(filePath, md, 'utf8');
      console.log(chalk.green(`✓ Markdown报告已导出: ${filePath}`));
      return filePath;
    } catch (error) {
      this.errors.push({
        type: 'markdown_export_error',
        reason: error.message
      });
      console.error(chalk.red(`✗ Markdown导出失败: ${error.message}`));
      return null;
    }
  }

  generateHtmlReport(result, filename = 'release-notes.html') {
    try {
      const filePath = path.join(this.outputDir, filename);
      const generatedDate = new Date().toLocaleString('zh-CN');

      const categoryColors = {
        fix: '#ef4444',
        feature: '#22c55e',
        refactor: '#eab308',
        config: '#3b82f6',
        docs: '#06b6d4',
        test: '#a855f7',
        style: '#6b7280',
        build: '#6b7280',
        revert: '#ef4444',
        perf: '#f97316',
        other: '#6b7280'
      };

      let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>发版说明</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 900px; margin: 0 auto; padding: 2rem; background: #f9fafb; }
        .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb; }
        .header h1 { font-size: 2rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
        .header .date { color: #6b7280; font-size: 0.9rem; }
        .summary { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .summary h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #1f2937; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
        .stat-card { padding: 1rem; border-radius: 8px; text-align: center; }
        .stat-card .number { font-size: 2rem; font-weight: 700; }
        .stat-card .label { font-size: 0.875rem; color: #4b5563; }
        .category { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .category h2 { font-size: 1.25rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 0.5rem; }
        .category-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; color: white; }
        .commit-list { list-style: none; }
        .commit-item { padding: 0.75rem 0; border-bottom: 1px solid #f3f4f6; display: flex; gap: 1rem; }
        .commit-item:last-child { border-bottom: none; }
        .commit-hash { font-family: 'Monaco', monospace; font-size: 0.875rem; color: #6b7280; font-weight: 600; min-width: 60px; }
        .commit-content { flex: 1; }
        .commit-subject { font-weight: 500; margin-bottom: 0.25rem; }
        .commit-meta { font-size: 0.75rem; color: #6b7280; }
        .errors { background: #fef2f2; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #fecaca; }
        .errors h2 { color: #dc2626; font-size: 1.25rem; margin-bottom: 1rem; }
        .error-item { padding: 0.75rem 0; border-bottom: 1px solid #fecaca; }
        .error-item:last-child { border-bottom: none; }
        .error-type { font-weight: 600; color: #dc2626; }
        .error-content { font-size: 0.875rem; color: #7f1d1d; margin-top: 0.25rem; }
        .footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 发版说明</h1>
        <p class="date">生成时间: ${generatedDate}</p>
    </div>

    <div class="summary">
        <h2>📊 提交概览</h2>
        <div class="stat-grid">`;

      for (const key in result.groups) {
        const group = result.groups[key];
        if (group.commits.length === 0) continue;
        const color = categoryColors[key] || '#6b7280';
        html += `
            <div class="stat-card" style="background: ${color}10;">
                <div class="number" style="color: ${color};">${group.commits.length}</div>
                <div class="label">${group.category.name}</div>
            </div>`;
      }

      html += `
        </div>
    </div>`;

      for (const key in result.groups) {
        const group = result.groups[key];
        if (group.commits.length === 0) continue;
        const color = categoryColors[key] || '#6b7280';
        const emoji = this.getCategoryEmoji(key);
        
        html += `
    <div class="category">
        <h2>
            ${emoji} ${group.category.name}
            <span class="category-badge" style="background: ${color};">${group.commits.length}</span>
        </h2>
        <ul class="commit-list">`;

        for (const commit of group.commits) {
          html += `
            <li class="commit-item">
                <span class="commit-hash">${commit.shortHash}</span>
                <div class="commit-content">
                    <div class="commit-subject">${this.escapeHtml(commit.subject)}</div>
                    <div class="commit-meta">${this.escapeHtml(commit.authorName)} · ${commit.date.split(' ')[0]}</div>
                </div>
            </li>`;
        }

        html += `
        </ul>
    </div>`;
      }

      if (result.pathAnalysis && result.pathAnalysis.moduleChanges && result.pathAnalysis.moduleChanges.length > 0) {
        html += `
    <div class="category">
        <h2>🔧 模块变更统计</h2>
        <table>
            <thead>
                <tr><th>模块</th><th>提交数</th><th>文件数</th></tr>
            </thead>
            <tbody>`;
        
        for (const module of result.pathAnalysis.moduleChanges) {
          html += `
                <tr><td>${module.name}</td><td>${module.commitCount}</td><td>${module.fileCount}</td></tr>`;
        }

        html += `
            </tbody>
        </table>
    </div>`;
      }

      const allErrors = [...(result.gitErrors || []), ...(result.classifyErrors || [])];
      if (allErrors.length > 0) {
        html += `
    <div class="errors">
        <h2>⚠️ 异常记录 (${allErrors.length})</h2>`;
        
        for (const error of allErrors) {
          html += `
        <div class="error-item">
            <span class="error-type">[${error.type}]</span> 行${error.lineNumber || '-'}: ${this.escapeHtml(error.reason)}
            ${error.content ? `<div class="error-content">${this.escapeHtml(error.content.substring(0, 150))}</div>` : ''}
        </div>`;
        }

        html += `
    </div>`;
      }

      html += `
    <div class="footer">
        本报告由 git-commit-classifier 自动生成
    </div>
</body>
</html>`;

      fs.writeFileSync(filePath, html, 'utf8');
      console.log(chalk.green(`✓ HTML报告已导出: ${filePath}`));
      return filePath;
    } catch (error) {
      this.errors.push({
        type: 'html_export_error',
        reason: error.message
      });
      console.error(chalk.red(`✗ HTML导出失败: ${error.message}`));
      return null;
    }
  }

  getCategoryEmoji(key) {
    const emojis = {
      fix: '🐛',
      feature: '✨',
      refactor: '♻️',
      config: '⚙️',
      docs: '📝',
      test: '🧪',
      style: '💅',
      build: '🏗️',
      revert: '↩️',
      perf: '⚡',
      other: '📦'
    };
    return emojis[key] || '📦';
  }

  escapeHtml(text) {
    if (typeof text !== 'string') {
      text = String(text);
    }
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  getErrors() {
    return this.errors;
  }
}

module.exports = ReportGenerator;/* 样式调整 */
