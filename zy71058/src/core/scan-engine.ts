import * as path from 'path';
import { ScanOptions, ScanResult, Finding, SecretRule, ExceptionItem } from '../types';
import { parseYamlFile, extractAllValues, findYamlFiles } from '../utils/yaml-parser';
import { renderTemplateDir, resolveTemplateReferences, RenderedTemplate } from '../utils/template-renderer';
import { scanContent, scanValueNodes, ScanContext } from './scanner';
import { applyExceptions, validateException } from './exception-manager';

export interface ScanEngineConfig {
  options: ScanOptions;
  rules: SecretRule[];
  exceptions: ExceptionItem[];
}

export class ScanEngine {
  private config: ScanEngineConfig;
  private findings: Finding[] = [];
  private errors: string[] = [];
  private warnings: string[] = [];
  private scannedFiles: Set<string> = new Set();

  constructor(config: ScanEngineConfig) {
    this.config = config;
    
    for (const ex of config.exceptions) {
      const validationErrors = validateException(ex);
      for (const err of validationErrors) {
        this.warnings.push(`例外配置警告: ${err}`);
      }
    }
  }

  async scan(): Promise<ScanResult> {
    this.findings = [];
    this.errors = [];
    this.warnings = [];
    this.scannedFiles = new Set();

    try {
      await this.scanValuesFile();
      if (this.config.options.templateDir) {
        await this.scanTemplateDir();
      }
      this.applyExceptionsToFindings();
    } catch (e) {
      this.errors.push(`扫描失败: ${(e as Error).message}`);
    }

    return this.buildResult();
  }

  private async scanValuesFile(): Promise<void> {
    const { valuesPath } = this.config.options;
    
    try {
      const parsed = parseYamlFile(valuesPath);
      this.scannedFiles.add(valuesPath);

      const context: ScanContext = {
        filePath: valuesPath,
        rules: this.config.rules,
        verbose: this.config.options.verbose
      };

      const contentFindings = scanContent(parsed.content, context);
      this.findings.push(...contentFindings);

      const valueNodes = extractAllValues(parsed.data);
      const valueFindings = scanValueNodes(valueNodes, context);
      this.findings.push(...valueFindings);

    } catch (e) {
      this.errors.push(`解析 values 文件失败: ${(e as Error).message}`);
    }
  }

  private async scanTemplateDir(): Promise<void> {
    const { templateDir, valuesPath } = this.config.options;
    
    try {
      const valuesParsed = parseYamlFile(valuesPath);
      const values = valuesParsed.data as Record<string, unknown>;

      const renderedTemplates = renderTemplateDir(templateDir!, values);
      
      for (const rendered of renderedTemplates) {
        this.scanRenderedTemplate(rendered);
      }

      const yamlFiles = findYamlFiles(templateDir!);
      for (const file of yamlFiles) {
        if (!this.scannedFiles.has(file)) {
          this.scannedFiles.add(file);
          const parsed = parseYamlFile(file);
          
          const resolvedContent = resolveTemplateReferences(parsed.content, values);
          
          const context: ScanContext = {
            filePath: file,
            rules: this.config.rules,
            verbose: this.config.options.verbose
          };
          
          const findings = scanContent(resolvedContent, context);
          this.findings.push(...findings);
        }
      }

    } catch (e) {
      this.errors.push(`扫描模板目录失败: ${(e as Error).message}`);
    }
  }

  private scanRenderedTemplate(rendered: RenderedTemplate): void {
    this.scannedFiles.add(rendered.filePath);
    
    const context: ScanContext = {
      filePath: rendered.filePath,
      rules: this.config.rules,
      verbose: this.config.options.verbose
    };

    if (rendered.renderedContent !== rendered.originalContent) {
      const renderedFindings = scanContent(rendered.renderedContent, context);
      
      for (const finding of renderedFindings) {
        finding.evidence = `[模板渲染后] ${finding.evidence}`;
        this.findings.push(finding);
      }
    }

    const originalFindings = scanContent(rendered.originalContent, context);
    this.findings.push(...originalFindings);
  }

  private applyExceptionsToFindings(): void {
    if (this.config.exceptions.length === 0) {
      return;
    }

    const result = applyExceptions(
      this.findings,
      this.config.exceptions,
      this.config.options.environment
    );

    this.findings = result.findings;
  }

  private dedupeFindings(): Finding[] {
    const seen = new Set<string>();
    const unique: Finding[] = [];

    for (const finding of this.findings) {
      const key = `${finding.ruleId}:${finding.location.file}:${finding.location.path}:${finding.matchedValue.substring(0, 30)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(finding);
      }
    }

    return unique;
  }

  private buildResult(): ScanResult {
    const uniqueFindings = this.dedupeFindings();
    
    const bySeverity = {
      critical: uniqueFindings.filter(f => f.severity === 'critical' && !f.excepted).length,
      high: uniqueFindings.filter(f => f.severity === 'high' && !f.excepted).length,
      medium: uniqueFindings.filter(f => f.severity === 'medium' && !f.excepted).length,
      low: uniqueFindings.filter(f => f.severity === 'low' && !f.excepted).length
    };

    const excepted = uniqueFindings.filter(f => f.excepted).length;
    const expiredExceptions = uniqueFindings.filter(f => f.exceptionExpired).length;

    return {
      metadata: {
        scannedAt: new Date().toISOString(),
        environment: this.config.options.environment,
        valuesFile: this.config.options.valuesPath,
        templateDir: this.config.options.templateDir,
        rulesFile: this.config.options.rulesPath,
        exceptionsFile: this.config.options.exceptionsPath
      },
      summary: {
        totalFiles: this.scannedFiles.size,
        totalFindings: uniqueFindings.filter(f => !f.excepted).length,
        bySeverity,
        excepted,
        expiredExceptions
      },
      findings: uniqueFindings,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}
