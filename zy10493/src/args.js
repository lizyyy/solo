const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, ERROR_CODES } = require('./config');
const { StitcherError, logger } = require('./utils');

function parseArgs(argv) {
  const program = new Command();

  program
    .name('event-stitcher')
    .description('JSONL事件缝合CLI - 合并多个shard的埋点事件，重构完整用户会话')
    .version('1.0.0');

  program
    .command('stitch')
    .description('缝合多个JSONL文件中的事件')
    .argument('<files...>', '输入的JSONL文件路径，支持glob模式')
    .option('-o, --output <dir>', '输出目录', './output')
    .option('--user-key <key>', '用户标识字段名', DEFAULT_CONFIG.userKey)
    .option('--session-key <key>', '会话标识字段名', DEFAULT_CONFIG.sessionKey)
    .option('--time-key <key>', '时间字段名', DEFAULT_CONFIG.timeKey)
    .option('--gap-threshold <ms>', '会话缺口阈值(毫秒)', DEFAULT_CONFIG.gapThreshold)
    .option('--format <format>', '输出格式: ndjson,csv,report,all', 'all')
    .option('--encoding <encoding>', '文件编码', DEFAULT_CONFIG.encoding)
    .option('--verbose', '显示详细日志', false)
    .option('--dry-run', '仅执行校验不输出文件', false)
    .action((files, options) => {
      const config = validateAndTransformOptions(files, options);
      program._configResult = config;
    });

  program
    .command('self-test')
    .description('运行自检命令，验证工具功能完整性')
    .option('--output <dir>', '测试输出目录', './test-output')
    .action(async (options) => {
      await runSelfTest(options);
      process.exit(0);
    });

  program.parse(argv);

  if (program._configResult) {
    return program._configResult;
  }

  process.exit(0);
}

function validateAndTransformOptions(files, options) {
  const config = {
    ...DEFAULT_CONFIG,
    files: [],
    outputDir: path.resolve(options.output),
    userKey: options.userKey,
    sessionKey: options.sessionKey,
    timeKey: options.timeKey,
    gapThreshold: parseInt(options.gapThreshold, 10),
    outputFormats: parseFormats(options.format),
    encoding: options.encoding,
    verbose: options.verbose,
    dryRun: options.dryRun
  };

  if (files.length === 0) {
    throw new StitcherError(
      '必须指定至少一个输入文件',
      ERROR_CODES.INPUT_INVALID
    );
  }

  for (const filePattern of files) {
    const resolvedFiles = resolveFiles(filePattern);
    config.files.push(...resolvedFiles);
  }

  if (config.files.length === 0) {
    throw new StitcherError(
      '未找到匹配的输入文件',
      ERROR_CODES.FILE_NOT_FOUND,
      { patterns: files }
    );
  }

  if (isNaN(config.gapThreshold) || config.gapThreshold <= 0) {
    throw new StitcherError(
      '缺口阈值必须是正整数',
      ERROR_CODES.INPUT_INVALID,
      { value: options.gapThreshold }
    );
  }

  if (!fs.existsSync(config.outputDir)) {
    try {
      fs.mkdirSync(config.outputDir, { recursive: true });
      logger.debug(`创建输出目录: ${config.outputDir}`);
    } catch (err) {
      throw new StitcherError(
        `无法创建输出目录: ${config.outputDir}`,
        ERROR_CODES.IO_ERROR,
        { error: err.message }
      );
    }
  }

  return config;
}

function resolveFiles(pattern) {
  if (fs.existsSync(pattern)) {
    const stat = fs.statSync(pattern);
    if (stat.isFile()) {
      return [path.resolve(pattern)];
    }
  }
  return [];
}

function parseFormats(format) {
  if (format === 'all') {
    return DEFAULT_CONFIG.outputFormats;
  }
  const formats = format.split(',').map(f => f.trim().toLowerCase());
  const validFormats = DEFAULT_CONFIG.outputFormats;
  const invalid = formats.filter(f => !validFormats.includes(f));
  if (invalid.length > 0) {
    throw new StitcherError(
      `无效的输出格式: ${invalid.join(', ')}。有效格式: ${validFormats.join(', ')}`,
      ERROR_CODES.INPUT_INVALID
    );
  }
  return formats;
}

async function runSelfTest(options) {
  const selfTest = require('./self-test');
  await selfTest.run(options.output);
}

module.exports = { parseArgs };