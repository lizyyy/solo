const { Command } = require('commander');
const chalk = require('chalk');
const OpenAPIReader = require('../../readers/openapi-reader');
const MockReader = require('../../readers/mock-reader');
const FixtureReader = require('../../readers/fixture-reader');
const CapturedResponseReader = require('../../readers/captured-response-reader');
const { errorHandler } = require('../../utils/error-handler');

const scanCommand = new Command('scan')
  .description('扫描并统计所有数据源中的 API 端点和字段')
  .option('-o, --openapi <path>', 'OpenAPI 文档路径 (json 或 yaml)')
  .option('-m, --mock <dir>', 'Mock 数据目录')
  .option('-f, --fixture <path>', 'Fixture JSON 文件路径')
  .option('-c, --captured <path>', 'Captured responses JSONL 文件路径')
  .option('--ignore <path>', '忽略规则 JSON 文件路径')
  .action(async (options) => {
    try {
      const results = {
        openapi: null,
        mock: null,
        fixture: null,
        captured: null,
        endpoints: [],
        fields: []
      };

      console.log(chalk.blue('📋 开始扫描数据源...\n'));

      if (options.openapi) {
        console.log(chalk.gray('  读取 OpenAPI 文档...'));
        const openapiReader = new OpenAPIReader();
        results.openapi = await openapiReader.read(options.openapi);
        console.log(chalk.green(`  ✓ OpenAPI: 发现 ${results.openapi.endpoints.length} 个端点`));
      }

      if (options.mock) {
        console.log(chalk.gray('  读取 Mock 目录...'));
        const mockReader = new MockReader();
        results.mock = await mockReader.read(options.mock);
        console.log(chalk.green(`  ✓ Mock: 发现 ${results.mock.endpoints.length} 个端点`));
      }

      if (options.fixture) {
        console.log(chalk.gray('  读取 Fixture 文件...'));
        const fixtureReader = new FixtureReader();
        results.fixture = await fixtureReader.read(options.fixture);
        console.log(chalk.green(`  ✓ Fixture: 发现 ${results.fixture.endpoints.length} 个端点`));
      }

      if (options.captured) {
        console.log(chalk.gray('  读取 Captured responses...'));
        const capturedReader = new CapturedResponseReader();
        results.captured = await capturedReader.read(options.captured);
        console.log(chalk.green(`  ✓ Captured: 发现 ${results.captured.endpoints.length} 个端点`));
      }

      console.log('\n' + chalk.blue('📊 扫描结果汇总:'));
      
      const allEndpoints = new Set();
      if (results.openapi) results.openapi.endpoints.forEach(e => allEndpoints.add(`${e.method.toUpperCase()} ${e.path}`));
      if (results.mock) results.mock.endpoints.forEach(e => allEndpoints.add(`${e.method.toUpperCase()} ${e.path}`));
      if (results.fixture) results.fixture.endpoints.forEach(e => allEndpoints.add(`${e.method.toUpperCase()} ${e.path}`));
      if (results.captured) results.captured.endpoints.forEach(e => allEndpoints.add(`${e.method.toUpperCase()} ${e.path}`));

      console.log(`\n  唯一端点总数: ${chalk.yellow(allEndpoints.size)}`);
      
      console.log('\n  按数据源统计:');
      if (results.openapi) console.log(`    OpenAPI: ${results.openapi.endpoints.length} 个端点`);
      if (results.mock) console.log(`    Mock: ${results.mock.endpoints.length} 个端点`);
      if (results.fixture) console.log(`    Fixture: ${results.fixture.endpoints.length} 个端点`);
      if (results.captured) console.log(`    Captured: ${results.captured.endpoints.length} 个端点`);

      console.log('\n' + chalk.gray('使用 ' + chalk.bold('check') + ' 命令进行详细比较'));
      
      return results;
    } catch (error) {
      errorHandler.handle(error);
      process.exit(1);
    }
  });

module.exports = scanCommand;
