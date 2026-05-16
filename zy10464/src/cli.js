#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const CollectionParser = require('./collection-parser');
const AssertionDetector = require('./assertion-detector');
const ExampleDetector = require('./example-detector');
const VariableValidator = require('./variable-validator');
const ConsoleReporter = require('./console-reporter');
const JsonReporter = require('./json-reporter');
const MarkdownReporter = require('./markdown-reporter');

const PACKAGE_INFO = require('../package.json');

const ERROR_CODES = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  FILE_NOT_FOUND: 2,
  INVALID_COLLECTION: 3,
  OUTPUT_ERROR: 4,
  INTERNAL_ERROR: 5
};

function printUsage() {
  console.log(`
Postman Collection 覆盖审计 CLI v${PACKAGE_INFO.version}

用法:
  postman-audit --collection <path> [选项]

必选参数:
  -c, --collection <path>    Postman Collection JSON 文件路径

可选参数:
  -e, --environment <path>   Postman 环境变量 JSON 文件路径
  -o, --output <dir>         输出目录 (默认: ./audit-output)
  -f, --format <formats>     输出格式: console,json,markdown (逗号分隔, 默认: console,json,markdown)
  -n, --name <name>          报告名称前缀 (默认: postman-audit)
  --fail-on-missing-assert   缺少断言时退出码为非零
  --fail-on-missing-example  缺少示例时退出码为非零
  -v, --verbose              显示详细日志
  -q, --quiet                静默模式，只显示错误
  -h, --help                 显示此帮助信息
  --version                  显示版本号

示例:
  postman-audit -c ./my-collection.json
  postman-audit -c ./api.json -e ./prod-env.json -o ./reports -f json,markdown
  postman-audit --collection ./collection.json --fail-on-missing-assert
`);
}

function printVersion() {
  console.log(`postman-audit v${PACKAGE_INFO.version}`);
}

function validateFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} 不存在: ${filePath}`);
  }
  if (!fs.statSync(filePath).isFile()) {
    throw new Error(`${description} 不是文件: ${filePath}`);
  }
}

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.statSync(outputDir).isDirectory()) {
    throw new Error(`输出路径不是目录: ${outputDir}`);
  }
}

function parseFormats(formatStr) {
  const validFormats = ['console', 'json', 'markdown'];
  const formats = formatStr.split(',').map(f => f.trim().toLowerCase());
  const invalid = formats.filter(f => !validFormats.includes(f));
  if (invalid.length > 0) {
    throw new Error(`无效的输出格式: ${invalid.join(', ')}. 有效格式: ${validFormats.join(', ')}`);
  }
  return formats;
}

async function main() {
  try {
    const { values, positionals } = parseArgs({
      options: {
        collection: { type: 'string', short: 'c' },
        environment: { type: 'string', short: 'e' },
        output: { type: 'string', short: 'o', default: './audit-output' },
        format: { type: 'string', short: 'f', default: 'console,json,markdown' },
        name: { type: 'string', short: 'n', default: 'postman-audit' },
        'fail-on-missing-assert': { type: 'boolean', default: false },
        'fail-on-missing-example': { type: 'boolean', default: false },
        verbose: { type: 'boolean', short: 'v', default: false },
        quiet: { type: 'boolean', short: 'q', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', default: false }
      },
      strict: true
    });

    if (values.help) {
      printUsage();
      process.exit(ERROR_CODES.SUCCESS);
    }

    if (values.version) {
      printVersion();
      process.exit(ERROR_CODES.SUCCESS);
    }

    if (!values.collection) {
      console.error('错误: 必须指定 --collection 参数');
      printUsage();
      process.exit(ERROR_CODES.INVALID_ARGS);
    }

    const collectionPath = path.resolve(values.collection);
    const environmentPath = values.environment ? path.resolve(values.environment) : null;
    const outputDir = path.resolve(values.output);
    const reportName = values.name;
    const formats = parseFormats(values.format);
    const verbose = values.verbose;
    const quiet = values.quiet;

    if (!quiet) {
      console.log(`Postman Collection 覆盖审计 v${PACKAGE_INFO.version}`);
      console.log('='.repeat(60));
    }

    if (verbose && !quiet) {
      console.log(`[INFO] Collection 文件: ${collectionPath}`);
      if (environmentPath) console.log(`[INFO] 环境变量文件: ${environmentPath}`);
      console.log(`[INFO] 输出目录: ${outputDir}`);
      console.log(`[INFO] 输出格式: ${formats.join(', ')}`);
    }

    validateFileExists(collectionPath, 'Collection 文件');
    if (environmentPath) validateFileExists(environmentPath, '环境变量文件');
    ensureOutputDir(outputDir);

    const parser = new CollectionParser({ verbose, quiet });
    const collection = parser.parse(collectionPath);

    if (verbose && !quiet) {
      console.log(`[INFO] Collection 名称: ${collection.info.name}`);
      console.log(`[INFO] Collection 版本: ${collection.info.schema}`);
    }

    const allRequests = parser.getAllRequests();
    
    if (verbose && !quiet) {
      console.log(`[INFO] 发现 ${allRequests.length} 个请求`);
    }

    const assertionDetector = new AssertionDetector({ verbose, quiet });
    const assertionResults = assertionDetector.analyze(allRequests);

    const exampleDetector = new ExampleDetector({ verbose, quiet });
    const exampleResults = exampleDetector.analyze(allRequests);

    let variableResults = null;
    if (environmentPath) {
      const variableValidator = new VariableValidator({ verbose, quiet });
      variableResults = variableValidator.validate(allRequests, environmentPath);
    }

    const auditResult = {
      metadata: {
        toolVersion: PACKAGE_INFO.version,
        auditTime: new Date().toISOString(),
        collectionName: collection.info.name,
        collectionFile: collectionPath,
        environmentFile: environmentPath,
        totalRequests: allRequests.length
      },
      assertions: assertionResults,
      examples: exampleResults,
      variables: variableResults,
      summary: {
        assertions: {
          total: assertionResults.total,
          withAssertions: assertionResults.withAssertions,
          withoutAssertions: assertionResults.withoutAssertions,
          coverageRate: assertionResults.coverageRate
        },
        examples: {
          total: exampleResults.total,
          withExamples: exampleResults.withExamples,
          withoutExamples: exampleResults.withoutExamples,
          coverageRate: exampleResults.coverageRate
        }
      }
    };

    const reporters = [];
    if (formats.includes('console')) {
      reporters.push(new ConsoleReporter({ verbose, quiet }));
    }
    if (formats.includes('json')) {
      reporters.push(new JsonReporter({ outputDir, reportName, verbose, quiet }));
    }
    if (formats.includes('markdown')) {
      reporters.push(new MarkdownReporter({ outputDir, reportName, verbose, quiet }));
    }

    for (const reporter of reporters) {
      await reporter.generate(auditResult);
    }

    let exitCode = ERROR_CODES.SUCCESS;
    if (values['fail-on-missing-assert'] && assertionResults.withoutAssertions > 0) {
      exitCode = ERROR_CODES.SUCCESS + 1;
    }
    if (values['fail-on-missing-example'] && exampleResults.withoutExamples > 0) {
      exitCode = Math.max(exitCode, ERROR_CODES.SUCCESS + 2);
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('\n错误:');
    console.error(`  ${error.message}`);
    
    if (error.stack && process.argv.includes('--verbose')) {
      console.error('\n堆栈跟踪:');
      console.error(error.stack);
    }

    process.exit(ERROR_CODES.INTERNAL_ERROR);
  }
}

main();
