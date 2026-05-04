const { Command } = require('commander');
const chalk = require('chalk');
const OpenAPIReader = require('../../readers/openapi-reader');
const MockReader = require('../../readers/mock-reader');
const FixtureReader = require('../../readers/fixture-reader');
const CapturedResponseReader = require('../../readers/captured-response-reader');
const { SchemaComparator } = require('../../comparators/schema-comparator');
const ConsoleReporter = require('../../reporters/console-reporter');
const IgnoreRules = require('../../utils/ignore-rules');
const { errorHandler } = require('../../utils/error-handler');

const checkCommand = new Command('check')
  .description('全面检查所有数据源之间的 schema 漂移问题')
  .option('-o, --openapi <path>', 'OpenAPI 文档路径 (json 或 yaml)')
  .option('-m, --mock <dir>', 'Mock 数据目录')
  .option('-f, --fixture <path>', 'Fixture JSON 文件路径')
  .option('-c, --captured <path>', 'Captured responses JSONL 文件路径')
  .option('--ignore <path>', '忽略规则 JSON 文件路径')
  .option('--output <format>', '输出格式: console, json, markdown, html', 'console')
  .option('--out-file <path>', '输出文件路径 (适用于非 console 格式)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 开始检查 Schema 漂移...\n'));

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

      console.log('\n' + chalk.blue('⚖️  开始比较 Schema...'));
      const comparator = new SchemaComparator(ignoreRules);
      const comparisonResult = comparator.compareAll(dataSources);

      console.log(chalk.gray('  ✓ 比较完成'));

      const reporter = new ConsoleReporter();
      reporter.report(comparisonResult, options);

      if (options.output !== 'console' && options.outFile) {
        const fs = require('fs');
        const path = require('path');
        const ExportReporter = require('../../reporters/export-reporter');
        const exportReporter = new ExportReporter();
        
        const outputDir = path.dirname(options.outFile);
        if (outputDir !== '.' && !fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        switch (options.output) {
          case 'json':
            exportReporter.exportJson(comparisonResult, options.outFile);
            break;
          case 'markdown':
            exportReporter.exportMarkdown(comparisonResult, options.outFile);
            break;
          case 'html':
            exportReporter.exportHtml(comparisonResult, options.outFile);
            break;
        }
        console.log(chalk.green(`\n✓ 报告已导出到: ${options.outFile}`));
      }

      if (comparisonResult.issues.length > 0) {
        process.exit(1);
      }

      return comparisonResult;
    } catch (error) {
      errorHandler.handle(error);
      process.exit(1);
    }
  });

module.exports = checkCommand;
