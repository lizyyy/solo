const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(data, options = {}) {
    this.data = data;
    this.options = options;
    this.topN = options.topN || 20;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateTerminalSummary() {
    const { summary, files, authors, errors } = this.data;
    const topFiles = files.slice(0, this.topN);
    const topAuthors = authors.slice(0, 10);

    let output = '\n';
    output += '╔══════════════════════════════════════════════════════════════╗\n';
    output += '║                    Git 历史大文件分析报告                      ║\n';
    output += '╚══════════════════════════════════════════════════════════════╝\n\n';

    output += '📊 扫描摘要\n';
    output += '─'.repeat(60) + '\n';
    output += `  仓库路径:    ${summary.repoPath}\n`;
    output += `  扫描时间:    ${new Date(summary.scanDate).toLocaleString('zh-CN')}\n`;
    output += `  总提交数:    ${summary.totalCommits}\n`;
    output += `  总文件数:    ${summary.totalFiles}\n`;
    output += `  作者数量:    ${summary.totalAuthors}\n`;
    output += `  错误数量:    ${errors.length}\n\n`;

    const totalSize = files.reduce((sum, f) => sum + (f.blobInfo?.maxSize || f.totalSize || 0), 0);
    output += `  预估总大小:  ${this.formatSize(totalSize)}\n\n`;

    output += `📁 前 ${this.topN} 个最大文件\n`;
    output += '─'.repeat(80) + '\n';
    output += '  大小\t\t文件路径\t\t\t贡献者数\t提交数\n';
    output += '─'.repeat(80) + '\n';

    for (const file of topFiles) {
      const size = file.blobInfo?.maxSize || file.totalSize || 0;
      const sizeStr = this.formatSize(size).padEnd(12);
      const pathStr = file.path.length > 40 ? '...' + file.path.slice(-37) : file.path.padEnd(40);
      const authorsStr = String(file.authors?.length || 0).padEnd(8);
      const commitsStr = String(file.commits || 0);
      output += `  ${sizeStr}${pathStr}${authorsStr}${commitsStr}\n`;
    }

    output += '\n👥 前 10 活跃作者\n';
    output += '─'.repeat(60) + '\n';
    output += '  提交数\t修改文件数\t作者\n';
    output += '─'.repeat(60) + '\n';

    for (const author of topAuthors) {
      output += `  ${String(author.commits).padEnd(8)}\t${String(author.filesModified.length).padEnd(10)}\t${author.name} <${author.email}>\n`;
    }

    if (errors.length > 0) {
      output += '\n⚠️  解析错误摘要\n';
      output += '─'.repeat(60) + '\n';
      
      const errorTypes = {};
      for (const err of errors) {
        errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
      }
      
      for (const [type, count] of Object.entries(errorTypes)) {
        output += `  ${type}: ${count} 个\n`;
      }
    }

    output += '\n' + '═'.repeat(80) + '\n';
    return output;
  }

  generateJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  generateMarkdown() {
    const { summary, files, authors, errors } = this.data;
    const topFiles = files.slice(0, this.topN);
    const topAuthors = authors.slice(0, 15);

    let md = '# Git 历史大文件分析报告\n\n';
    
    md += '## 扫描摘要\n\n';
    md += '| 指标 | 数值 |\n';
    md += '|------|------|\n';
    md += `| 仓库路径 | \`${summary.repoPath}\` |\n`;
    md += `| 扫描时间 | ${new Date(summary.scanDate).toLocaleString('zh-CN')} |\n`;
    md += `| 总提交数 | ${summary.totalCommits} |\n`;
    md += `| 总文件数 | ${summary.totalFiles} |\n`;
    md += `| 作者数量 | ${summary.totalAuthors} |\n`;
    md += `| 错误数量 | ${errors.length} |\n\n`;

    const totalSize = files.reduce((sum, f) => sum + (f.blobInfo?.maxSize || f.totalSize || 0), 0);
    md += `**预估历史文件总大小**: ${this.formatSize(totalSize)}\n\n`;

    md += `## 前 ${this.topN} 个最大文件\n\n`;
    md += '| 排名 | 大小 | 文件路径 | 贡献者数 | 提交数 | 首次出现 | 最后修改 |\n';
    md += '|------|------|----------|----------|--------|----------|----------|\n';

    for (let i = 0; i < topFiles.length; i++) {
      const file = topFiles[i];
      const size = file.blobInfo?.maxSize || file.totalSize || 0;
      md += `| ${i + 1} | ${this.formatSize(size)} | \`${file.path}\` | ${file.authors?.length || 0} | ${file.commits || 0} | ${file.firstSeen?.split(' ')[0] || '-'} | ${file.lastSeen?.split(' ')[0] || '-'} |\n`;
    }

    md += '\n## 文件详情（按目录分组）\n\n';
    
    const dirGroups = {};
    for (const file of files) {
      const dir = path.dirname(file.path);
      if (!dirGroups[dir]) {
        dirGroups[dir] = { files: [], totalSize: 0 };
      }
      dirGroups[dir].files.push(file);
      dirGroups[dir].totalSize += file.blobInfo?.maxSize || file.totalSize || 0;
    }

    const sortedDirs = Object.entries(dirGroups)
      .sort((a, b) => b[1].totalSize - a[1].totalSize)
      .slice(0, 10);

    for (const [dir, info] of sortedDirs) {
      md += `### ${dir}\n\n`;
      md += `- 目录总大小: ${this.formatSize(info.totalSize)}\n`;
      md += `- 文件数量: ${info.files.length}\n\n`;
    }

    md += '\n## 作者统计\n\n';
    md += '| 排名 | 提交数 | 修改文件数 | 新增行数 | 删除行数 | 作者 |\n';
    md += '|------|--------|------------|----------|----------|------|\n';

    for (let i = 0; i < topAuthors.length; i++) {
      const author = topAuthors[i];
      md += `| ${i + 1} | ${author.commits} | ${author.filesModified.length} | ${author.totalAdded} | ${author.totalDeleted} | ${author.name} <${author.email}> |\n`;
    }

    if (errors.length > 0) {
      md += '\n## 解析错误详情\n\n';
      md += '| 行号 | 错误类型 | 原因 | 内容 |\n';
      md += '|------|----------|------|------|\n';

      for (const err of errors.slice(0, 50)) {
        const content = (err.content || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
        const reason = (err.reason || '').replace(/\|/g, '\\|');
        md += `| ${err.line || '-'} | ${err.type || '-'} | ${reason} | \`${content.substring(0, 100)}\` |\n`;
      }

      if (errors.length > 50) {
        md += `\n*还有 ${errors.length - 50} 个错误未显示*\n`;
      }
    }

    md += '\n---\n\n';
    md += '*报告由 Git History Large Files CLI 自动生成*\n';

    return md;
  }

  saveTerminalSummary(filePath) {
    const content = this.generateTerminalSummary();
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  saveJSON(filePath) {
    const content = this.generateJSON();
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  saveMarkdown(filePath) {
    const content = this.generateMarkdown();
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  saveAll(outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = {
      terminal: this.saveTerminalSummary(path.join(outputDir, 'summary.txt')),
      json: this.saveJSON(path.join(outputDir, 'results.json')),
      markdown: this.saveMarkdown(path.join(outputDir, 'report.md'))
    };

    return results;
  }
}

module.exports = ReportGenerator;
