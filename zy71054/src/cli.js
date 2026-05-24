#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { processCSV, EXIT_CODES } = require('./csv-fixer');
const { generateTerminalSummary, writeReports } = require('./report-generator');
const { COMMON_ENCODINGS } = require('./encoding-detector');

const program = new Command();

program
  .name('csvfix')
  .description('CSV 编码嗅探修复 CLI 工具 - 自动检测编码、推断分隔符、修复乱码和坏行')
  .version('1.0.0');

program
  .argument('<file>', 'CSV 文件路径')
  .option('-e, --encoding <encoding>', '强制指定编码（如 GBK, UTF-8）')
  .option('-c, --encoding-candidates <encodings>', '编码候选列表，逗号分隔', list => list.split(','))
  .option('-d, --delimiter <delimiter>', '强制指定分隔符（如 comma, tab, semicolon, pipe, 或直接字符）')
  .option('-o, --output-dir <dir>', '输出目录', './output')
  .option('-n, --no-header', 'CSV 没有表头行')
  .option('-a, --header-aliases <aliases>', '表头别名映射 JSON 文件路径')
  .option('-k, --keep-bad-records', '在输出中保留坏记录')
  .option('-p, --preview-count <number>', '预览记录数', '5')
  .option('-b, --bad-line-samples <number>', '显示坏行样本数', '10')
  .option('-q, --quiet', '静默模式，不输出终端摘要')
  .option('--no-json', '不生成 JSON 报告')
  .option('--no-markdown', '不生成 Markdown 报告')
  .option('--no-csv', '不生成修复后的 CSV')
  .option('--output-delimiter <delimiter>', '输出 CSV 的分隔符', ',')
  .action(async (file, options) => {
    try {
      const validationErrors = validateOptions(file, options);
      if (validationErrors.length > 0) {
        console.error('❌ 参数错误:');
        validationErrors.forEach(err => console.error(`  - ${err}`));
        process.exit(EXIT_CODES.INVALID_OPTIONS);
      }

      const processOptions = {
        forceEncoding: options.encoding,
        encodingCandidates: options.encodingCandidates,
        delimiter: parseDelimiterOption(options.delimiter),
        hasHeader: options.header,
        headerAliases: options.headerAliases ? loadHeaderAliases(options.headerAliases) : null,
        keepBadRecords: options.keepBadRecords,
        previewCount: parseInt(options.previewCount, 10)
      };

      const result = await processCSV(file, processOptions);

      if (!options.quiet) {
        console.log(generateTerminalSummary(result, {
          showPreview: true,
          showBadRecords: true
        }));
      }

      const baseName = path.basename(file, path.extname(file));
      const outputDir = path.resolve(options.outputDir);

      const outputs = writeReports(result, outputDir, baseName, {
        json: options.json,
        markdown: options.markdown,
        csv: options.csv,
        outputDelimiter: options.outputDelimiter
      });

      if (!options.quiet && outputs.length > 0) {
        console.log('📦 输出文件:');
        for (const output of outputs) {
          console.log(`  - ${output.type}: ${output.path}`);
        }
        console.log('');
      }

      process.exit(result.exitCode);

    } catch (error) {
      console.error('❌ 致命错误:', error.message);
      console.error(error.stack);
      process.exit(EXIT_CODES.CRITICAL_ERROR);
    }
  });

program
  .command('list-encodings')
  .description('列出支持的编码格式')
  .action(() => {
    console.log('支持的编码格式:');
    COMMON_ENCODINGS.forEach(enc => console.log(`  - ${enc}`));
    process.exit(0);
  });

program
  .command('detect <file>')
  .description('仅检测编码和分隔符，不进行完整处理')
  .option('-c, --encoding-candidates <encodings>', '编码候选列表，逗号分隔', list => list.split(','))
  .action(async (file, options) => {
    const fs = require('fs');
    const { detectEncoding } = require('./encoding-detector');
    const { inferDelimiter } = require('./csv-parser');

    try {
      if (!fs.existsSync(file)) {
        console.error(`❌ 文件不存在: ${file}`);
        process.exit(EXIT_CODES.FILE_NOT_FOUND);
      }

      const buffer = fs.readFileSync(file);
      const encodingResult = detectEncoding(buffer, options.encodingCandidates);

      const content = buffer.toString('utf-8');
      const delimiterResult = inferDelimiter(content);

      console.log('');
      console.log('🔍 检测结果:');
      console.log('');
      console.log(`📝 编码格式: ${encodingResult.detected} ${encodingResult.hasBOM ? '(含 BOM)' : ''}`);
      console.log(`🔢 置信度: ${((encodingResult.candidates[0]?.confidence || 0) * 100).toFixed(1)}%`);
      console.log('');
      console.log('📋 编码候选:');
      encodingResult.candidates.slice(0, 5).forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.encoding} - ${(c.confidence * 100).toFixed(1)}%`);
      });
      console.log('');
      console.log(`📏 分隔符: ${formatDelimiter(delimiterResult.delimiter)}`);
      console.log(`🔢 分隔符置信度: ${(delimiterResult.confidence * 100).toFixed(1)}%`);
      console.log('');

      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error('❌ 检测失败:', error.message);
      process.exit(EXIT_CODES.CRITICAL_ERROR);
    }
  });

program.parse();

function validateOptions(file, options) {
  const errors = [];

  if (!fs.existsSync(file)) {
    errors.push(`文件不存在: ${file}`);
  }

  if (options.encoding && !COMMON_ENCODINGS.some(e => e.toLowerCase() === options.encoding.toLowerCase())) {
    errors.push(`不支持的编码: ${options.encoding}。使用 'csvfix list-encodings' 查看支持列表`);
  }

  if (options.encodingCandidates) {
    const invalid = options.encodingCandidates.filter(
      e => !COMMON_ENCODINGS.some(c => c.toLowerCase() === e.toLowerCase())
    );
    if (invalid.length > 0) {
      errors.push(`不支持的编码候选: ${invalid.join(', ')}`);
    }
  }

  if (options.headerAliases && !fs.existsSync(options.headerAliases)) {
    errors.push(`表头别名文件不存在: ${options.headerAliases}`);
  }

  if (options.previewCount && isNaN(parseInt(options.previewCount, 10))) {
    errors.push(`预览数必须是数字: ${options.previewCount}`);
  }

  return errors;
}

function parseDelimiterOption(delimiter) {
  if (!delimiter) return null;

  const delimiterMap = {
    'comma': ',',
    'tab': '\t',
    'semicolon': ';',
    'pipe': '|',
    'caret': '^',
    'soh': '\u0001',
    'space': ' '
  };

  return delimiterMap[delimiter.toLowerCase()] || delimiter;
}

function loadHeaderAliases(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ 读取表头别名文件失败: ${error.message}`);
    process.exit(EXIT_CODES.INVALID_OPTIONS);
  }
}

function formatDelimiter(delimiter) {
  if (delimiter === '\t') return '\\t (制表符)';
  if (delimiter === ',') return ', (逗号)';
  if (delimiter === ';') return '; (分号)';
  if (delimiter === '|') return '| (竖线)';
  if (delimiter === '^') return '^ (脱字符)';
  if (delimiter === '\u0001') return 'SOH (ASCII 0x01)';
  return delimiter;
}
