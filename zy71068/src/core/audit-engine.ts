import { fileURLToPath } from 'url';
import path from 'path';
import {
  AuditConfig,
  AuditResult,
  FontFile,
  FontReference,
  LicenseEntry,
  Risk,
  EXIT_CODES,
} from '../types.js';
import { FontScanner } from './font-scanner.js';
import { CssParser } from './css-parser.js';
import { LicenseManager, RiskAssessor } from './license-manager.js';
import { ReportGenerator } from './report-generator.js';
import { isDirectory } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = '1.0.0';

export class AuditEngine {
  private config: AuditConfig;
  private fontScanner: FontScanner;
  private cssParser: CssParser;
  private licenseManager: LicenseManager;
  private riskAssessor: RiskAssessor;
  private reportGenerator: ReportGenerator;

  constructor(config: AuditConfig) {
    this.config = config;
    this.fontScanner = new FontScanner(config.projectDir, config.customExtensions);
    this.cssParser = new CssParser(config.projectDir);
    this.licenseManager = new LicenseManager();
    this.riskAssessor = new RiskAssessor();
    this.reportGenerator = new ReportGenerator(config.projectDir, config.outputDir);
  }

  async validateInputs(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.config.projectDir) {
      errors.push('项目目录不能为空');
    } else if (!(await isDirectory(this.config.projectDir))) {
      errors.push(`项目目录不存在或不是目录: ${this.config.projectDir}`);
    }

    if (this.config.licenseFile && this.config.licenseFile.trim() !== '') {
      if (!this.config.licenseFile.endsWith('.json')) {
        errors.push('授权清单必须是 JSON 文件');
      }
    }

    const validFailLevels = ['critical', 'high', 'medium', 'low', 'info', null];
    if (!validFailLevels.includes(this.config.failOnRisk)) {
      errors.push(`无效的失败级别: ${this.config.failOnRisk}`);
    }

    return { valid: errors.length === 0, errors };
  }

  async run(verbose = false): Promise<{ result: AuditResult; exitCode: number }> {
    logger.info('开始字体资产授权审计...');
    logger.section('配置信息');
    logger.info(`项目目录: ${this.config.projectDir}`);
    logger.info(`输出目录: ${this.config.outputDir}`);
    logger.info(`包含远程字体: ${this.config.includeRemote ? '是' : '否'}`);
    if (this.config.failOnRisk) {
      logger.info(`失败级别: ${this.config.failOnRisk}`);
    }

    const fontFiles = await this.fontScanner.scan(verbose);
    const references = await this.cssParser.parseAll(this.config.includeRemote, verbose);
    const { matched: matchedReferences, unmatched: unmatchedReferences } =
      this.cssParser.matchReferencesWithFiles(references, fontFiles);

    let licenseEntries: LicenseEntry[] = [];
    if (this.config.licenseFile) {
      try {
        licenseEntries = await this.licenseManager.loadFromFile(this.config.licenseFile);
      } catch (error) {
        return {
          result: this.buildEmptyResult(),
          exitCode: EXIT_CODES.CONFIG_ERROR,
        };
      }
    }

    const matchedLicenses = new Map<string, LicenseEntry>();
    const missingLicenses: string[] = [];

    for (const font of fontFiles) {
      const license = this.licenseManager.matchFont(font);
      if (license) {
        matchedLicenses.set(font.id, license);
      } else {
        missingLicenses.push(font.familyName);
      }
    }

    const remoteFontsCount = references.filter((r) => r.isRemote).length;
    const versionConflicts = this.fontScanner.detectVersionConflicts(fontFiles);
    const expiredLicenses = licenseEntries.filter(
      (l) => !this.licenseManager.checkLicenseValidity(l).isValid
    );

    const risks = this.riskAssessor.assessAll(
      fontFiles,
      licenseEntries,
      this.licenseManager,
      remoteFontsCount,
      unmatchedReferences
    );

    const risksByLevel = this.riskAssessor.countRisksByLevel(risks);

    const result: AuditResult = {
      metadata: {
        timestamp: new Date(),
        version: VERSION,
        projectDir: this.config.projectDir,
      },
      fonts: {
        files: fontFiles,
        references: matchedReferences,
        unmatchedReferences,
      },
      licenses: {
        entries: licenseEntries,
        matched: matchedLicenses,
        missing: missingLicenses,
      },
      risks,
      summary: {
        totalFontFiles: fontFiles.length,
        totalReferences: references.length,
        totalLicenses: licenseEntries.length,
        missingLicenses: missingLicenses.length,
        risksByLevel,
        remoteFonts: remoteFontsCount,
        versionConflicts: versionConflicts.size,
        expiredLicenses: expiredLicenses.length,
      },
    };

    await this.reportGenerator.generateAll(result);
    this.reportGenerator.generateTerminalSummary(result);

    const shouldFail = this.riskAssessor.shouldFail(risks, this.config.failOnRisk);
    const exitCode = shouldFail ? EXIT_CODES.RISK_DETECTED : EXIT_CODES.SUCCESS;

    logger.empty();
    if (exitCode === EXIT_CODES.SUCCESS) {
      logger.success('审计完成，未发现严重问题');
    } else {
      logger.warn('审计完成，发现需要关注的问题');
    }

    return { result, exitCode };
  }

  private buildEmptyResult(): AuditResult {
    return {
      metadata: {
        timestamp: new Date(),
        version: VERSION,
        projectDir: this.config.projectDir,
      },
      fonts: {
        files: [],
        references: [],
        unmatchedReferences: [],
      },
      licenses: {
        entries: [],
        matched: new Map(),
        missing: [],
      },
      risks: [],
      summary: {
        totalFontFiles: 0,
        totalReferences: 0,
        totalLicenses: 0,
        missingLicenses: 0,
        risksByLevel: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        remoteFonts: 0,
        versionConflicts: 0,
        expiredLicenses: 0,
      },
    };
  }
}

export { VERSION };
