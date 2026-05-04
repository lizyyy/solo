const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const OpenAPIReader = require('../../readers/openapi-reader');
const MockReader = require('../../readers/mock-reader');
const FixtureReader = require('../../readers/fixture-reader');
const CapturedResponseReader = require('../../readers/captured-response-reader');
const { SchemaComparator } = require('../../comparators/schema-comparator');
const ExportReporter = require('../../reporters/export-reporter');
const IgnoreRules = require('../../utils/ignore-rules');
const { errorHandler } = require('../../utils/error-handler');

const exportCommand = new Command('export')
  .description('导出检查报告为指定格式')
  .option('-o, --openapi <path>', 'OpenAPI 文档路径 (json 或 yaml)')
  .option('-m, --mock <dir>', 'Mock 数据目录')
  .option('-f, --fixture <path>', 'Fixture JSON 文件路径')
  .option('-c, --captured <path>', 'Captured responses JSONL 文件路径')
  .option('--ignore <path>', '忽略规则 JSON 文件路径')
  .requiredOption('--format <format>', '导出格式: json, markdown, html')
  .requiredOption('--out <path>', '输出文件路径')
  .action(async (options) => {
    try {
      const validFormats = ['json', 'markdown', 'html'];
      if (!validFormats.includes(options.format)) {
        throw new Error(`格式必须是以下之一: ${validFormats.join(', ')}`);
      }

      console.log(chalk.blue('📤 准备导出报告...\n'));

      const ignoreRules = options.ignore ? new IgnoreRules(options.ignore) : null;

      const dataSources = {};

      if (options.openapi) {
        console.log(chalk.gray('  读取 OpenAPI 文档...'));
        const openapiReader = new OpenAPIReader();
        dataSources.openapi = await openapiReader.read(options.openapi);
        console.log(chalk.green(`  ✓ OpenAPI: ${dataSources.openapi.endpoints.length} 个端点`));
      }

      if (options.mock) {
        console.log(chalk.gray('  读取 Mock 目录...'));
        const mockReader = new MockReader();
        dataSources.mock = await mockReader.read(options.mock);
        console.log(chalk.green(`  ✓ Mock: ${dataSources.mock.endpoints.length} 个端点`));
      }

      if (options.fixture) {
        console.log(chalk.gray('  读取 Fixture 文件...'));
        const fixtureReader = new FixtureReader();
        dataSources.fixture = await fixtureReader.read(options.fixture);
        console.log(chalk.green(`  ✓ Fixture: ${dataSources.fixture.endpoints.length} 个端点`));
      }

      if (options.captured) {
        console.log(chalk.gray('  读取 Captured responses...'));
        const capturedReader = new CapturedResponseReader();
        dataSources.captured = await capturedReader.read(options.captured);
        console.log(chalk.green(`  ✓ Captured: ${dataSources.captured.endpoints.length} 个端点`));
      }

      console.log('\n' + chalk.blue('⚖️  比较 Schema...'));
      const comparator = new SchemaComparator(ignoreRules);
      const comparisonResult = comparator.compareAll(dataSources);
      console.log(chalk.gray('  ✓ 比较完成'));

      const outputDir = path.dirname(options.out);
      if (outputDir !== '.' && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const exportReporter = new ExportReporter();
      
      switch (options.format) {
        case 'json':
          exportReporter.exportJson(comparisonResult, options.out);
          break;
        case 'markdown':
          exportReporter.exportMarkdown(comparisonResult, options.out);
          break;
        case 'html':
          exportReporter.exportHtml(comparisonResult, options.out);
          break;
      }

      console.log(chalk.green(`\n✓ 报告已导出到: ${options.out}`));

      if (comparisonResult.issues.length > 0) {
        console.log(chalk.yellow(`\n⚠ 报告包含 ${comparisonResult.issues.length} 个问题`));
      }

      return comparisonResult;
    } catch (error) {
      errorHandler.handle(error);
      process.exit(1);
    }
  });

module.exports = exportCommand;
