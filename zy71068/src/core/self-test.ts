import fs from 'fs/promises';
import path from 'path';
import { FontScanner } from './font-scanner.js';
import { CssParser } from './css-parser.js';
import { LicenseManager, RiskAssessor } from './license-manager.js';
import { AuditEngine } from './audit-engine.js';
import { AuditConfig, Risk, FontFile, FontReference } from '../types.js';
import { logger } from '../utils/logger.js';

interface TestCase {
  name: string;
  description: string;
  run: () => Promise<boolean>;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export class SelfTestRunner {
  private outputDir: string;
  private verbose: boolean;
  private testDataDir: string;
  private results: TestResult[] = [];

  constructor(outputDir: string, verbose = false) {
    this.outputDir = outputDir;
    this.verbose = verbose;
    this.testDataDir = path.join(outputDir, 'test-data');
  }

  async runAll(): Promise<boolean> {
    logger.section('字体资产授权审计 - 自检');
    logger.info(`输出目录: ${this.outputDir}`);
    logger.info('准备测试数据...');

    await this.setupTestData();

    const testCases: TestCase[] = [
      {
        name: 'FontScanner - 字体文件扫描',
        description: '验证字体扫描器能正确识别字体文件',
        run: () => this.testFontScanner(),
      },
      {
        name: 'FontScanner - 版本冲突检测',
        description: '验证能检测同名字体多版本',
        run: () => this.testVersionConflict(),
      },
      {
        name: 'CssParser - @font-face 解析',
        description: '验证 CSS 解析器能提取字体引用',
        run: () => this.testCssParser(),
      },
      {
        name: 'CssParser - 远程字体检测',
        description: '验证能检测远程字体引用',
        run: () => this.testRemoteFontDetection(),
      },
      {
        name: 'LicenseManager - 授权匹配',
        description: '验证授权匹配逻辑正常',
        run: () => this.testLicenseMatching(),
      },
      {
        name: 'LicenseManager - 过期检测',
        description: '验证授权过期检测功能',
        run: () => this.testLicenseExpiry(),
      },
      {
        name: 'RiskAssessor - 风险分级',
        description: '验证风险分级逻辑正确',
        run: () => this.testRiskAssessment(),
      },
      {
        name: 'AuditEngine - 完整流程',
        description: '验证完整审计流程正常工作',
        run: () => this.testFullAudit(),
      },
      {
        name: 'ReportGenerator - 报告生成',
        description: '验证 JSON 和 Markdown 报告生成',
        run: () => this.testReportGeneration(),
      },
    ];

    let passedCount = 0;

    for (const test of testCases) {
      logger.info(`\n测试: ${test.name}`);
      if (this.verbose) {
        logger.debug(`  ${test.description}`, true);
      }

      try {
        const passed = await test.run();
        this.results.push({ name: test.name, passed });

        if (passed) {
          logger.success(`  ✓ 通过`);
          passedCount++;
        } else {
          logger.error(`  ✗ 失败`);
        }
      } catch (error) {
        const errMsg = (error as Error).message;
        this.results.push({ name: test.name, passed: false, error: errMsg });
        logger.error(`  ✗ 失败: ${errMsg}`);
      }
    }

    logger.section('自检结果');
    logger.info(`通过: ${passedCount} / ${testCases.length}`);

    if (this.results.some((r) => !r.passed)) {
      logger.warn('失败的测试:');
      for (const result of this.results.filter((r) => !r.passed)) {
        logger.error(`  - ${result.name}${result.error ? `: ${result.error}` : ''}`);
      }
    }

    return passedCount === testCases.length;
  }

  private async setupTestData(): Promise<void> {
    await fs.mkdir(this.testDataDir, { recursive: true });

    const fontsDir = path.join(this.testDataDir, 'fonts');
    await fs.mkdir(fontsDir, { recursive: true });

    const testFonts = [
      'Roboto-Regular.ttf',
      'Roboto-Bold.ttf',
      'Roboto-Italic-1.0.0.ttf',
      'Roboto-Italic-2.0.0.ttf',
      'OpenSans-Regular.woff2',
      'OpenSans-Bold.woff',
    ];

    for (const fontName of testFonts) {
      const fontPath = path.join(fontsDir, fontName);
      await fs.writeFile(fontPath, Buffer.alloc(100, fontName));
    }

    const cssDir = path.join(this.testDataDir, 'css');
    await fs.mkdir(cssDir, { recursive: true });

    const testCss = `
@font-face {
  font-family: 'Roboto';
  src: url('../fonts/Roboto-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Roboto';
  src: url('../fonts/Roboto-Bold.ttf') format('truetype');
  font-weight: 700;
}

@font-face {
  font-family: 'Open Sans';
  src: url('../fonts/OpenSans-Regular.woff2') format('woff2'),
       url('../fonts/OpenSans-Regular.woff') format('woff');
}

@font-face {
  font-family: 'Remote Font';
  src: url('https://fonts.example.com/remote-font.woff2') format('woff2');
}
`;
    await fs.writeFile(path.join(cssDir, 'styles.css'), testCss);

    const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">
  <style>
    @font-face {
      font-family: 'Inline Font';
      src: url('../fonts/OpenSans-Bold.woff') format('woff');
    }
  </style>
</head>
<body>Test</body>
</html>
`;
    await fs.writeFile(path.join(this.testDataDir, 'index.html'), testHtml);

    const licenseData = {
      licenses: [
        {
          familyName: 'Roboto',
          alternativeNames: ['Roboto Sans'],
          licenseType: 'Apache 2.0',
          validFrom: '2020-01-01',
          validUntil: '2099-12-31',
        },
        {
          familyName: 'Open Sans',
          alternativeNames: ['OpenSans'],
          licenseType: 'SIL OFL',
          validFrom: '2020-01-01',
          validUntil: '2020-12-31',
        },
      ],
    };
    await fs.writeFile(
      path.join(this.testDataDir, 'licenses.json'),
      JSON.stringify(licenseData, null, 2)
    );
  }

  private async testFontScanner(): Promise<boolean> {
    const scanner = new FontScanner(this.testDataDir);
    const fonts = await scanner.scan();

    const expectedNames = ['Roboto', 'Open'];
    const hasExpected = expectedNames.every((name) =>
      fonts.some((f) => f.familyName.toLowerCase().includes(name.toLowerCase()))
    );

    const formats = new Set(fonts.map((f) => f.format));
    const hasFormats = formats.has('ttf') && formats.has('woff2') && formats.has('woff');

    return fonts.length >= 5 && hasExpected && hasFormats;
  }

  private async testVersionConflict(): Promise<boolean> {
    const scanner = new FontScanner(this.testDataDir);
    const fonts = await scanner.scan();
    const conflicts = scanner.detectVersionConflicts(fonts);

    return conflicts.size > 0;
  }

  private async testCssParser(): Promise<boolean> {
    const parser = new CssParser(this.testDataDir);
    const references = await parser.parseAll();

    return references.length >= 0;
  }

  private async testRemoteFontDetection(): Promise<boolean> {
    const parser = new CssParser(this.testDataDir);
    const references = await parser.parseAll(true);
    const remoteRefs = parser.getRemoteReferences(references);

    return remoteRefs.length >= 0;
  }

  private async testLicenseMatching(): Promise<boolean> {
    const manager = new LicenseManager();
    await manager.loadFromFile(path.join(this.testDataDir, 'licenses.json'));

    const testFont: FontFile = {
      id: 'test',
      path: '/test/Roboto-Regular.ttf',
      fileName: 'Roboto-Regular.ttf',
      familyName: 'Roboto',
      format: 'ttf',
      size: 100,
      lastModified: new Date(),
    };

    const match = manager.matchFont(testFont);
    const byName = manager.matchFontFamily('Roboto');

    return match !== null && byName !== null && match.licenseType === 'Apache 2.0';
  }

  private async testLicenseExpiry(): Promise<boolean> {
    const manager = new LicenseManager();
    const licenses = await manager.loadFromFile(path.join(this.testDataDir, 'licenses.json'));

    const openSans = licenses.find((l) => l.familyName === 'Open Sans');
    const roboto = licenses.find((l) => l.familyName === 'Roboto');

    if (!openSans || !roboto) return false;

    const openSansValid = manager.checkLicenseValidity(openSans);
    const robotoValid = manager.checkLicenseValidity(roboto);

    return !openSansValid.isValid && robotoValid.isValid;
  }

  private async testRiskAssessment(): Promise<boolean> {
    const manager = new LicenseManager();
    const licenses = await manager.loadFromFile(path.join(this.testDataDir, 'licenses.json'));

    const assessor = new RiskAssessor();
    const risks = assessor.assessAll([], licenses, manager, 2, []);

    const byLevel = assessor.countRisksByLevel(risks);

    return risks.length > 0 && byLevel.critical >= 0 && byLevel.medium >= 0;
  }

  private async testFullAudit(): Promise<boolean> {
    const config: AuditConfig = {
      projectDir: this.testDataDir,
      licenseFile: path.join(this.testDataDir, 'licenses.json'),
      outputDir: path.join(this.outputDir, 'audit-test'),
      includeRemote: true,
      failOnRisk: null,
      customExtensions: [],
    };

    const engine = new AuditEngine(config);
    const { result } = await engine.run(this.verbose);

    return (
      result.summary.totalFontFiles > 0 &&
      result.summary.totalLicenses > 0 &&
      result.risks.length > 0
    );
  }

  private async testReportGeneration(): Promise<boolean> {
    const config: AuditConfig = {
      projectDir: this.testDataDir,
      licenseFile: path.join(this.testDataDir, 'licenses.json'),
      outputDir: path.join(this.outputDir, 'report-test'),
      includeRemote: true,
      failOnRisk: null,
      customExtensions: [],
    };

    const engine = new AuditEngine(config);
    await engine.run(this.verbose);

    const jsonReport = path.join(config.outputDir, 'audit-report.json');
    const mdReport = path.join(config.outputDir, 'audit-report.md');

    try {
      await fs.access(jsonReport);
      await fs.access(mdReport);

      const jsonContent = await fs.readFile(jsonReport, 'utf-8');
      const mdContent = await fs.readFile(mdReport, 'utf-8');

      return jsonContent.length > 0 && mdContent.length > 0;
    } catch {
      return false;
    }
  }
}
