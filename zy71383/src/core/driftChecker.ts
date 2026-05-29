import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { globSync } from 'glob';
import {
  ConfigFile,
  ConfigFormat,
  DriftReport,
  EnvironmentName,
  ImportResult,
  DiffDetail,
  QueryOptions,
  ChangeRecord,
  DefaultValue,
} from './types';
import { store } from './store';
import { diffEngine } from './diffEngine';
import { masker } from './sensitiveMasker';
import { interpreter } from './diffInterpreter';

export class DriftCheckerService {
  importConfig(
    filePath: string,
    environment: EnvironmentName,
    format?: ConfigFormat
  ): ImportResult {
    const result: ImportResult = {
      success: false,
      importedFiles: [],
      errors: [],
      warnings: [],
      detectedSecrets: [],
    };

    try {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        result.errors.push(`文件不存在: ${resolvedPath}`);
        return result;
      }

      const fileFormat = format || this.detectFormat(resolvedPath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const parsedContent = this.parseContent(content, fileFormat, resolvedPath);

      const maskResult = masker.mask(parsedContent);
      result.detectedSecrets = maskResult.detectedSecrets.map(s => s.key);

      if (result.detectedSecrets.length > 0) {
        result.warnings.push(
          `检测到 ${result.detectedSecrets.length} 个明文密钥，请及时处理: ${result.detectedSecrets.join(', ')}`
        );
      }

      const checksum = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      const configFile: ConfigFile = {
        path: resolvedPath,
        format: fileFormat,
        environment,
        content: parsedContent,
        importedAt: new Date().toISOString(),
        checksum,
      };

      store.addConfig(configFile);
      result.importedFiles.push(resolvedPath);
      result.success = true;

      return result;
    } catch (error) {
      result.errors.push(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  importDefaults(filePath: string): ImportResult {
    const result: ImportResult = {
      success: false,
      importedFiles: [],
      errors: [],
      warnings: [],
      detectedSecrets: [],
    };

    try {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        result.errors.push(`文件不存在: ${resolvedPath}`);
        return result;
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const defaults = JSON.parse(content) as DefaultValue[];

      for (const def of defaults) {
        store.addDefault(def);
      }

      result.importedFiles.push(resolvedPath);
      result.success = true;
      return result;
    } catch (error) {
      result.errors.push(`导入默认值失败: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  importChanges(filePath: string): ImportResult {
    const result: ImportResult = {
      success: false,
      importedFiles: [],
      errors: [],
      warnings: [],
      detectedSecrets: [],
    };

    try {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) {
        result.errors.push(`文件不存在: ${resolvedPath}`);
        return result;
      }

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const changes = JSON.parse(content) as ChangeRecord[];

      for (const change of changes) {
        store.addChange(change);
      }

      result.importedFiles.push(resolvedPath);
      result.success = true;
      return result;
    } catch (error) {
      result.errors.push(`导入变更记录失败: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  importDirectory(
    dirPath: string,
    pattern: string = '**/*.{json,yaml,yml,env}',
    envExtractor?: (filename: string) => EnvironmentName
  ): ImportResult {
    const result: ImportResult = {
      success: true,
      importedFiles: [],
      errors: [],
      warnings: [],
      detectedSecrets: [],
    };

    try {
      const resolvedDir = path.resolve(dirPath);
      if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
        result.errors.push(`目录不存在: ${resolvedDir}`);
        result.success = false;
        return result;
      }

      const files = globSync(pattern, { cwd: resolvedDir, absolute: true });

      if (files.length === 0) {
        result.warnings.push(`在 ${resolvedDir} 中未找到匹配的配置文件`);
        return result;
      }

      for (const file of files) {
        let environment: EnvironmentName;
        if (envExtractor) {
          environment = envExtractor(file);
        } else {
          const basename = path.basename(file, path.extname(file));
          environment = basename;
        }

        const fileResult = this.importConfig(file, environment);
        result.importedFiles.push(...fileResult.importedFiles);
        result.errors.push(...fileResult.errors);
        result.warnings.push(...fileResult.warnings);
        result.detectedSecrets.push(...fileResult.detectedSecrets);

        if (!fileResult.success) {
          result.success = false;
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`批量导入失败: ${error instanceof Error ? error.message : String(error)}`);
      result.success = false;
      return result;
    }
  }

  checkDrift(
    baselineEnv: EnvironmentName,
    targetEnvs?: EnvironmentName[],
    options: { ignoreArrayOrder?: boolean } = {}
  ): DriftReport {
    const baselineConfig = store.getConfigByEnvironment(baselineEnv);
    if (!baselineConfig) {
      throw new Error(`未找到基线环境 ${baselineEnv} 的配置`);
    }

    const allEnvs = store.getEnvironments();
    const targets = targetEnvs || allEnvs.filter(e => e !== baselineEnv);

    if (targets.length === 0) {
      throw new Error('没有可比较的目标环境');
    }

    const allDiffs: DiffDetail[] = [];
    const maskedContent: Record<string, unknown> = {};

    for (const targetEnv of targets) {
      const targetConfig = store.getConfigByEnvironment(targetEnv);
      if (!targetConfig) {
        continue;
      }

      const baselineMasked = masker.mask(baselineConfig.content);
      const targetMasked = masker.mask(targetConfig.content);

      maskedContent[baselineEnv] = baselineMasked.maskedContent;
      maskedContent[targetEnv] = targetMasked.maskedContent;

      const diffs = diffEngine.compare(
        baselineConfig.content,
        targetConfig.content,
        baselineEnv,
        targetEnv,
        {
          ignoreArrayOrder: options.ignoreArrayOrder,
          detectSecrets: true,
          checkDefaults: true,
          knownChanges: store.getChanges(),
          defaults: store.getDefaults(),
        }
      );

      for (const diff of diffs) {
        diff.environment = targetEnv;
        allDiffs.push(diff);
      }
    }

    const criticalDiffs = allDiffs.filter(d => d.severity === 'critical').length;
    const warningDiffs = allDiffs.filter(d => d.severity === 'warning').length;
    const infoDiffs = allDiffs.filter(d => d.severity === 'info').length;
    const falsePositives = allDiffs.filter(d => d.severity === 'false_positive').length;
    const requiresManualReview = allDiffs.filter(d => d.requiresManualReview).length;

    return {
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      baselineEnvironment: baselineEnv,
      targetEnvironments: targets,
      totalDiffs: allDiffs.length,
      criticalDiffs,
      warningDiffs,
      infoDiffs,
      falsePositives,
      requiresManualReview,
      diffs: allDiffs,
      maskedContent,
    };
  }

  queryDiffs(report: DriftReport, options: QueryOptions = {}): DiffDetail[] {
    let results = [...report.diffs];

    if (options.environment) {
      results = results.filter(d => d.environment === options.environment);
    }

    if (options.severity) {
      results = results.filter(d => d.severity === options.severity);
    }

    if (options.keyPattern) {
      const pattern = new RegExp(options.keyPattern, 'i');
      results = results.filter(d => pattern.test(d.key));
    }

    if (options.requiresReview !== undefined) {
      results = results.filter(d => d.requiresManualReview === options.requiresReview);
    }

    return results;
  }

  getManualReviewItems(report: DriftReport): DiffDetail[] {
    return report.diffs.filter(d => d.requiresManualReview);
  }

  addChangeRecord(
    environment: EnvironmentName,
    key: string,
    oldValue: unknown,
    newValue: unknown,
    author?: string,
    reason?: string,
    ticketId?: string
  ): ChangeRecord {
    const change: ChangeRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      environment,
      key,
      oldValue,
      newValue,
      author,
      reason,
      ticketId,
    };

    store.addChange(change);
    return change;
  }

  getChangeHistory(key?: string, environment?: EnvironmentName): ChangeRecord[] {
    let changes = store.getChanges();

    if (key) {
      changes = changes.filter(c => c.key === key || c.key.endsWith(`.${key}`));
    }

    if (environment) {
      changes = changes.filter(c => c.environment === environment);
    }

    return changes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  interpretDiff(diff: DiffDetail): string {
    return interpreter.formatForDisplay(diff);
  }

  formatReportSummary(report: DriftReport): string {
    let output = `\n📊 配置漂移检查报告\n`;
    output += `生成时间: ${report.generatedAt}\n`;
    output += `报告ID: ${report.id}\n`;
    output += `基线环境: ${report.baselineEnvironment}\n`;
    output += `目标环境: ${report.targetEnvironments.join(', ')}\n\n`;
    output += `📈 统计摘要:\n`;
    output += `  🔴 严重差异: ${report.criticalDiffs}\n`;
    output += `  🟡 警告差异: ${report.warningDiffs}\n`;
    output += `  🔵 信息差异: ${report.infoDiffs}\n`;
    output += `  ⚪ 误报: ${report.falsePositives}\n`;
    output += `  ⚠️  需要人工处理: ${report.requiresManualReview}\n`;
    output += `  📋 总差异数: ${report.totalDiffs}\n`;

    if (report.requiresManualReview > 0) {
      output += `\n⚠️  有 ${report.requiresManualReview} 项需要人工处理，请查看详细报告\n`;
    }

    return output;
  }

  private detectFormat(filePath: string): ConfigFormat {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.env':
        return 'env';
      default:
        return 'json';
    }
  }

  private parseContent(
    content: string,
    format: ConfigFormat,
    filePath: string
  ): Record<string, unknown> {
    switch (format) {
      case 'json':
        return JSON.parse(content) as Record<string, unknown>;
      case 'yaml':
      case 'yml':
        return yaml.load(content) as Record<string, unknown>;
      case 'env':
        return this.parseEnv(content);
      default:
        throw new Error(`不支持的格式: ${format}`);
    }
  }

  private parseEnv(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex > 0) {
        const key = trimmed.substring(0, equalsIndex).trim();
        let value = trimmed.substring(equalsIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        result[key] = value;
      }
    }

    return result;
  }

  clearStore(): void {
    store.clearAll();
  }

  getEnvironments(): EnvironmentName[] {
    return store.getEnvironments();
  }

  getConfigDetails(environment: EnvironmentName): ConfigFile | undefined {
    return store.getConfigByEnvironment(environment);
  }
}

export const driftChecker = new DriftCheckerService();
