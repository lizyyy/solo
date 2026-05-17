const { LogParser } = require('./log-parser');
const { SamplingEngine } = require('./sampling-engine');
const { ReportGenerator } = require('./report-generator');
const cliProgress = require('cli-progress');

class CDNSampler {
  constructor(options = {}) {
    this.options = options;
    this.parser = new LogParser({
      format: options.format || 'nginx',
      fields: options.fields,
      pattern: options.pattern
    });
    this.sampler = new SamplingEngine({
      sampleSize: options.sampleSize || 1000,
      strataFields: options.strataFields || ['status', 'region', 'resourceType'],
      dedupeFields: options.dedupeFields,
      minPerStratum: options.minPerStratum,
      maxPerStratum: options.maxPerStratum,
      seed: options.seed
    });
    this.reporter = new ReportGenerator({
      outputDir: options.outputDir,
      baseName: options.outputName,
      includeRawLines: options.includeRaw !== false
    });

    if (options.statusCodes) {
      this.sampler.filterByStatusCodes(options.statusCodes);
    }
    if (options.regions) {
      this.sampler.filterByRegions(options.regions);
    }
    if (options.resourceTypes) {
      this.sampler.filterByResourceTypes(options.resourceTypes);
    }

    this.invalidRecords = [];
    this.duplicates = [];
    this.filtered = 0;
  }

  async processFile(filePath) {
    const showProgress = this.options.progress !== false;
    let progressBar = null;
    let estimatedLines = 0;

    if (showProgress) {
      estimatedLines = await this.parser.estimateLineCount(filePath);
      progressBar = new cliProgress.SingleBar({
        format: '处理中 |{bar}| {percentage}% | {value}/{total} 行',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      progressBar.start(estimatedLines, 0);
    }

    for await (const record of this.parser.streamParse(filePath)) {
      if (progressBar) {
        progressBar.increment();
      }

      if (!record.valid) {
        this.invalidRecords.push(record);
        continue;
      }

      if (this.sampler.shouldFilter(record)) {
        this.filtered++;
        continue;
      }

      const result = this.sampler.processRecord(record);
      
      if (result.action === 'duplicate') {
        this.duplicates.push(result);
      }
    }

    if (progressBar) {
      progressBar.stop();
    }

    return this.buildResult(filePath);
  }

  buildResult(sourceFile) {
    const summary = this.sampler.getSummary();
    const samples = this.sampler.getSamples();

    return {
      metadata: {
        sourceFile,
        options: {
          format: this.options.format,
          sampleSize: this.options.sampleSize,
          statusCodes: this.options.statusCodes,
          regions: this.options.regions,
          resourceTypes: this.options.resourceTypes
        }
      },
      summary: {
        ...summary,
        filtered: this.filtered,
        invalid: this.invalidRecords.length,
        duplicates: this.duplicates.length
      },
      samples,
      invalidRecords: this.invalidRecords,
      duplicates: this.duplicates
    };
  }

  async generateReports(result) {
    if (this.options.terminal !== false) {
      this.reporter.generateTerminalSummary(result);
    }

    const paths = await this.reporter.writeReports(result);

    if (this.options.terminal !== false) {
      const chalk = require('chalk');
      console.log(chalk.bold('📄 报告文件已生成:'));
      console.log(`  JSON: ${chalk.cyan(paths.jsonPath)}`);
      console.log(`  Markdown: ${chalk.cyan(paths.mdPath)}\n`);
    }

    return paths;
  }
}

async function run(options) {
  const sampler = new CDNSampler(options);
  const result = await sampler.processFile(options.input);
  const paths = await sampler.generateReports(result);
  return { result, paths };
}

module.exports = {
  CDNSampler,
  LogParser,
  SamplingEngine,
  ReportGenerator,
  run
};
