#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const ScoreParser = require('./score-parser');
const TransposeEngine = require('./transpose-engine');
const ScoreExporter = require('./exporter');

const program = new Command();

program
  .name('transpose')
  .description('曲谱移调批处理CLI工具')
  .version('1.0.0');

program
  .command('process')
  .description('处理曲谱移调')
  .requiredOption('-i, --input <file>', '输入曲谱文件路径')
  .requiredOption('-t, --target <key>', '目标调号 (如: D, Eb, F#m)')
  .option('-o, --output <file>', '输出文件路径')
  .option('-f, --format <format>', '输出格式: json|text|diff', 'text')
  .option('--no-check', '跳过人工核对清单生成')
  .option('--strict', '严格模式，遇到警告也终止')
  .action(async (options) => {
    try {
      await processScore(options);
    } catch (err) {
      console.error(chalk.red(`\n❌ 处理失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('预览移调差异，不导出完整谱面')
  .requiredOption('-i, --input <file>', '输入曲谱文件路径')
  .requiredOption('-t, --target <key>', '目标调号')
  .action(async (options) => {
    try {
      await processScore({
        ...options,
        format: 'diff',
        output: null
      });
    } catch (err) {
      console.error(chalk.red(`\n❌ 预览失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证曲谱文件格式')
  .requiredOption('-i, --input <file>', '输入曲谱文件路径')
  .action(async (options) => {
    try {
      await validateScore(options);
    } catch (err) {
      console.error(chalk.red(`\n❌ 验证失败: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('list-keys')
  .description('列出支持的调号')
  .action(() => {
    const { KEY_SIGNATURES, MINOR_KEYS } = require('./music-theory');
    console.log(chalk.cyan('\n支持的大调:'));
    console.log(Object.keys(KEY_SIGNATURES).join(', '));
    console.log(chalk.cyan('\n支持的小调:'));
    console.log(Object.keys(MINOR_KEYS).join(', '));
    console.log();
  });

async function processScore(options) {
  const inputPath = path.resolve(options.input);
  const targetKey = options.target;
  const format = options.format || 'text';

  console.log(chalk.cyan(`\n🎵 曲谱移调处理`));
  console.log(chalk.gray(`输入文件: ${inputPath}`));
  console.log(chalk.gray(`目标调: ${targetKey}`));
  console.log();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  const parser = new ScoreParser();
  const score = parser.parseFile(inputPath);

  if (parser.getErrors().length > 0) {
    console.log(chalk.red('❌ 解析错误:'));
    parser.getErrors().forEach(err => {
      const lineInfo = err.line ? ` (第 ${err.line} 行)` : '';
      console.log(chalk.red(`  - ${err.message}${lineInfo}`));
    });
    console.log();
    throw new Error('曲谱解析失败');
  }

  if (parser.getWarnings().length > 0) {
    console.log(chalk.yellow('⚠️  解析警告:'));
    parser.getWarnings().forEach(warn => {
      const lineInfo = warn.line ? ` (第 ${warn.line} 行)` : '';
      console.log(chalk.yellow(`  - ${warn.message}${lineInfo}`));
    });
    console.log();
  }

  console.log(chalk.green(`✓ 解析成功: "${score.title}"`));
  console.log(chalk.green(`  原调: ${score.originalKey}`));
  console.log(chalk.green(`  声部数: ${score.parts.length}`));
  console.log();

  const engine = new TransposeEngine();
  const result = engine.transpose(score, targetKey);

  if (!result) {
    const errors = engine.issues.filter(i => i.severity === 'error');
    errors.forEach(err => {
      console.log(chalk.red(`❌ ${err.message}`));
    });
    throw new Error('移调处理失败');
  }

  console.log(chalk.cyan('📊 处理摘要:'));
  console.log(`  音符变动: ${result.summary.noteChanges} 处`);
  console.log(`  和弦变动: ${result.summary.chordChanges} 处`);
  console.log(`  变音变化: ${result.summary.accidentalChanges} 处`);
  console.log();

  if (result.summary.warnings > 0) {
    console.log(chalk.yellow(`⚠️  需要注意的问题: ${result.summary.warnings} 个`));
  }
  if (result.summary.needsReview) {
    console.log(chalk.yellow(`   请务必进行人工核对!`));
  }
  console.log();

  if (options.output || format === 'diff') {
    const exporter = new ScoreExporter();
    
    let outputPath;
    if (options.output) {
      outputPath = path.resolve(options.output);
    } else {
      const ext = format === 'json' ? '.json' : '.md';
      const baseName = path.basename(inputPath, path.extname(inputPath));
      outputPath = path.resolve(path.dirname(inputPath), `${baseName}_transposed_${targetKey}${ext}`);
    }

    if (format === 'json') {
      exporter.exportToJSON(result, outputPath);
    } else if (format === 'diff') {
      exporter.exportDiffOnly(result, outputPath);
    } else {
      exporter.exportToText(result, outputPath);
    }

    console.log(chalk.green(`✓ 已导出到: ${outputPath}`));
  }

  console.log();
  console.log(chalk.cyan('💡 提示:'));
  console.log(chalk.gray('  1. 请查看导出文件中的「人工核对清单」'));
  console.log(chalk.gray('  2. 特别注意变音记号变化和和弦标记'));
  console.log(chalk.gray('  3. 歌词对位需要人工确认'));
  console.log();

  if (options.strict && result.summary.warnings > 0) {
    throw new Error('严格模式下存在警告，处理终止');
  }
}

async function validateScore(options) {
  const inputPath = path.resolve(options.input);

  console.log(chalk.cyan(`\n🔍 验证曲谱文件: ${inputPath}`));
  console.log();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`文件不存在: ${inputPath}`);
  }

  const parser = new ScoreParser();
  const score = parser.parseFile(inputPath);

  if (parser.getErrors().length > 0) {
    console.log(chalk.red('❌ 错误:'));
    parser.getErrors().forEach(err => {
      const lineInfo = err.line ? ` (第 ${err.line} 行)` : '';
      console.log(chalk.red(`  - ${err.message}${lineInfo}`));
    });
    console.log();
    throw new Error('验证不通过');
  }

  if (parser.getWarnings().length > 0) {
    console.log(chalk.yellow('⚠️  警告:'));
    parser.getWarnings().forEach(warn => {
      const lineInfo = warn.line ? ` (第 ${warn.line} 行)` : '';
      console.log(chalk.yellow(`  - ${warn.message}${lineInfo}`));
    });
    console.log();
  }

  console.log(chalk.green('✓ 曲谱结构:'));
  console.log(`  标题: ${score.title}`);
  console.log(`  原调: ${score.originalKey}`);
  console.log(`  声部: ${score.parts.length} 个`);
  
  score.parts.forEach((part, i) => {
    console.log(`    ${i + 1}. ${part.name}: ${part.sections.length} 个段落`);
  });

  console.log();
  console.log(chalk.green('✓ 验证通过!'));
  console.log();
}

program.parseAsync(process.argv);
