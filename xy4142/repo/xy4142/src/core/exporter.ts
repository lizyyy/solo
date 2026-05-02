import * as fs from 'fs-extra';
import * as path from 'path';
import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';
import {
  BatchValidationResult,
  HumanReview,
  TestValidationResult,
  CheckResult,
  CheckStatus,
  PluginManifest,
  AuditPackage,
  AuditContent,
  SystemInfo
} from '../types';
import { createLogger } from '../utils/logger';
import { ExportError, errorToRecord } from '../utils/error';

const logger = createLogger('exporter');

export interface ExportOptions {
  includeRawOutput?: boolean;
  includeExecutionMetrics?: boolean;
  includeAllCheckDetails?: boolean;
  maxDetailsPerTest?: number;
  timestampFormat?: 'iso' | 'unix' | 'readable';
  reportTitle?: string;
  companyName?: string;
  reportVersion?: string;
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  includeRawOutput: true,
  includeExecutionMetrics: true,
  includeAllCheckDetails: false,
  maxDetailsPerTest: 10,
  timestampFormat: 'readable',
  reportTitle: 'WASM 规则插件验收报告',
  companyName: '质量控制部',
  reportVersion: '1.0.0'
};

export class Exporter {
  private options: Required<ExportOptions>;

  constructor(options?: ExportOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);

    switch (this.options.timestampFormat) {
      case 'iso':
        return date.toISOString();
      case 'unix':
        return String(timestamp);
      case 'readable':
      default:
        return date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  checkStatusToEmoji(status: CheckStatus): string {
    switch (status) {
      case 'passed':
        return '✅';
      case 'failed':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'skipped':
        return '⏭️';
      case 'error':
        return '💥';
      default:
        return '❓';
    }
  }

  checkStatusToText(status: CheckStatus): string {
    switch (status) {
      case 'passed':
        return '通过';
      case 'failed':
        return '失败';
      case 'warning':
        return '警告';
      case 'skipped':
        return '跳过';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  }

  checkTypeToText(type: string): string {
    const typeMap: Record<string, string> = {
      'schema_input': '输入Schema校验',
      'schema_output': '输出Schema校验',
      'version_compatibility': '版本兼容性',
      'output_match': '输出值匹配',
      'performance_duration': '执行时间',
      'performance_memory': '内存使用',
      'performance_cpu': 'CPU使用',
      'error_code': '错误码校验',
      'capability_usage': '权限使用'
    };
    return typeMap[type] || type;
  }

  generateMarkdownReport(
    result: BatchValidationResult,
    review?: HumanReview,
    manifest?: PluginManifest
  ): string {
    const lines: string[] = [];

    lines.push(`# ${this.options.reportTitle}`);
    lines.push('');
    lines.push(`**生成时间**: ${this.formatTimestamp(Date.now())}`);
    lines.push(`**生成单位**: ${this.options.companyName}`);
    lines.push(`**报告版本**: ${this.options.reportVersion}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## 一、基本信息');
    lines.push('');
    lines.push('| 项目 | 内容 |');
    lines.push('|------|------|');
    lines.push(`| 验收结果ID | ${result.id} |`);
    lines.push(`| 测试批次ID | ${result.batchId} |`);
    lines.push(`| 插件ID | ${result.pluginId} |`);
    lines.push(`| 插件版本 | ${result.pluginVersion} |`);
    lines.push(`| 开始时间 | ${this.formatTimestamp(result.startedAt)} |`);
    lines.push(`| 完成时间 | ${this.formatTimestamp(result.completedAt)} |`);
    lines.push(`| 总耗时 | ${this.formatDuration(result.completedAt - result.startedAt)} |`);
    lines.push(`| **整体状态** | **${this.checkStatusToText(result.overallStatus)} ${this.checkStatusToEmoji(result.overallStatus)}** |`);
    lines.push('');

    lines.push('## 二、验收汇总');
    lines.push('');
    lines.push(`- **总测试用例数**: ${result.summary.total}`);
    lines.push(`- **通过**: ${result.summary.passed}`);
    lines.push(`- **失败**: ${result.summary.failed}`);
    lines.push(`- **警告**: ${result.summary.warnings}`);
    lines.push(`- **跳过**: ${result.summary.skipped}`);
    lines.push(`- **错误**: ${result.summary.errors}`);
    lines.push('');

    lines.push('### 性能指标');
    lines.push('');
    lines.push('| 指标 | 平均值 | 最大值 | 最小值 |');
    lines.push('|------|--------|--------|--------|');
    lines.push(`| 执行时间 | ${this.formatDuration(result.summary.performance.avgDurationMs)} | ${this.formatDuration(result.summary.performance.maxDurationMs)} | ${this.formatDuration(result.summary.performance.minDurationMs)} |`);
    lines.push(`| 内存使用 | ${this.formatBytes(result.summary.performance.avgMemoryBytes)} | ${this.formatBytes(result.summary.performance.maxMemoryBytes)} | - |`);
    lines.push('');

    lines.push('### 各类检查统计');
    lines.push('');
    lines.push('| 检查类型 | 通过 | 失败 | 警告 |');
    lines.push('|----------|------|------|------|');

    for (const [type, stats] of Object.entries(result.summary.byCheckType)) {
      if (stats.passed === 0 && stats.failed === 0 && stats.warnings === 0) continue;
      lines.push(`| ${this.checkTypeToText(type)} | ${stats.passed} | ${stats.failed} | ${stats.warnings} |`);
    }
    lines.push('');

    lines.push('## 三、测试用例详情');
    lines.push('');

    for (const testResult of result.testResults) {
      const statusEmoji = testResult.valid ? '✅' : '❌';
      const statusText = testResult.valid ? '通过' : '失败';

      lines.push(`### 测试用例: ${testResult.testCaseId}`);
      lines.push('');
      lines.push(`**状态**: ${statusEmoji} ${statusText}`);
      lines.push(`**校验时间**: ${this.formatTimestamp(testResult.validatedAt)}`);
      lines.push('');

      lines.push('#### 检查结果');
      lines.push('');
      lines.push('| 检查类型 | 状态 | 说明 |');
      lines.push('|----------|------|------|');

      for (const check of testResult.checkResults) {
        const emoji = this.checkStatusToEmoji(check.status);
        const status = this.checkStatusToText(check.status);
        lines.push(`| ${this.checkTypeToText(check.type)} | ${emoji} ${status} | ${check.message} |`);
      }
      lines.push('');

      if (this.options.includeExecutionMetrics) {
        lines.push('#### 执行指标');
        lines.push('');
        lines.push('| 指标 | 值 |');
        lines.push('|------|-----|');
        lines.push(`| 执行时间 | ${this.formatDuration(testResult.executionResult.metrics.durationMs)} |`);
        lines.push(`| CPU时间 | ${this.formatDuration(testResult.executionResult.metrics.cpuTimeMs)} |`);
        lines.push(`| 内存使用 | ${this.formatBytes(testResult.executionResult.metrics.memoryUsedBytes)} |`);
        lines.push(`| 峰值内存 | ${this.formatBytes(testResult.executionResult.metrics.memoryPeakBytes)} |`);
        lines.push('');
      }

      if (testResult.executionResult.errors.length > 0) {
        lines.push('#### 错误信息');
        lines.push('');
        for (const error of testResult.executionResult.errors.slice(0, this.options.maxDetailsPerTest)) {
          lines.push(`- **错误码**: ${error.code}`);
          lines.push(`  - 消息: ${error.message}`);
          if (error.details) {
            lines.push(`  - 详情: ${JSON.stringify(error.details)}`);
          }
          lines.push('');
        }
      }

      lines.push('---');
      lines.push('');
    }

    if (review) {
      lines.push('## 四、人工复核');
      lines.push('');
      lines.push(`| 项目 | 内容 |`);
      lines.push(`|------|------|`);
      lines.push(`| 复核人 | ${review.reviewer} |`);
      lines.push(`| 复核时间 | ${this.formatTimestamp(review.reviewedAt)} |`);
      lines.push(`| 复核状态 | ${this.checkStatusToText(review.status === 'completed' ? 'passed' : 'warning')} |`);
      lines.push(`| **最终结论** | **${review.finalDecision.approved ? '✅ 通过' : '❌ 不通过'}** |`);
      lines.push('');

      lines.push('### 复核意见');
      lines.push('');
      lines.push(`> ${review.finalDecision.reason}`);
      lines.push('');

      if (review.finalDecision.conditions && review.finalDecision.conditions.length > 0) {
        lines.push('### 附带条件');
        lines.push('');
        for (const condition of review.finalDecision.conditions) {
          lines.push(`- [ ] ${condition}`);
        }
        lines.push('');
      }

      if (review.finalDecision.recommendedAction) {
        lines.push('### 建议行动');
        lines.push('');
        lines.push(review.finalDecision.recommendedAction);
        lines.push('');
      }

      if (review.comments.length > 0) {
        lines.push('### 复核评论');
        lines.push('');
        for (const comment of review.comments) {
          lines.push(`**${comment.author}** (${this.formatTimestamp(comment.createdAt)}):`);
          lines.push(`> ${comment.comment}`);
          if (comment.testCaseId) {
            lines.push(`> *测试用例: ${comment.testCaseId}*`);
          }
          lines.push('');
        }
      }

      lines.push('---');
      lines.push('');
    }

    if (manifest) {
      lines.push('## 五、插件信息');
      lines.push('');
      lines.push('| 项目 | 内容 |');
      lines.push('|------|------|');
      lines.push(`| 插件名称 | ${manifest.name} |`);
      lines.push(`| 插件ID | ${manifest.id} |`);
      lines.push(`| 版本 | ${manifest.version} |`);
      lines.push(`| 类型 | ${manifest.pluginType} |`);
      lines.push(`| 供应商 | ${manifest.vendor || 'N/A'} |`);
      lines.push(`| 作者 | ${manifest.author || 'N/A'} |`);
      lines.push(`| 描述 | ${manifest.description || 'N/A'} |`);
      lines.push('');

      lines.push('### 约束条件');
      lines.push('');
      lines.push('| 约束 | 值 |');
      lines.push('|------|-----|');
      lines.push(`| 最大超时 | ${this.formatDuration(manifest.constraints.timeoutMs)} |`);
      lines.push(`| 最大内存页数 | ${manifest.constraints.memoryPagesMax} |`);
      if (manifest.constraints.memoryBytesMax) {
        lines.push(`| 最大内存 | ${this.formatBytes(manifest.constraints.memoryBytesMax)} |`);
      }
      lines.push('');

      if (manifest.capabilities && manifest.capabilities.length > 0) {
        lines.push('### 请求的能力权限');
        lines.push('');
        for (const cap of manifest.capabilities) {
          lines.push(`- ${cap}`);
        }
        lines.push('');
      }

      if (manifest.dependencies && manifest.dependencies.length > 0) {
        lines.push('### 依赖项');
        lines.push('');
        lines.push('| 名称 | 版本 | 必需 | 类型 |');
        lines.push('|------|------|------|------|');
        for (const dep of manifest.dependencies) {
          lines.push(`| ${dep.name} | ${dep.version} | ${dep.required ? '是' : '否'} | ${dep.type} |`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    lines.push('## 六、报告说明');
    lines.push('');
    lines.push('> 此报告由 WASM 规则插件验收系统自动生成。');
    lines.push('> 报告包含自动化验收结果和人工复核结论（如有）。');
    lines.push('> 如需进一步验证，请参考原始数据文件。');
    lines.push('');
    lines.push(`**报告生成时间**: ${this.formatTimestamp(Date.now())}`);
    lines.push(`**系统信息**: Node.js ${process.version}`);

    return lines.join('\n');
  }

  createAuditPackage(
    result: BatchValidationResult,
    manifest?: PluginManifest,
    review?: HumanReview
  ): AuditPackage {
    const systemInfo: SystemInfo = {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      validationEngineVersion: this.options.reportVersion,
      timestamp: Date.now()
    };

    const content: AuditContent = {
      pluginManifest: manifest ? (manifest as unknown as Record<string, unknown>) : {},
      testBatch: {},
      validationResult: result as unknown as Record<string, unknown>,
      systemInfo
    };

    if (review) {
      content.humanReview = review as unknown as Record<string, unknown>;
    }

    return {
      id: `audit-${uuidv4()}`,
      generatedAt: Date.now(),
      generator: 'WASM-Rule-Validator',
      version: this.options.reportVersion,
      content
    };
  }

  async saveMarkdownReport(
    filePath: string,
    result: BatchValidationResult,
    review?: HumanReview,
    manifest?: PluginManifest
  ): Promise<void> {
    try {
      const markdown = this.generateMarkdownReport(result, review, manifest);
      await fs.writeFile(filePath, markdown, 'utf-8');
      logger.info(`Saved Markdown report to: ${filePath}`);
    } catch (error) {
      throw new ExportError(`Failed to save Markdown report`, {
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async saveAuditPackage(
    filePath: string,
    result: BatchValidationResult,
    manifest?: PluginManifest,
    review?: HumanReview
  ): Promise<void> {
    try {
      const auditPackage = this.createAuditPackage(result, manifest, review);

      if (filePath.endsWith('.zip')) {
        const zip = new JSZip();

        zip.file('manifest.json', JSON.stringify(auditPackage, null, 2));

        zip.file('validation-result.json', JSON.stringify(result, null, 2));

        if (manifest) {
          zip.file('plugin-manifest.json', JSON.stringify(manifest, null, 2));
        }

        if (review) {
          zip.file('human-review.json', JSON.stringify(review, null, 2));
        }

        const markdown = this.generateMarkdownReport(result, review, manifest);
        zip.file('report.md', markdown);

        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fs.writeFile(filePath, zipContent);
      } else {
        const jsonData = JSON.stringify(auditPackage, null, 2);
        await fs.writeFile(filePath, jsonData, 'utf-8');
      }

      logger.info(`Saved audit package to: ${filePath}`);
    } catch (error) {
      throw new ExportError(`Failed to save audit package`, {
        filePath,
        error: errorToRecord(error)
      });
    }
  }

  async exportAll(
    basePath: string,
    result: BatchValidationResult,
    manifest?: PluginManifest,
    review?: HumanReview
  ): Promise<{
    reportPath: string;
    auditPath: string;
  }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `validation-${result.id}-${timestamp}`;

    const reportPath = path.join(basePath, `${baseName}.md`);
    const auditPath = path.join(basePath, `${baseName}.zip`);

    await fs.ensureDir(basePath);

    await this.saveMarkdownReport(reportPath, result, review, manifest);
    await this.saveAuditPackage(auditPath, result, manifest, review);

    logger.info(`Exported all files to: ${basePath}`);

    return { reportPath, auditPath };
  }
}

export function createExporter(options?: ExportOptions): Exporter {
  return new Exporter(options);
}
