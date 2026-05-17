import path from 'path';
import { FlagLoader } from './flag-loader';
import { CodeScanner } from './code-scanner';
import { Reporter } from '../reporter/reporter';
import { ScanOptions, ScanResult, CodeReference, DeadBranch } from '../types';

export class FeatureFlagScanner {
  private flagLoader: FlagLoader;
  private codeScanner: CodeScanner;
  private reporter: Reporter;

  constructor() {
    this.flagLoader = new FlagLoader();
    this.codeScanner = new CodeScanner();
    this.reporter = new Reporter();
  }

  public async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = new Date().toISOString();
    const allBadSamples: any[] = [];

    const { flags, badSamples: flagBadSamples } = await this.flagLoader.loadFlags(
      options.flagsFile,
      options.flags
    );
    allBadSamples.push(...flagBadSamples);

    if (flags.length === 0) {
      throw new Error('未找到有效的 Feature Flag，请检查开关清单文件格式');
    }

    const {
      references,
      deadBranches,
      badSamples: codeBadSamples,
      filesScanned
    } = await this.codeScanner.scanDirectory(
      options.sourceDir,
      flags,
      options.filePatterns,
      options.excludePatterns
    );
    allBadSamples.push(...codeBadSamples);

    const referencesByFile = this.groupBy(references, 'filePath');
    const referencesByFlag = this.groupBy(references, 'flagName');
    const deadBranchesByFile = this.groupBy(deadBranches, 'filePath');
    const deadBranchesByFlag = this.groupBy(deadBranches, 'flagName');

    const flagsWithDeadBranches = new Set(deadBranches.map(b => b.flagName)).size;

    const endTime = new Date().toISOString();

    const result: ScanResult = {
      flags: {
        total: flags.length,
        analyzed: flags.length,
        withDeadBranches: flagsWithDeadBranches,
        list: flags
      },
      references: {
        total: references.length,
        byFile: referencesByFile,
        byFlag: referencesByFlag,
        list: references
      },
      deadBranches: {
        total: deadBranches.length,
        byFile: deadBranchesByFile,
        byFlag: deadBranchesByFlag,
        list: deadBranches
      },
      badSamples: allBadSamples,
      scanInfo: {
        startTime,
        endTime,
        sourceDir: options.sourceDir,
        filesScanned,
        flagsSource: options.flagsFile || 'inline'
      }
    };

    this.reporter.generateConsoleSummary(result);

    const outputDir = options.outputDir || './reports';

    await this.reporter.generateJsonReport(
      result,
      path.join(outputDir, 'scan-result.json')
    );

    if (options.generateMarkdown !== false) {
      await this.reporter.generateMarkdownReport(
        result,
        path.join(outputDir, 'scan-report.md')
      );
    }

    if (options.generateHtml) {
      await this.reporter.generateHtmlReport(
        result,
        path.join(outputDir, 'scan-report.html')
      );
    }

    return result;
  }

  private groupBy<T>(items: T[], key: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const k = String(item[key]);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
