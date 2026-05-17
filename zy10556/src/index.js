'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const chalk = require('chalk');

class MarkdownChecker {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      outputDir: options.outputDir || './reports'
    };
    this.headingsMap = new Map();
    this.allHeadings = [];
    this.allLinks = [];
  }

  generateAnchor(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  parseHeadings(content, filePath) {
    const headings = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();
        const anchor = this.generateAnchor(text);
        
        const heading = {
          file: filePath,
          line: lineNum,
          level,
          text,
          anchor,
          raw: line
        };
        
        headings.push(heading);
        this.allHeadings.push(heading);
        
        const key = `${filePath}:${anchor}`;
        if (!this.headingsMap.has(key)) {
          this.headingsMap.set(key, []);
        }
        this.headingsMap.get(key).push(heading);
      }
    });
    
    return headings;
  }

  parseLinks(content, filePath) {
    const links = [];
    const lines = content.split('\n');
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      let match;
      
      while ((match = linkRegex.exec(line)) !== null) {
        const linkText = match[1];
        const linkTarget = match[2];
        
        const link = {
          file: filePath,
          line: lineNum,
          text: linkText,
          target: linkTarget,
          raw: line,
          isExternal: linkTarget.startsWith('http://') || linkTarget.startsWith('https://'),
          isAnchor: linkTarget.startsWith('#'),
          isInternalFile: !linkTarget.startsWith('#') && 
                          !linkTarget.startsWith('http://') && 
                          !linkTarget.startsWith('https://') &&
                          !linkTarget.startsWith('mailto:')
        };
        
        links.push(link);
        this.allLinks.push(link);
      }
    });
    
    return links;
  }

  findDuplicateTitles() {
    const duplicates = [];
    const titleMap = new Map();
    
    for (const heading of this.allHeadings) {
      const key = `${heading.file}:${heading.anchor}`;
      const occurrences = this.headingsMap.get(key);
      
      if (occurrences && occurrences.length > 1) {
        const duplicateKey = `${heading.file}:${heading.text}`;
        if (!titleMap.has(duplicateKey)) {
          titleMap.set(duplicateKey, true);
          duplicates.push({
            file: heading.file,
            title: heading.text,
            anchor: heading.anchor,
            occurrences: occurrences.map(h => ({
              line: h.line,
              raw: h.raw
            }))
          });
        }
      }
    }
    
    return duplicates;
  }

  findBrokenLinks() {
    const broken = [];
    
    for (const link of this.allLinks) {
      if (link.isExternal) continue;
      if (link.target.startsWith('mailto:')) continue;
      
      let isValid = true;
      let reason = '';
      
      if (link.isAnchor) {
        const anchor = link.target.substring(1);
        const key = `${link.file}:${anchor}`;
        if (!this.headingsMap.has(key)) {
          isValid = false;
          reason = `锚点不存在: #${anchor}`;
        }
      } else if (link.isInternalFile) {
        const targetPath = link.target.split('#')[0];
        const dir = path.dirname(link.file);
        const absoluteTarget = path.resolve(dir, targetPath);
        
        try {
          fs.accessSync(absoluteTarget);
          
          if (link.target.includes('#')) {
            const anchor = link.target.split('#')[1];
            const key = `${absoluteTarget}:${anchor}`;
            if (!this.headingsMap.has(key)) {
              isValid = false;
              reason = `文件存在但锚点不存在: #${anchor}`;
            }
          }
        } catch {
          isValid = false;
          reason = `目标文件不存在: ${targetPath}`;
        }
      }
      
      if (!isValid) {
        broken.push({
          file: link.file,
          line: link.line,
          text: link.text,
          target: link.target,
          reason,
          raw: link.raw
        });
      }
    }
    
    return broken;
  }

  validateHeadingHierarchy(headings, filePath) {
    const invalid = [];
    let lastLevel = 0;
    
    for (const heading of headings) {
      if (lastLevel === 0) {
        if (heading.level > 1) {
          invalid.push({
            file: filePath,
            line: heading.line,
            level: heading.level,
            expectedLevel: 1,
            text: heading.text,
            raw: heading.raw,
            reason: `文档第一个标题应为 H1，但实际是 H${heading.level}`
          });
        }
      } else {
        if (heading.level > lastLevel + 1) {
          invalid.push({
            file: filePath,
            line: heading.line,
            level: heading.level,
            expectedLevel: lastLevel + 1,
            text: heading.text,
            raw: heading.raw,
            reason: `标题层级跳跃: 从 H${lastLevel} 跳到 H${heading.level}`
          });
        }
      }
      lastLevel = heading.level;
    }
    
    return invalid;
  }

  async analyzeFile(filePath) {
    const content = await fsp.readFile(filePath, 'utf-8');
    const headings = this.parseHeadings(content, filePath);
    const links = this.parseLinks(content, filePath);
    const hierarchyIssues = this.validateHeadingHierarchy(headings, filePath);
    
    return {
      file: filePath,
      headings,
      links,
      hierarchyIssues
    };
  }

  async findMarkdownFiles(dir) {
    const results = [];
    
    async function scan(currentDir) {
      const entries = await fsp.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            await scan(fullPath);
          }
        } else if (entry.name.endsWith('.md')) {
          results.push(fullPath);
        }
      }
    }
    
    await scan(dir);
    return results;
  }

  async checkDirectory(dir) {
    const absoluteDir = path.resolve(dir);
    
    await fsp.mkdir(this.options.outputDir, { recursive: true });
    
    const files = await this.findMarkdownFiles(absoluteDir);
    
    if (this.options.verbose) {
      console.log(chalk.blue(`🔍 发现 ${files.length} 个 Markdown 文件`));
    }
    
    this.headingsMap.clear();
    this.allHeadings = [];
    this.allLinks = [];
    
    const fileAnalyses = [];
    let allHierarchyIssues = [];
    
    for (const file of files) {
      if (this.options.verbose) {
        console.log(chalk.gray(`  处理: ${path.relative(absoluteDir, file)}`));
      }
      const analysis = await this.analyzeFile(file);
      fileAnalyses.push(analysis);
      allHierarchyIssues = allHierarchyIssues.concat(analysis.hierarchyIssues);
    }
    
    const duplicateTitles = this.findDuplicateTitles();
    const brokenLinks = this.findBrokenLinks();
    
    return {
      scanTime: new Date().toISOString(),
      scannedDir: absoluteDir,
      totalFiles: files.length,
      totalHeadings: this.allHeadings.length,
      totalLinks: this.allLinks.length,
      duplicateTitles,
      brokenLinks,
      invalidHeadings: allHierarchyIssues,
      fileAnalyses
    };
  }

  printTerminalSummary(results) {
    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan.bold('📋 Markdown 文档检查摘要'));
    console.log(chalk.cyan('='.repeat(60)));
    
    console.log(chalk.gray(`扫描目录: ${results.scannedDir}`));
    console.log(chalk.gray(`扫描时间: ${results.scanTime}`));
    console.log();
    
    console.log(chalk.white.bold('📊 统计信息:'));
    console.log(`  文件总数: ${chalk.blue(results.totalFiles)}`);
    console.log(`  标题总数: ${chalk.blue(results.totalHeadings)}`);
    console.log(`  链接总数: ${chalk.blue(results.totalLinks)}`);
    console.log();
    
    if (results.duplicateTitles.length > 0) {
      console.log(chalk.yellow.bold(`⚠️  发现 ${results.duplicateTitles.length} 个重复标题:`));
      results.duplicateTitles.forEach((dup, i) => {
        console.log(chalk.yellow(`  ${i + 1}. ${dup.title}`));
        console.log(chalk.gray(`     文件: ${path.relative(results.scannedDir, dup.file)}`));
        dup.occurrences.forEach((occ, j) => {
          console.log(chalk.gray(`     第 ${j + 1} 次出现: 第 ${occ.line} 行`));
        });
      });
      console.log();
    }
    
    if (results.brokenLinks.length > 0) {
      console.log(chalk.red.bold(`❌ 发现 ${results.brokenLinks.length} 个失效链接:`));
      results.brokenLinks.forEach((link, i) => {
        console.log(chalk.red(`  ${i + 1}. [${link.text}](${link.target})`));
        console.log(chalk.gray(`     文件: ${path.relative(results.scannedDir, link.file)}:${link.line}`));
        console.log(chalk.gray(`     原因: ${link.reason}`));
      });
      console.log();
    }
    
    if (results.invalidHeadings.length > 0) {
      console.log(chalk.magenta.bold(`⚠️  发现 ${results.invalidHeadings.length} 个标题层级问题:`));
      results.invalidHeadings.forEach((issue, i) => {
        console.log(chalk.magenta(`  ${i + 1}. ${issue.text}`));
        console.log(chalk.gray(`     文件: ${path.relative(results.scannedDir, issue.file)}:${issue.line}`));
        console.log(chalk.gray(`     原因: ${issue.reason}`));
      });
      console.log();
    }
    
    const totalIssues = results.duplicateTitles.length + 
                        results.brokenLinks.length + 
                        results.invalidHeadings.length;
    
    if (totalIssues === 0) {
      console.log(chalk.green.bold('✅ 所有检查通过！未发现问题。'));
    } else {
      console.log(chalk.red.bold(`总计发现 ${totalIssues} 个问题需要修复。`));
    }
    console.log();
  }

  printFileAnalysis(analysis) {
    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan.bold(`📄 文件分析: ${path.basename(analysis.file)}`));
    console.log(chalk.cyan('='.repeat(60)));
    
    console.log(chalk.white.bold('\n📑 标题结构:'));
    analysis.headings.forEach(h => {
      const indent = '  '.repeat(h.level - 1);
      console.log(`${indent}H${h.level} ${chalk.blue(h.text)} ${chalk.gray(`(#${h.anchor})`)}`);
    });
    
    console.log(chalk.white.bold('\n🔗 链接列表:'));
    if (analysis.links.length === 0) {
      console.log(chalk.gray('  (无链接)'));
    } else {
      analysis.links.forEach(link => {
        const type = link.isExternal ? '外部' : link.isAnchor ? '锚点' : '内部文件';
        console.log(`  [${link.text}](${link.target}) ${chalk.gray(`[${type}]`)}`);
      });
    }
    
    if (analysis.hierarchyIssues.length > 0) {
      console.log(chalk.magenta.bold('\n⚠️  标题层级问题:'));
      analysis.hierarchyIssues.forEach(issue => {
        console.log(chalk.magenta(`  第 ${issue.line} 行: ${issue.reason}`));
      });
    }
    
    console.log();
  }

  async exportJSON(results, outputPath) {
    await fsp.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    if (this.options.verbose) {
      console.log(chalk.green(`✅ JSON报告已导出: ${outputPath}`));
    }
  }

  async exportHumanReport(results, outputPath) {
    const relativeDir = results.scannedDir;
    
    let report = `# Markdown 文档检查报告\n\n`;
    report += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    report += `> 扫描目录: \`${relativeDir}\`\n\n`;
    
    report += `## 📊 概览统计\n\n`;
    report += `| 指标 | 数量 |\n`;
    report += `|------|------|\n`;
    report += `| 扫描文件数 | ${results.totalFiles} |\n`;
    report += `| 标题总数 | ${results.totalHeadings} |\n`;
    report += `| 链接总数 | ${results.totalLinks} |\n`;
    report += `| 重复标题 | ${results.duplicateTitles.length} |\n`;
    report += `| 失效链接 | ${results.brokenLinks.length} |\n`;
    report += `| 标题层级问题 | ${results.invalidHeadings.length} |\n\n`;
    
    if (results.duplicateTitles.length > 0) {
      report += `## ⚠️ 重复标题\n\n`;
      report += `以下标题在同一文件中重复出现，可能导致锚点跳转错误：\n\n`;
      
      results.duplicateTitles.forEach((dup, i) => {
        const relFile = path.relative(relativeDir, dup.file);
        report += `### ${i + 1}. ${dup.title}\n\n`;
        report += `- 文件: \`${relFile}\`\n`;
        report += `- 锚点: \`#${dup.anchor}\`\n`;
        report += `- 出现位置:\n`;
        dup.occurrences.forEach(occ => {
          report += `  - 第 ${occ.line} 行: \`${occ.raw}\`\n`;
        });
        report += '\n';
      });
    }
    
    if (results.brokenLinks.length > 0) {
      report += `## ❌ 失效链接\n\n`;
      report += `以下链接目标不存在，请修复：\n\n`;
      
      results.brokenLinks.forEach((link, i) => {
        const relFile = path.relative(relativeDir, link.file);
        report += `### ${i + 1}. [${link.text}](${link.target})\n\n`;
        report += `- 文件: \`${relFile}\` (第 ${link.line} 行)\n`;
        report += `- 问题: ${link.reason}\n`;
        report += `- 原文: \`${link.raw}\`\n\n`;
      });
    }
    
    if (results.invalidHeadings.length > 0) {
      report += `## ⚠️ 标题层级问题\n\n`;
      report += `以下标题存在层级跳跃问题，建议调整：\n\n`;
      
      results.invalidHeadings.forEach((issue, i) => {
        const relFile = path.relative(relativeDir, issue.file);
        report += `### ${i + 1}. ${issue.text}\n\n`;
        report += `- 文件: \`${relFile}\` (第 ${issue.line} 行)\n`;
        report += `- 问题: ${issue.reason}\n`;
        report += `- 原文: \`${issue.raw}\`\n\n`;
      });
    }
    
    if (results.duplicateTitles.length === 0 && 
        results.brokenLinks.length === 0 && 
        results.invalidHeadings.length === 0) {
      report += `## ✅ 检查通过\n\n`;
      report += `所有检查项均通过，文档质量良好！\n\n`;
    }
    
    report += `---\n\n`;
    report += `*报告由 md-check 工具自动生成*\n`;
    
    await fsp.writeFile(outputPath, report, 'utf-8');
    if (this.options.verbose) {
      console.log(chalk.green(`✅ 人类可读报告已导出: ${outputPath}`));
    }
  }
}

module.exports = MarkdownChecker;
