const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const REQUIRED_COLUMNS = [
  '用户ID',
  '用户名',
  '部门',
  '权限令牌',
  '权限到期时间',
  '最后访问时间',
  '访问资源',
  '权限来源'
];

class PermissionAuditScanner {
  constructor(options = {}) {
    this.auditDate = options.auditDate || new Date().toISOString().split('T')[0];
    this.verbose = options.verbose || false;
    this.issues = [];
    this.warnings = [];
    this.results = [];
    this.processedFiles = 0;
    this.skippedFiles = 0;
  }

  logIssue(file, row, reason, details = {}) {
    this.issues.push({
      文件: path.basename(file),
      行号: row?._lineNumber || 'N/A',
      用户ID: row?.['用户ID'] || 'N/A',
      用户名: row?.['用户名'] || 'N/A',
      问题类型: reason,
      详细信息: details,
      审计时间: new Date().toISOString()
    });
  }

  logWarning(file, message) {
    this.warnings.push({
      文件: path.basename(file),
      警告信息: message,
      审计时间: new Date().toISOString()
    });
  }

  async scanDirectory(directoryPath) {
    this.issues = [];
    this.warnings = [];
    this.results = [];
    this.processedFiles = 0;
    this.skippedFiles = 0;

    if (!fs.existsSync(directoryPath)) {
      throw new Error(`目录不存在: ${directoryPath}`);
    }

    const files = fs.readdirSync(directoryPath)
      .filter(f => f.endsWith('.csv'))
      .map(f => path.join(directoryPath, f));

    if (files.length === 0) {
      this.logWarning(directoryPath, '目录中未找到CSV文件');
      return this.generateReport();
    }

    for (const file of files) {
      await this.processFile(file);
    }

    return this.generateReport();
  }

  async processFile(filePath) {
    return new Promise((resolve) => {
      const results = [];
      const seenRows = new Set();
      let lineNumber = 0;
      let hasHeader = false;
      let headers = [];

      const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
        .pipe(csv({
          mapHeaders: ({ header, index }) => {
            headers.push(header);
            return header;
          }
        }))
        .on('headers', (headerList) => {
          hasHeader = true;
          headers = headerList;
          const missing = REQUIRED_COLUMNS.filter(col => !headerList.includes(col));
          if (missing.length > 0) {
            this.logWarning(filePath, `缺少必需列: ${missing.join(', ')}`);
          }
        })
        .on('data', (data) => {
          lineNumber++;
          data._lineNumber = lineNumber;

          const rowKey = JSON.stringify([
            data['用户ID'],
            data['权限令牌'],
            data['最后访问时间']
          ]);

          if (seenRows.has(rowKey)) {
            this.logIssue(filePath, data, '重复行', {
              重复依据: '用户ID+权限令牌+最后访问时间'
            });
            return;
          }
          seenRows.add(rowKey);

          const validation = this.validateRow(data);
          if (validation.valid) {
            results.push(data);
          } else {
            validation.errors.forEach(err => {
              this.logIssue(filePath, data, '数据校验失败', { 错误: err });
            });
          }
        })
        .on('end', () => {
          this.processedFiles++;
          results.forEach(row => this.analyzePermission(row, filePath));
          resolve();
        })
        .on('error', (err) => {
          this.skippedFiles++;
          this.logWarning(filePath, `文件解析失败: ${err.message}`);
          resolve();
        });

      setTimeout(() => {
        if (!stream.closed) {
          stream.destroy(new Error('解析超时'));
        }
      }, 30000);
    });
  }

  validateRow(row) {
    const errors = [];

    if (!row['用户ID']) errors.push('用户ID为空');
    if (!row['用户名']) errors.push('用户名为空');
    if (!row['权限令牌']) errors.push('权限令牌为空');
    if (!row['权限到期时间']) errors.push('权限到期时间为空');
    if (!row['最后访问时间']) errors.push('最后访问时间为空');

    return { valid: errors.length === 0, errors };
  }

  analyzePermission(row, filePath) {
    const expireDate = new Date(row['权限到期时间']);
    const lastAccessDate = new Date(row['最后访问时间']);
    const auditDate = new Date(this.auditDate);

    if (isNaN(expireDate.getTime())) {
      this.logIssue(filePath, row, '权限到期时间格式无效', {
        原始值: row['权限到期时间']
      });
      return;
    }

    if (isNaN(lastAccessDate.getTime())) {
      this.logIssue(filePath, row, '最后访问时间格式无效', {
        原始值: row['最后访问时间']
      });
      return;
    }

    const isExpired = expireDate < auditDate;
    const accessedAfterExpire = lastAccessDate > expireDate;

    if (isExpired && accessedAfterExpire) {
      this.results.push({
        用户ID: row['用户ID'],
        用户名: row['用户名'],
        部门: row['部门'] || '未知部门',
        权限令牌: row['权限令牌'],
        权限到期时间: row['权限到期时间'],
        最后访问时间: row['最后访问时间'],
        访问资源: row['访问资源'] || '未知资源',
        权限来源: row['权限来源'] || '直接分配',
        过期天数: Math.floor((auditDate - expireDate) / (1000 * 60 * 60 * 24)),
        过期后访问天数: Math.floor((lastAccessDate - expireDate) / (1000 * 60 * 60 * 24))
      });
    }
  }

  generateReport() {
    const summary = {
      扫描日期: this.auditDate,
      报告生成时间: new Date().toISOString(),
      工具名称: '权限审计日志临权到期巡检',
      工具版本: '1.0.0',
      处理文件数: this.processedFiles,
      跳过文件数: this.skippedFiles,
      发现问题数: this.issues.length,
      警告数: this.warnings.length,
      过期仍访问用户数: this.results.length
    };

    return {
      summary,
      过期仍访问用户列表: this.results.sort((a, b) => b.过期天数 - a.过期天数),
      数据问题详情: this.issues,
      处理警告: this.warnings
    };
  }

  formatReport(report, format = 'text') {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    const lines = [];
    lines.push('='.repeat(70));
    lines.push('权限审计日志临权到期巡检报告');
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`【扫描摘要】`);
    lines.push(`扫描日期: ${report.summary.扫描日期}`);
    lines.push(`报告生成时间: ${report.summary.报告生成时间}`);
    lines.push(`工具名称: ${report.summary.工具名称}`);
    lines.push(`工具版本: ${report.summary.工具版本}`);
    lines.push(`处理文件数: ${report.summary.处理文件数}`);
    lines.push(`跳过文件数: ${report.summary.跳过文件数}`);
    lines.push(`发现问题数: ${report.summary.发现问题数}`);
    lines.push(`警告数: ${report.summary.警告数}`);
    lines.push(`过期仍访问用户数: ${report.summary.过期仍访问用户数}`);
    lines.push('');

    if (report['过期仍访问用户列表'].length > 0) {
      lines.push('【过期仍访问用户列表】');
      lines.push('-'.repeat(70));
      report['过期仍访问用户列表'].forEach((user, idx) => {
        lines.push(`${idx + 1}. 用户ID: ${user.用户ID} | 用户名: ${user.用户名}`);
        lines.push(`   部门: ${user.部门} | 权限来源: ${user.权限来源}`);
        lines.push(`   权限令牌: ${user.权限令牌}`);
        lines.push(`   权限到期时间: ${user.权限到期时间} | 已过期 ${user.过期天数} 天`);
        lines.push(`   最后访问时间: ${user.最后访问时间} | 过期后访问 ${user.过期后访问天数} 天`);
        lines.push(`   访问资源: ${user.访问资源}`);
        lines.push('');
      });
    }

    if (report['数据问题详情'].length > 0) {
      lines.push('【数据问题详情】');
      lines.push('-'.repeat(70));
      report['数据问题详情'].forEach((issue, idx) => {
        lines.push(`${idx + 1}. [${issue.问题类型}] 文件: ${issue.文件}, 行: ${issue.行号}`);
        lines.push(`   用户: ${issue.用户名} (ID: ${issue.用户ID})`);
        lines.push(`   详情: ${JSON.stringify(issue.详细信息)}`);
        lines.push('');
      });
    }

    if (report['处理警告'].length > 0) {
      lines.push('【处理警告】');
      lines.push('-'.repeat(70));
      report['处理警告'].forEach((warn, idx) => {
        lines.push(`${idx + 1}. 文件: ${warn.文件}`);
        lines.push(`   ${warn.警告信息}`);
        lines.push('');
      });
    }

    lines.push('='.repeat(70));
    lines.push('报告结束 - 权限审计日志临权到期巡检');
    lines.push('='.repeat(70));

    return lines.join('\n');
  }
}

module.exports = PermissionAuditScanner;
