'use strict';

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const program = new Command();

  program
    .name('csv2ndjson')
    .description('CSV转NDJSON规整CLI工具 - 处理编码探测、列名归一、坏行留存')
    .version('1.0.0', '-v, --version', '输出版本号')
    .helpOption('-h, --help', '显示帮助信息');

  program
    .argument('<input-file>', '输入 CSV 文件路径')
    .option('-o, --output-dir <dir>', '输出目录 (默认: ./output)', './output')
    .option('-m, --column-map <json>', '列映射 JSON 字符串或文件路径, 如: {"旧列名": "新列名"}')
    .option('-e, --encoding <encoding>', '强制指定编码 (默认: 自动探测)', null)
    .option('-n, --null-values <list>', '空值标识列表, 逗号分隔 (默认: NA,N/A,空字符串,na,null,NULL)', 'NA,N/A,,na,null,NULL')
    .option('-k, --id-columns <list>', '幂等键列名, 逗号分隔, 用于检测重复行')
    .option('-d, --delimiter <char>', 'CSV分隔符 (默认: ,)', ',')
    .option('-s, --skip-rows <number>', '跳过开头行数 (默认: 0)', '0')
    .option('-f, --force', '覆盖已存在的输出文件')
    .option('-q, --quiet', '静默模式, 只输出错误')
    .action((inputFile, options) => {
      options.inputFile = inputFile;
    });

  program.parse();
  const options = program.opts();

  validateOptions(options);
  normalizeOptions(options);

  return options;
}

function validateOptions(options) {
  if (!fs.existsSync(options.inputFile)) {
    throw new Error(`输入文件不存在: ${options.inputFile}`);
  }

  if (!fs.statSync(options.inputFile).isFile()) {
    throw new Error(`输入不是文件: ${options.inputFile}`);
  }

  if (options.columnMap) {
    if (fs.existsSync(options.columnMap) && fs.statSync(options.columnMap).isFile()) {
      try {
        const content = fs.readFileSync(options.columnMap, 'utf8');
        options.columnMap = JSON.parse(content);
      } catch (err) {
        throw new Error(`列映射文件解析失败: ${options.columnMap}, 错误: ${err.message}`);
      }
    } else {
      try {
        options.columnMap = JSON.parse(options.columnMap);
      } catch (err) {
        throw new Error(`列映射 JSON 解析失败, 错误: ${err.message}`);
      }
    }
    
    if (typeof options.columnMap !== 'object' || Array.isArray(options.columnMap)) {
      throw new Error('列映射必须是 JSON 对象格式: {"旧列名": "新列名"}');
    }
  }

  if (options.skipRows) {
    const skipRows = parseInt(options.skipRows, 10);
    if (isNaN(skipRows) || skipRows < 0) {
      throw new Error('跳过行数必须是非负整数');
    }
    options.skipRows = skipRows;
  }
}

function normalizeOptions(options) {
  options.inputFile = path.resolve(options.inputFile);
  options.outputDir = path.resolve(options.outputDir);
  
  options.nullValues = options.nullValues.split(',').map(v => {
    if (v === '') return '';
    return v.trim();
  });
  
  if (options.idColumns) {
    options.idColumns = options.idColumns.split(',').map(v => v.trim());
  } else {
    options.idColumns = [];
  }

  options.fileName = path.basename(options.inputFile, path.extname(options.inputFile));
  
  if (!options.quiet) {
    console.log(`📁 输入文件: ${options.inputFile}`);
    console.log(`📂 输出目录: ${options.outputDir}`);
  }
}

module.exports = { parseArgs };
