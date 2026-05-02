const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('./config');
const { RULE_SEVERITY, VALIDATION_RULES } = require('./validator');

class Reporter {
  constructor(options = {}) {
    this.config = options.config || config.DEFAULT_CONFIG;
    this.workspaceRoot = options.workspaceRoot || config.getWorkspaceRoot();
  }

  getPath(relativePath) {
    return path.join(this.workspaceRoot, relativePath);
  }

  getReportsDir() {
    return this.getPath(this.config.directories.reports);
  }

  generateTimestamp() {
    return moment().format('YYYYMMDD-HHmmss');
  }

  formatRuleName(rule) {
    const ruleNames = {
      [VALIDATION_RULES.FILENAME_FORMAT]: '文件名格式',
      [VALIDATION_RULES.FILENAME_UNIQUENESS]: '文件名唯一性',
      [VALIDATION_RULES.COLLECTION_ID_EXISTS]: '馆藏号存在性',
      [VALIDATION_RULES.COLLECTION_ID_FORMAT]: '馆藏号格式',
      [VALIDATION_RULES.EXIF_TIME_VALID]: 'EXIF时间有效性',
      [VALIDATION_RULES.EXIF_TIME_CONSISTENCY]: 'EXIF时间一致性',
      [VALIDATION_RULES.DUPLICATE_HASH]: '重复文件检测',
      [VALIDATION_RULES.SHOOTING_LIST_MATCH]: '拍摄清单匹配',
      [VALIDATION_RULES.PHOTO_COUNT_LIMIT]: '照片数量限制',
      [VALIDATION_RULES.EXTENSION_VALID]: '文件扩展名'
    };
    return ruleNames[rule] || rule;
  }

  formatSeverity(severity) {
    const severityNames = {
      [RULE_SEVERITY.ERROR]: '错误',
      [RULE_SEVERITY.WARNING]: '警告',
      [RULE_SEVERITY.INFO]: '信息'
    };
    return severityNames[severity] || severity;
  }

  formatStatusIcon(passed, severity) {
    if (passed) return '✅';
    if (severity === RULE_SEVERITY.ERROR) return '❌';
    if (severity === RULE_SEVERITY.WARNING) return '⚠️';
    return 'ℹ️';
  }

  async generateMarkdownReport(validationResult, scanResult, options = {}) {
    const { title = '照片入库质检报告' } = options;
    const timestamp = this.generateTimestamp();

    const errors = validationResult.results.filter(
      r => !r.passed && r.severity === RULE_SEVERITY.ERROR
    );
    const warnings = validationResult.results.filter(
      r => !r.passed && r.severity === RULE_SEVERITY.WARNING
    );
    const passed = validationResult.results.filter(r => r.passed);

    let markdown = `# ${title}\n\n`;
    markdown += `**生成时间**: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 摘要\n\n`;
    markdown += `| 指标 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总照片数 | ${scanResult.photos?.length || 0} |\n`;
    markdown += `| 验证项总数 | ${validationResult.total} |\n`;
    markdown += `| ✅ 通过 | ${validationResult.passed} |\n`;
    markdown += `| ❌ 错误 | ${validationResult.errors} |\n`;
    markdown += `| ⚠️ 警告 | ${validationResult.warnings} |\n`;
    markdown += `| **整体状态** | ${validationResult.isValid ? '✅ 通过' : '❌ 失败'} |\n\n`;

    if (errors.length > 0) {
      markdown += `## 错误 (${errors.length})\n\n`;
      for (const result of errors) {
        markdown += `### ${this.formatStatusIcon(false, result.severity)} ${this.formatRuleName(result.rule)}\n\n`;
        markdown += `**问题**: ${result.message}\n\n`;
        if (result.context.photo) {
          markdown += `**涉及文件**: \`${result.context.photo}\`\n\n`;
        }
        if (result.context.photos && result.context.photos.length > 0) {
          markdown += `**涉及文件**:\n`;
          for (const p of result.context.photos) {
            markdown += `- \`${p}\`\n`;
          }
          markdown += `\n`;
        }
      }
    }

    if (warnings.length > 0) {
      markdown += `## 警告 (${warnings.length})\n\n`;
      for (const result of warnings) {
        markdown += `### ${this.formatStatusIcon(false, result.severity)} ${this.formatRuleName(result.rule)}\n\n`;
        markdown += `**问题**: ${result.message}\n\n`;
        if (result.context.photo) {
          markdown += `**涉及文件**: \`${result.context.photo}\`\n\n`;
        }
        if (result.context.photos && result.context.photos.length > 0) {
          markdown += `**涉及文件**:\n`;
          for (const p of result.context.photos) {
            markdown += `- \`${p}\`\n`;
          }
          markdown += `\n`;
        }
      }
    }

    if (passed.length > 0) {
      markdown += `## 通过项 (${passed.length})\n\n`;
      for (const result of passed) {
        markdown += `- ${this.formatStatusIcon(true, result.severity)} **${this.formatRuleName(result.rule)}**: ${result.message}\n`;
      }
      markdown += `\n`;
    }

    if (scanResult.photos && scanResult.photos.length > 0) {
      markdown += `---\n\n`;
      markdown += `## 照片清单\n\n`;
      markdown += `| 文件名 | 大小 | 馆藏号 | 哈希(前12位) | EXIF时间 |\n`;
      markdown += `|--------|------|--------|--------------|----------|\n`;
      
      for (const photo of scanResult.photos) {
        const collectionId = this.extractCollectionIdFromFilename(photo.name);
        const exifTime = photo.exif?.dateTimeOriginal 
          ? moment(photo.exif.dateTimeOriginal).format('YYYY-MM-DD HH:mm') 
          : '无';
        
        markdown += `| ${photo.name} | ${this.formatFileSize(photo.size)} | ${collectionId || '-'} | ${photo.hash.substring(0, 12)} | ${exifTime} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `*报告由"照片入库质检搬运工"生成*\n`;

    return markdown;
  }

  extractCollectionIdFromFilename(filename) {
    const idPattern = this.config.validation.collectionIdPattern;
    const regex = new RegExp(idPattern);
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    const match = nameWithoutExt.match(regex);
    return match ? match[0] : null;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async generateErrorCsv(validationResult, options = {}) {
    const errors = validationResult.results.filter(
      r => !r.passed && (r.severity === RULE_SEVERITY.ERROR || r.severity === RULE_SEVERITY.WARNING)
    );

    if (errors.length === 0) {
      return null;
    }

    const records = errors.map((result, index) => ({
      id: index + 1,
      类型: this.formatSeverity(result.severity),
      规则: this.formatRuleName(result.rule),
      消息: result.message,
      涉及文件: result.context.photo || (result.context.photos?.join('; ') || ''),
      上下文: JSON.stringify(result.context)
    }));

    return records;
  }

  async saveReport(validationResult, scanResult, options = {}) {
    const {
      format = 'both',
      prefix = 'check-report'
    } = options;

    const reportsDir = this.getReportsDir();
    await fs.ensureDir(reportsDir);

    const timestamp = this.generateTimestamp();
    const results = {};

    if (format === 'markdown' || format === 'both') {
      const markdown = await this.generateMarkdownReport(validationResult, scanResult);
      const mdPath = path.join(reportsDir, `${prefix}-${timestamp}.md`);
      await fs.writeFile(mdPath, markdown, 'utf-8');
      results.markdown = mdPath;
    }

    if (format === 'csv' || format === 'both') {
      const csvRecords = await this.generateErrorCsv(validationResult);
      if (csvRecords) {
        const csvPath = path.join(reportsDir, `${prefix}-${timestamp}-errors.csv`);
        const csvWriter = createCsvWriter({
          path: csvPath,
          header: [
            { id: 'id', title: '序号' },
            { id: '类型', title: '类型' },
            { id: '规则', title: '规则' },
            { id: '消息', title: '消息' },
            { id: '涉及文件', title: '涉及文件' },
            { id: '上下文', title: '上下文' }
          ]
        });
        await csvWriter.writeRecords(csvRecords);
        results.csv = csvPath;
      } else {
        results.csv = '无错误，未生成CSV';
      }
    }

    return results;
  }

  async generateArchiveReport(commitResult, options = {}) {
    const { title = '归档事务报告' } = options;
    const timestamp = this.generateTimestamp();

    let markdown = `# ${title}\n\n`;
    markdown += `**生成时间**: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    markdown += `**事务ID**: ${commitResult.transactionId}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 执行摘要\n\n`;
    markdown += `| 指标 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总文件数 | ${commitResult.summary.total} |\n`;
    markdown += `| ✅ 成功 | ${commitResult.summary.successful} |\n`;
    markdown += `| ❌ 失败 | ${commitResult.summary.failed} |\n`;
    markdown += `| ⏭️ 跳过 | ${commitResult.summary.skipped} |\n\n`;

    if (commitResult.archiveResult?.successful?.length > 0) {
      markdown += `## 成功归档的文件\n\n`;
      markdown += `| 原路径 | 归档路径 | 馆藏号 | 哈希(前12位) |\n`;
      markdown += `|--------|----------|--------|--------------|\n`;
      
      for (const photo of commitResult.archiveResult.successful) {
        if (photo.note) continue;
        markdown += `| ${photo.originalPath} | ${photo.archivePath} | ${photo.collectionId || '-'} | ${photo.hash.substring(0, 12)} |\n`;
      }
      markdown += `\n`;
    }

    if (commitResult.archiveResult?.failed?.length > 0) {
      markdown += `## 归档失败的文件\n\n`;
      markdown += `| 文件 | 错误原因 |\n`;
      markdown += `|------|----------|\n`;
      
      for (const photo of commitResult.archiveResult.failed) {
        markdown += `| ${photo.originalPath} | ${photo.error} |\n`;
      }
      markdown += `\n`;
    }

    if (commitResult.archiveResult?.skipped?.length > 0) {
      markdown += `## 跳过的文件\n\n`;
      markdown += `| 文件 | 原因 |\n`;
      markdown += `|------|------|\n`;
      
      for (const photo of commitResult.archiveResult.skipped) {
        markdown += `| ${photo.originalPath} | ${photo.reason} |\n`;
      }
      markdown += `\n`;
    }

    markdown += `---\n\n`;
    markdown += `*报告由"照片入库质检搬运工"生成*\n`;

    return markdown;
  }

  async saveArchiveReport(commitResult, options = {}) {
    const reportsDir = this.getReportsDir();
    await fs.ensureDir(reportsDir);

    const timestamp = this.generateTimestamp();
    const markdown = await this.generateArchiveReport(commitResult, options);
    const mdPath = path.join(reportsDir, `archive-report-${timestamp}.md`);
    await fs.writeFile(mdPath, markdown, 'utf-8');

    return { markdown: mdPath };
  }
}

module.exports = {
  Reporter
};
