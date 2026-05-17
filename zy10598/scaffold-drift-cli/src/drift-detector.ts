import { TemplateLoader } from './template-loader';
import { FileComparator } from './file-comparator';
import { ConfigComparator } from './config-comparator';
import { RepairPreviewGenerator } from './repair-preview-generator';
import { DriftReport, CliOptions } from './types';

export class DriftDetector {
  private templateLoader: TemplateLoader;
  private fileComparator: FileComparator;
  private configComparator: ConfigComparator;
  private repairPreviewGenerator: RepairPreviewGenerator;

  constructor() {
    this.templateLoader = new TemplateLoader();
    this.fileComparator = new FileComparator();
    this.configComparator = new ConfigComparator();
    this.repairPreviewGenerator = new RepairPreviewGenerator();
  }

  async detect(options: CliOptions): Promise<DriftReport> {
    const timestamp = new Date().toISOString();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const manifest = await this.templateLoader.load(options.template);

    const fileResults = await Promise.all(
      manifest.files.map(async fileEntry => {
        const templateContent = await this.templateLoader.getTemplateFileContent(
          options.template,
          fileEntry.path
        );
        return this.fileComparator.compare(
          options.repo,
          options.template,
          fileEntry,
          templateContent
        );
      })
    );

    const configResults = await Promise.all(
      manifest.configs.map(async configEntry => {
        const templateContent = await this.templateLoader.getTemplateFileContent(
          options.template,
          configEntry.path
        );
        return this.configComparator.compare(
          options.repo,
          options.template,
          configEntry,
          templateContent
        );
      })
    );

    const allDrifts = [
      ...fileResults.flatMap(r => r.drifts),
      ...configResults.flatMap(r => r.drifts)
    ];

    const normalItems = allDrifts.filter(d => d.status === 'normal').length;
    const riskItems = allDrifts.filter(d => d.status === 'risk').length;
    const unknownItems = allDrifts.filter(d => d.status === 'unknown').length;

    const criticalDrifts = allDrifts.filter(d => d.severity === 'critical').length;
    const highDrifts = allDrifts.filter(d => d.severity === 'high').length;
    const mediumDrifts = allDrifts.filter(d => d.severity === 'medium').length;
    const lowDrifts = allDrifts.filter(d => d.severity === 'low').length;

    const repairPreviews = options.preview 
      ? this.repairPreviewGenerator.generate(allDrifts)
      : [];

    const report: DriftReport = {
      metadata: {
        timestamp,
        repoPath: options.repo,
        templatePath: options.template,
        templateName: manifest.name,
        templateVersion: manifest.version,
        runId
      },
      summary: {
        totalFiles: manifest.files.length,
        totalConfigs: manifest.configs.length,
        normalItems,
        riskItems,
        unknownItems,
        totalDrifts: allDrifts.length,
        criticalDrifts,
        highDrifts,
        mediumDrifts,
        lowDrifts
      },
      files: fileResults,
      configs: configResults,
      drifts: allDrifts,
      repairPreview: repairPreviews
    };

    return report;
  }
}
