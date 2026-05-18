import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BillReporter {
  constructor(options = {}) {
    this.options = {
      outputDir: path.join(__dirname, '../../output'),
      ...options
    };
    this.runId = this.generateRunId();
  }

  generateRunId() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  }

  async generateReport(parseResult, validateResult, runType = '正式') {
    const reportData = {
      runId: this.runId,
      runType,
      runTime: new Date().toISOString(),
      parseResult: this.sanitizeData(parseResult),
      validateResult: this.sanitizeData(validateResult),
      summary: {
        ...validateResult.summary,
        fileCount: Array.isArray(parseResult) ? parseResult.length : 1,
        billCount: validateResult.summary.total
      }
    };

    await this.ensureOutputDir();
    await this.writeJsonReport(reportData);
    await this.writeTextReport(reportData);
    await this.writeComparisonData(reportData);

    return {
      runId: this.runId,
      files: {
        json: path.join(this.options.outputDir, `report_${this.runId}.json`),
        text: path.join(this.options.outputDir, `report_${this.runId}.txt`),
        comparison: path.join(this.options.outputDir, `comparison_${this.runId}.json`)
      }
    };
  }

  sanitizeData(data) {
    return JSON.parse(JSON.stringify(data, (key, value) => {
      if (key === 'originalData') return undefined;
      return value;
    }));
  }

  async ensureOutputDir() {
    try {
      await fs.access(this.options.outputDir);
    } catch {
      await fs.mkdir(this.options.outputDir, { recursive: true });
    }
  }

  async writeJsonReport(reportData) {
    const filePath = path.join(this.options.outputDir, `report_${this.runId}.json`);
    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf-8');
    return filePath;
  }

  async writeTextReport(reportData) {
    const filePath = path.join(this.options.outputDir, `report_${this.runId}.txt`);
    const content = this.formatTextReport(reportData);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  async writeComparisonData(reportData) {
    const comparisonData = {
      runId: this.runId,
      runTime: reportData.runTime,
      summary: reportData.summary,
      keyMetrics: this.extractKeyMetrics(reportData)
    };
    const filePath = path.join(this.options.outputDir, `comparison_${this.runId}.json`);
    await fs.writeFile(filePath, JSON.stringify(comparisonData, null, 2), 'utf-8');
    return filePath;
  }

  extractKeyMetrics(reportData) {
    const metrics = {
      total: reportData.summary.total,
      passed: reportData.summary.passed,
      failed: reportData.summary.failed,
      warning: reportData.summary.warning,
      red冲Count: reportData.summary.red冲Count,
      totalAmount: reportData.summary.totalAmount,
      passRate: reportData.summary.passRate,
      errorTypes: this.countErrorTypes(reportData.validateResult)
    };
    return metrics;
  }

  countErrorTypes(validateResult) {
    const errorCounts = {};
    validateResult.results.forEach(result => {
      result.issues.forEach(issue => {
        const key = `${issue.type}_${issue.level}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
    });
    return errorCounts;
  }

  formatTextReport(reportData) {
    const lines = [];
    const { summary } = reportData;

    lines.push('========================================');
    lines.push('  社区维修基金办基金票据装订报告');
    lines.push('========================================');
    lines.push('');
    lines.push(`运行ID: ${reportData.runId}`);
    lines.push(`运行类型: ${reportData.runType}`);
    lines.push(`运行时间: ${new Date(reportData.runTime).toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push('────────────── 汇总统计 ──────────────');
    lines.push(`文件数量: ${summary.fileCount}`);
    lines.push(`票据总数: ${summary.billCount}`);
    lines.push(`通过数量: ${summary.passed}`);
    lines.push(`警告数量: ${summary.warning}`);
    lines.push(`不通过数量: ${summary.failed}`);
    lines.push(`通过率: ${summary.passRate}%`);
    lines.push(`红冲票据: ${summary.red冲Count}`);
    lines.push(`总金额: ¥${summary.totalAmount.toFixed(2)}`);
    lines.push('');
    lines.push('────────────── 详细问题 ──────────────');
    lines.push('');

    const failedBills = reportData.validateResult.results.filter(r => !r.isValid);
    if (failedBills.length > 0) {
      lines.push('不通过票据明细:');
      lines.push('');
      failedBills.forEach((result, idx) => {
        lines.push(`${idx + 1}. 票据号: ${result.bill.billNumber || result.bill.billId || '未知'} - 小区: ${result.bill.communityName}`);
        lines.push(`   项目: ${result.bill.projectName}`);
        lines.push(`   金额: ¥${result.bill.amount.toFixed(2)}`);
        lines.push(`   问题:`);
        result.issues.filter(i => i.level === 'error').forEach(issue => {
          lines.push(`     [${issue.type}] ${issue.message}`);
        });
        lines.push('');
      });
    }

    const warningBills = reportData.validateResult.results.filter(
      r => r.isValid && r.issues.some(i => i.level === 'warning')
    );
    if (warningBills.length > 0) {
      lines.push('有警告票据明细:');
      lines.push('');
      warningBills.forEach((result, idx) => {
        lines.push(`${idx + 1}. 票据号: ${result.bill.billNumber || result.bill.billId || '未知'}`);
        result.issues.filter(i => i.level === 'warning').forEach(issue => {
          lines.push(`     [${issue.type}] ${issue.message}`);
        });
        lines.push('');
      });
    }

    const red冲Bills = reportData.validateResult.results.filter(r => r.bill.isRed冲);
    if (red冲Bills.length > 0) {
      lines.push('────────────── 红冲票据 ──────────────');
      lines.push('');
      red冲Bills.forEach((result, idx) => {
        lines.push(`${idx + 1}. 票据号: ${result.bill.billNumber}`);
        lines.push(`   关联原票: ${result.bill.relatedBillId || '无'}`);
        lines.push(`   红冲金额: ¥${result.bill.amount.toFixed(2)}`);
        lines.push('');
      });
    }

    lines.push('========================================');
    lines.push('报告生成完成');
    lines.push('========================================');

    return lines.join('\n');
  }

  async getReportList() {
    await this.ensureOutputDir();
    const files = await fs.readdir(this.options.outputDir);
    const reportFiles = files.filter(f => f.startsWith('report_') && f.endsWith('.json'));
    
    const reports = [];
    for (const file of reportFiles) {
      try {
        const content = await fs.readFile(path.join(this.options.outputDir, file), 'utf-8');
        const data = JSON.parse(content);
        reports.push({
          file,
          runId: data.runId,
          runType: data.runType,
          runTime: data.runTime,
          summary: data.summary
        });
      } catch (e) {
        console.error(`读取报告 ${file} 失败:`, e.message);
      }
    }
    
    return reports.sort((a, b) => new Date(b.runTime) - new Date(a.runTime));
  }

  async compareReports(runId1, runId2) {
    const reports = await this.getReportList();
    const r1 = reports.find(r => r.runId === runId1);
    const r2 = reports.find(r => r.runId === runId2);

    if (!r1 || !r2) {
      throw new Error('找不到指定的报告');
    }

    const comparison = {
      run1: {
        runId: r1.runId,
        runTime: r1.runTime,
        summary: r1.summary
      },
      run2: {
        runId: r2.runId,
        runTime: r2.runTime,
        summary: r2.summary
      },
      differences: this.calculateDifferences(r1.summary, r2.summary)
    };

    return comparison;
  }

  calculateDifferences(summary1, summary2) {
    const diffs = {};
    const keys = ['total', 'passed', 'failed', 'warning', 'red冲Count', 'totalAmount', 'passRate'];
    
    keys.forEach(key => {
      const v1 = summary1[key];
      const v2 = summary2[key];
      diffs[key] = {
        before: v1,
        after: v2,
        change: typeof v1 === 'number' ? v2 - v1 : null
      };
    });

    return diffs;
  }

  async printComparison(runId1, runId2) {
    const comparison = await this.compareReports(runId1, runId2);
    const lines = [];

    lines.push('========================================');
    lines.push('  两次运行对比报告');
    lines.push('========================================');
    lines.push('');
    lines.push(`运行1: ${comparison.run1.runId} (${new Date(comparison.run1.runTime).toLocaleString('zh-CN')})`);
    lines.push(`运行2: ${comparison.run2.runId} (${new Date(comparison.run2.runTime).toLocaleString('zh-CN')})`);
    lines.push('');
    lines.push('────────────── 指标对比 ──────────────');
    lines.push('');

    Object.entries(comparison.differences).forEach(([key, value]) => {
      const changeStr = value.change !== null ? 
        `变化: ${value.change > 0 ? '+' : ''}${value.change.toFixed(2)}` : '';
      lines.push(`${key}:`);
      lines.push(`  之前: ${value.before}`);
      lines.push(`  之后: ${value.after}`);
      if (changeStr) lines.push(`  ${changeStr}`);
      lines.push('');
    });

    lines.push('========================================');

    return lines.join('\n');
  }
}

export default BillReporter;
