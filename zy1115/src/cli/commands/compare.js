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

const compareCommand = new Command('compare')
  .description('比较两个特定数据源之间的差异')
  .argument('<source1>', '第一个数据源类型: openapi, mock, fixture, captured')
  .argument('<source2>', '第二个数据源类型: openapi, mock, fixture, captured')
  .option('-o, --openapi <path>', 'OpenAPI 文档路径 (json 或 yaml)')
  .option('-m, --mock <dir>', 'Mock 数据目录')
  .option('-f, --fixture <path>', 'Fixture JSON 文件路径')
  .option('-c, --captured <path>', 'Captured responses JSONL 文件路径')
  .option('--ignore <path>', '忽略规则 JSON 文件路径')
  .option('--endpoint <endpoint>', '指定要比较的端点 (格式: METHOD /path)')
  .action(async (source1, source2, options) => {
    try {
      const validSources = ['openapi', 'mock', 'fixture', 'captured'];
      if (!validSources.includes(source1) || !validSources.includes(source2)) {
        throw new Error(`数据源类型必须是以下之一: ${validSources.join(', ')}`);
      }

      console.log(chalk.blue(`⚖️  比较 ${source1} 和 ${source2}...\n`));

      const ignoreRules = options.ignore ? new IgnoreRules(options.ignore) : null;

      const dataSources = {};

      const readers = {
        openapi: { reader: new OpenAPIReader(), path: options.openapi, name: 'OpenAPI' },
        mock: { reader: new MockReader(), path: options.mock, name: 'Mock' },
        fixture: { reader: new FixtureReader(), path: options.fixture, name: 'Fixture' },
        captured: { reader: new CapturedResponseReader(), path: options.captured, name: 'Captured' }
      };

      const requiredSources = [source1, source2];
      for (const sourceType of requiredSources) {
        const sourceInfo = readers[sourceType];
        if (!sourceInfo.path) {
          throw new Error(`请提供 --${sourceType === 'captured' ? 'captured' : sourceType} 参数`);
        }
        console.log(chalk.gray(`  读取 ${sourceInfo.name}...`));
        dataSources[sourceType] = await sourceInfo.reader.read(sourceInfo.path);
        console.log(chalk.green(`  ✓ ${sourceInfo.name}: ${dataSources[sourceType].endpoints.length} 个端点`));
      }

      console.log('\n' + chalk.blue('开始比较...'));
      const comparator = new SchemaComparator(ignoreRules);
      
      let comparisonResult;
      if (options.endpoint) {
        const [method, path] = options.endpoint.split(' ');
        if (!method || !path) {
          throw new Error('端点格式错误，应为: METHOD /path (例如: GET /api/users)');
        }
        comparisonResult = comparator.compareEndpoint(
          dataSources, 
          source1, 
          source2, 
          method.toUpperCase(), 
          path
        );
      } else {
        comparisonResult = comparator.compareTwo(dataSources, source1, source2);
      }

      console.log(chalk.gray('  ✓ 比较完成'));

      const reporter = new ConsoleReporter();
      reporter.report(comparisonResult, options);

      if (comparisonResult.issues.length > 0) {
        process.exit(1);
      }

      return comparisonResult;
    } catch (error) {
      errorHandler.handle(error);
      process.exit(1);
    }
  });

module.exports = compareCommand;
