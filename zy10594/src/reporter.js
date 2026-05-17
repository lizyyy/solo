const fs = require('fs/promises');

class Reporter {
  constructor(options = {}) {
    this.options = {
      color: options.color !== false,
      verbose: options.verbose || false,
      maxFilesInReport: options.maxFilesInReport || 50,
    };
  }

  generateAllResults(scanResult, hashResult, groupResult, retentionResult, cliOptions) {
    const timestamp = new Date().toISOString();
    
    return {
      metadata: {
        version: '1.0.0',
        generatedAt: timestamp,
        command: 'snapshot-dedup',
        options: cliOptions,
      },
      summary: this._createSummary(scanResult, hashResult, groupResult, retentionResult),
      scan: {
        directory: cliOptions.directory,
        stats: scanResult.stats,
        errors: scanResult.errors,
      },
      hash: {
        algorithm: hashResult.hashed[0]?.hashAlgorithm || 'sha256',
        errors: hashResult.errors,
      },
      groups: groupResult.groups.map(g => this._serializeGroup(g)),
      recommendations: retentionResult.recommendations.map(r => this._serializeRecommendation(r)),
      retentionStats: retentionResult.stats,
    };
  }

  _createSummary(scanResult, hashResult, groupResult, retentionResult) {
    return {
      scannedFiles: scanResult.stats.totalFiles,
      scannedSize: scanResult.stats.totalSize,
      scannedDirectories: scanResult.stats.scannedDirs,
      hashedFiles: hashResult.hashed.length,
      hashErrors: hashResult.errors.length,
      totalGroups: groupResult.stats.totalGroups,
      duplicateGroups: groupResult.stats.totalDuplicateGroups,
      duplicateFiles: groupResult.stats.totalDuplicateFiles,
      filesToKeep: retentionResult.stats.filesToKeep,
      filesToDelete: retentionResult.stats.filesToDelete,
      totalSize: retentionResult.stats.totalSize,
      redundantSize: retentionResult.stats.redundantSize,
      potentialSavings: retentionResult.stats.potentialSavings,
      errors: scanResult.errors.length + hashResult.errors.length,
    };
  }

  _serializeGroup(group) {
    return {
      id: group.id,
      key: group.key,
      count: group.count,
      hasDuplicates: group.hasDuplicates,
      hashVariantCount: group.hashVariantCount,
      totalSize: group.totalSize,
      redundantSize: group.redundantSize,
      hashVariants: group.hashVariants.map(v => ({
        hash: v.hash,
        count: v.count,
        isDuplicate: v.isDuplicate,
        totalSize: v.totalSize,
        redundantSize: v.redundantSize,
        files: v.files.map(f => ({
          id: f.id,
          path: f.path,
          size: f.size,
          modified: f.modified,
        })),
      })),
    };
  }

  _serializeRecommendation(rec) {
    return {
      groupId: rec.groupId,
      groupKey: rec.groupKey,
      fileCount: rec.fileCount,
      hashVariantCount: rec.hashVariantCount,
      potentialSavings: rec.potentialSavings,
      keep: rec.keep.map(f => ({
        id: f.id,
        path: f.path,
        size: f.size,
        modified: f.modified,
        hash: f.hash,
      })),
      delete: rec.delete.map(f => ({
        id: f.id,
        path: f.path,
        size: f.size,
        modified: f.modified,
        hash: f.hash,
      })),
    };
  }

  formatTerminal(results) {
    const { summary } = results;
    const lines = [];
    const c = this._colors();

    lines.push('');
    lines.push(`${c.cyan}╔══════════════════════════════════════════════════════════════╗${c.reset}`);
    lines.push(`${c.cyan}║${c.reset}                  ${c.bold}快照文件去重报告${c.reset}                          ${c.cyan}║${c.reset}`);
    lines.push(`${c.cyan}╚══════════════════════════════════════════════════════════════╝${c.reset}`);
    lines.push('');

    lines.push(`${c.bold}📊 扫描摘要${c.reset}`);
    lines.push(`  ${c.dim}────────────────────────────────────────────────────${c.reset}`);
    lines.push(`  扫描目录:        ${c.white}${results.scan.directory}${c.reset}`);
    lines.push(`  扫描文件:        ${c.green}${this._formatNumber(summary.scannedFiles)}${c.reset}`);
    lines.push(`  扫描目录:        ${this._formatNumber(summary.scannedDirectories)}`);
    lines.push(`  总大小:          ${c.yellow}${this._formatSize(summary.scannedSize)}${c.reset}`);
    lines.push(`  哈希错误:        ${summary.hashErrors > 0 ? c.red : c.green}${summary.hashErrors}${c.reset}`);
    lines.push('');

    lines.push(`${c.bold}🔍 分组分析${c.reset}`);
    lines.push(`  ${c.dim}────────────────────────────────────────────────────${c.reset}`);
    lines.push(`  同名组数量:      ${c.cyan}${this._formatNumber(summary.totalGroups)}${c.reset}`);
    lines.push(`  含重复组数量:    ${summary.duplicateGroups > 0 ? c.yellow : c.green}${this._formatNumber(summary.duplicateGroups)}${c.reset}`);
    lines.push(`  重复文件总数:    ${summary.duplicateFiles > 0 ? c.yellow : c.green}${this._formatNumber(summary.duplicateFiles)}${c.reset}`);
    lines.push('');

    lines.push(`${c.bold}💾 去重建议${c.reset}`);
    lines.push(`  ${c.dim}────────────────────────────────────────────────────${c.reset}`);
    lines.push(`  建议保留:        ${c.green}${this._formatNumber(summary.filesToKeep)}${c.reset}`);
    lines.push(`  建议删除:        ${c.red}${this._formatNumber(summary.filesToDelete)}${c.reset}`);
    lines.push(`  冗余总大小:      ${c.yellow}${this._formatSize(summary.redundantSize)}${c.reset}`);
    lines.push(`  ${c.bold}可节省空间:        ${c.green}${this._formatSize(summary.potentialSavings)}${c.reset}`);
    lines.push('');

    if (results.scan.errors.length > 0 || results.hash.errors.length > 0) {
      lines.push(`${c.bold}⚠️  异常报告${c.reset}`);
      lines.push(`  ${c.dim}────────────────────────────────────────────────────${c.reset}`);
      
      const allErrors = [...results.scan.errors, ...results.hash.errors];
      lines.push(`  异常总数:        ${c.red}${allErrors.length}${c.reset}`);
      lines.push('');
      
      for (const error of allErrors.slice(0, 10)) {
        lines.push(`  ${c.red}●${c.reset} [${error.type}] ${c.dim}${error.path}${c.reset}`);
        lines.push(`     ${error.message}`);
      }
      
      if (allErrors.length > 10) {
        lines.push(`  ${c.dim}... 还有 ${allErrors.length - 10} 个异常${c.reset}`);
      }
      lines.push('');
    }

    if (this.options.verbose && results.groups.length > 0) {
      lines.push(`${c.bold}📁 分组详情 (Top 10)${c.reset}`);
      lines.push(`  ${c.dim}────────────────────────────────────────────────────${c.reset}`);
      
      const topGroups = [...results.groups]
        .sort((a, b) => b.redundantSize - a.redundantSize)
        .slice(0, 10);

      for (const group of topGroups) {
        const status = group.hasDuplicates ? `${c.yellow}有重复${c.reset}` : `${c.green}无重复${c.reset}`;
        lines.push(`  ${c.cyan}${group.key}${c.reset} [${status}]`);
        lines.push(`     文件: ${group.count} | 哈希变体: ${group.hashVariantCount} | 可节省: ${this._formatSize(group.redundantSize)}`);
        
        for (const variant of group.hashVariants) {
          if (variant.isDuplicate) {
            lines.push(`     ${c.red}●${c.reset} 重复哈希 (${variant.count}个文件): ${variant.hash.substring(0, 16)}...`);
          }
        }
      }
      lines.push('');
    }

    lines.push(`${c.dim}生成时间: ${results.metadata.generatedAt}${c.reset}`);
    lines.push('');

    return lines.join('\n');
  }

  async writeJson(results, outputPath) {
    const json = JSON.stringify(results, null, 2);
    await fs.writeFile(outputPath, json, 'utf8');
    return outputPath;
  }

  formatMarkdown(results) {
    const { summary } = results;
    const lines = [];

    lines.push('# 快照文件去重报告');
    lines.push('');
    lines.push(`> 生成时间: ${results.metadata.generatedAt}`);
    lines.push(`> 扫描目录: \`${results.scan.directory}\``);
    lines.push('');

    lines.push('## 📊 执行摘要');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 扫描文件数 | ${this._formatNumber(summary.scannedFiles)} |`);
    lines.push(`| 总大小 | ${this._formatSize(summary.scannedSize)} |`);
    lines.push(`| 同名组数量 | ${this._formatNumber(summary.totalGroups)} |`);
    lines.push(`| 含重复组数量 | ${this._formatNumber(summary.duplicateGroups)} |`);
    lines.push(`| 建议保留 | **${this._formatNumber(summary.filesToKeep)}** |`);
    lines.push(`| 建议删除 | **${this._formatNumber(summary.filesToDelete)}** |`);
    lines.push(`| **可节省空间** | **${this._formatSize(summary.potentialSavings)}** |`);
    lines.push('');

    if (summary.filesToDelete > 0) {
      lines.push('## 🔍 重复分组详情');
      lines.push('');
      
      const duplicateGroups = results.groups
        .filter(g => g.hasDuplicates)
        .sort((a, b) => b.redundantSize - a.redundantSize)
        .slice(0, 20);

      for (const group of duplicateGroups) {
        lines.push(`### ${group.key}`);
        lines.push('');
        lines.push(`- **文件总数**: ${group.count}`);
        lines.push(`- **哈希变体**: ${group.hashVariantCount}`);
        lines.push(`- **可节省空间**: ${this._formatSize(group.redundantSize)}`);
        lines.push('');

        for (const variant of group.hashVariants) {
          if (variant.isDuplicate) {
            lines.push(`#### 重复哈希: \`${variant.hash.substring(0, 24)}...\``);
            lines.push('');
            lines.push('| 文件路径 | 大小 | 修改时间 |');
            lines.push('|----------|------|----------|');
            
            for (const file of variant.files) {
              lines.push(`| \`${file.path}\` | ${this._formatSize(file.size)} | ${file.modified} |`);
            }
            lines.push('');
          }
        }
      }
    }

    const allErrors = [...results.scan.errors, ...results.hash.errors];
    if (allErrors.length > 0) {
      lines.push('## ⚠️ 异常报告');
      lines.push('');
      lines.push('| 类型 | 路径 | 错误信息 | 时间 |');
      lines.push('|------|------|----------|------|');
      
      for (const error of allErrors) {
        lines.push(`| \`${error.type}\` | \`${error.path || '-'}\` | ${error.message} | ${error.timestamp} |`);
      }
      lines.push('');
    }

    lines.push('## 📋 删除文件清单');
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>点击展开完整删除文件列表</summary>');
    lines.push('');

    for (const rec of results.recommendations) {
      if (rec.delete.length > 0) {
        lines.push(`### ${rec.groupKey}`);
        lines.push('');
        lines.push('| 文件路径 | 大小 | 修改时间 | 哈希 |');
        lines.push('|----------|------|----------|------|');
        
        for (const file of rec.delete) {
          lines.push(`| \`${file.path}\` | ${this._formatSize(file.size)} | ${file.modified} | \`${(file.hash || '').substring(0, 16)}\` |`);
        }
        lines.push('');
      }
    }

    lines.push('</details>');
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 snapshot-dedup 工具自动生成*');

    return lines.join('\n');
  }

  async writeMarkdown(results, outputPath) {
    const markdown = this.formatMarkdown(results);
    await fs.writeFile(outputPath, markdown, 'utf8');
    return outputPath;
  }

  async writeDeleteScript(results, outputPath, options = {}) {
    const { dryRun = true } = options;
    const filesToDelete = results.recommendations.flatMap(r => r.delete);
    
    const lines = [];
    lines.push('#!/bin/bash');
    lines.push('');
    lines.push('# 快照文件去重 - 删除脚本');
    lines.push(`# 生成时间: ${results.metadata.generatedAt}`);
    lines.push(`# 待删除文件: ${filesToDelete.length}`);
    lines.push(`# 可节省空间: ${this._formatSize(results.summary.potentialSavings)}`);
    lines.push('');

    if (dryRun) {
      lines.push('# 注意: 这是预览脚本，实际不会删除文件');
      lines.push('# 要执行删除，请去掉 DRY_RUN=1 或手动运行');
      lines.push('');
      lines.push('DRY_RUN=1');
      lines.push('');
    }

    lines.push('DELETED_COUNT=0');
    lines.push('TOTAL_SIZE=0');
    lines.push('');

    for (const file of filesToDelete) {
      const escapedPath = file.path.replace(/'/g, "'\\''");
      lines.push(`FILE='${escapedPath}'`);
      lines.push(`FILE_SIZE=${file.size}`);
      lines.push('if [ -f "$FILE" ]; then');
      lines.push('  if [ -z "$DRY_RUN" ]; then');
      lines.push('    rm -f "$FILE" && echo "DELETED: $FILE"');
      lines.push('  else');
      lines.push('    echo "WOULD DELETE: $FILE"');
      lines.push('  fi');
      lines.push('  DELETED_COUNT=$((DELETED_COUNT + 1))');
      lines.push('  TOTAL_SIZE=$((TOTAL_SIZE + FILE_SIZE))');
      lines.push('else');
      lines.push(`  echo "SKIPPED (not found): $FILE"`);
      lines.push('fi');
      lines.push('');
    }

    lines.push('echo "----------------------------------------"');
    lines.push('echo "处理完成!"');
    lines.push('echo "文件数量: $DELETED_COUNT"');
    lines.push('echo "节省空间: $TOTAL_SIZE bytes"');
    lines.push('');

    await fs.writeFile(outputPath, lines.join('\n'), 'utf8');
    await fs.chmod(outputPath, 0o755);
    return outputPath;
  }

  _colors() {
    if (!this.options.color) {
      return { reset: '', bold: '', dim: '', red: '', green: '', yellow: '', blue: '', cyan: '', white: '' };
    }
    return {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
    };
  }

  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _formatNumber(num) {
    return num.toLocaleString();
  }
}

module.exports = { Reporter };
