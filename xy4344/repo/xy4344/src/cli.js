#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');

const db = require('./database');
const server = require('./server');
const checkers = require('./checkers');

const srtParser = require('./parsers/srtParser');
const csvParser = require('./parsers/csvParser');
const jsonParser = require('./parsers/jsonParser');

const subtitleDao = require('./dao/subtitleDao');
const vocabularyDao = require('./dao/vocabularyDao');
const segmentDao = require('./dao/segmentDao');
const feedbackDao = require('./dao/feedbackDao');
const issueDao = require('./dao/issueDao');

const markdownExporter = require('./exporters/markdownExporter');
const csvExporter = require('./exporters/csvExporter');
const jsonExporter = require('./exporters/jsonExporter');

const pkg = require('../package.json');

program
  .name('sl-review')
  .description('公益手语课复盘视频检查工具')
  .version(pkg.version);

program
  .option('--import <path>', '导入数据文件或目录')
  .option('--check', '运行所有检查')
  .option('--serve', '启动Web服务')
  .option('--port <number>', 'Web服务端口', '3000')
  .option('--export <type>', '导出数据: markdown, csv, json, all')
  .option('--output <path>', '导出目录')
  .option('--examples', '使用示例数据');

program.parse(process.argv);

const options = program.opts();

async function main() {
  await db.initDB();
  
  try {
    if (options.import) {
      await importData(options.import);
    }
    
    if (options.examples) {
      await loadExamples();
    }
    
    if (options.check) {
      await runCheck();
    }
    
    if (options.export) {
      await exportData(options.export, options.output);
    }
    
    if (options.serve) {
      await startServer(parseInt(options.port));
    }
    
    if (!options.import && !options.check && !options.serve && !options.export && !options.examples) {
      await showInteractiveMenu();
    }
    
  } finally {
    if (!options.serve) {
      await db.closeDB();
    }
  }
}

async function importData(importPath) {
  console.log(chalk.blue(`\n📥 导入数据: ${importPath}\n`));
  
  const stats = fs.statSync(importPath);
  
  if (stats.isDirectory()) {
    const files = fs.readdirSync(importPath);
    
    for (const file of files) {
      const filePath = path.join(importPath, file);
      await importFile(filePath);
    }
  } else {
    await importFile(importPath);
  }
  
  console.log(chalk.green('\n✅ 导入完成\n'));
}

async function importFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toLowerCase();
  
  console.log(`  处理文件: ${path.basename(filePath)}`);
  
  try {
    if (ext === '.srt') {
      const subtitles = srtParser.parseSRT(filePath);
      await subtitleDao.saveSubtitles(subtitles);
      console.log(chalk.green(`    ✓ 导入了 ${subtitles.length} 条字幕`));
    }
    
    else if (ext === '.csv') {
      const data = await csvParser.parseCSV(filePath);
      
      if (baseName.includes('vocab') || baseName.includes('词汇') || baseName.includes('word')) {
        const vocabulary = csvParser.parseVocabulary(data);
        await vocabularyDao.saveVocabulary(vocabulary);
        console.log(chalk.green(`    ✓ 导入了 ${vocabulary.length} 个词汇`));
      }
      else if (baseName.includes('segment') || baseName.includes('环节') || baseName.includes('section')) {
        const segments = csvParser.parseSegments(data);
        await segmentDao.saveSegments(segments);
        console.log(chalk.green(`    ✓ 导入了 ${segments.length} 个环节`));
      }
      else if (baseName.includes('feedback') || baseName.includes('反馈') || baseName.includes('学员')) {
        const feedback = csvParser.parseFeedback(data);
        await feedbackDao.saveFeedback(feedback);
        console.log(chalk.green(`    ✓ 导入了 ${feedback.length} 条反馈`));
      }
      else {
        console.log(chalk.yellow(`    ⚠ 无法识别文件类型，尝试自动检测...`));
        await tryDetectAndImportCSV(data);
      }
    }
    
    else if (ext === '.json') {
      const data = jsonParser.parseJSON(filePath);
      
      if (baseName.includes('vocab') || baseName.includes('词汇') || baseName.includes('word') || data.vocabulary || data.words) {
        const vocabulary = jsonParser.parseVocabulary(data);
        await vocabularyDao.saveVocabulary(vocabulary);
        console.log(chalk.green(`    ✓ 导入了 ${vocabulary.length} 个词汇`));
      }
      else if (baseName.includes('segment') || baseName.includes('环节') || data.segments) {
        const segments = jsonParser.parseSegments(data);
        await segmentDao.saveSegments(segments);
        console.log(chalk.green(`    ✓ 导入了 ${segments.length} 个环节`));
      }
      else if (baseName.includes('feedback') || baseName.includes('反馈') || data.feedback) {
        const feedback = jsonParser.parseFeedback(data);
        await feedbackDao.saveFeedback(feedback);
        console.log(chalk.green(`    ✓ 导入了 ${feedback.length} 条反馈`));
      }
      else {
        console.log(chalk.yellow(`    ⚠ 无法识别文件类型`));
      }
    }
    
    else {
      console.log(chalk.yellow(`    ⚠ 不支持的文件格式: ${ext}`));
    }
    
  } catch (err) {
    console.log(chalk.red(`    ✗ 导入失败: ${err.message}`));
  }
}

async function tryDetectAndImportCSV(data) {
  const keys = Object.keys(data[0] || {}).map(k => k.toLowerCase());
  
  if (keys.some(k => k.includes('word') || k.includes('词汇') || k.includes('vocabulary'))) {
    const vocabulary = csvParser.parseVocabulary(data);
    await vocabularyDao.saveVocabulary(vocabulary);
    console.log(chalk.green(`    ✓ 自动检测: 词汇表，导入了 ${vocabulary.length} 个词汇`));
  }
  else if (keys.some(k => k.includes('segment') || k.includes('环节') || k.includes('order') || k.includes('顺序'))) {
    const segments = csvParser.parseSegments(data);
    await segmentDao.saveSegments(segments);
    console.log(chalk.green(`    ✓ 自动检测: 环节表，导入了 ${segments.length} 个环节`));
  }
  else if (keys.some(k => k.includes('feedback') || k.includes('反馈') || k.includes('student') || k.includes('学员'))) {
    const feedback = csvParser.parseFeedback(data);
    await feedbackDao.saveFeedback(feedback);
    console.log(chalk.green(`    ✓ 自动检测: 学员反馈，导入了 ${feedback.length} 条反馈`));
  }
  else {
    console.log(chalk.yellow(`    ⚠ 无法自动检测文件类型`));
  }
}

async function loadExamples() {
  console.log(chalk.blue(`\n📚 加载示例数据...\n`));
  
  const exampleDir = path.join(__dirname, '..', 'examples');
  
  if (fs.existsSync(exampleDir)) {
    await importData(exampleDir);
  } else {
    console.log(chalk.yellow(`  ⚠ 示例目录不存在，创建示例数据...`));
    await createSampleData();
  }
}

async function createSampleData() {
  const sampleSubtitles = [
    {
      index: 1,
      startTime: 0,
      endTime: 5000,
      startTimeStr: '00:00:00,000',
      endTimeStr: '00:00:05,000',
      text: '大家好，欢迎来到手语公益课',
      duration: 5000,
      sourceFile: 'sample.srt'
    },
    {
      index: 2,
      startTime: 4500,
      endTime: 8000,
      startTimeStr: '00:00:04,500',
      endTimeStr: '00:00:08,000',
      text: '今天我们学习家庭相关的手语',
      duration: 3500,
      sourceFile: 'sample.srt'
    },
    {
      index: 3,
      startTime: 8000,
      endTime: 20000,
      startTimeStr: '00:00:08,000',
      endTimeStr: '00:00:20,000',
      text: '首先是爸爸、妈妈、哥哥、姐姐、弟弟、妹妹',
      duration: 12000,
      sourceFile: 'sample.srt'
    }
  ];
  
  const sampleVocabulary = [
    { word: '爸爸', meaning: '父亲', category: '家庭', difficulty: '初级', tags: ['家庭成员'] },
    { word: '妈妈', meaning: '母亲', category: '家庭', difficulty: '初级', tags: ['家庭成员'] },
    { word: '哥哥', meaning: '兄长', category: '家庭', difficulty: '初级', tags: ['兄弟姐妹'] },
    { word: '感谢', meaning: '谢谢', category: '日常', difficulty: '初级', tags: ['礼貌用语'] }
  ];
  
  const sampleSegments = [
    { name: '开场问候', order: 1, startTime: '00:00:00', endTime: '00:00:05', teacher: '张老师', objectives: ['欢迎学员', '介绍课程'] },
    { name: '词汇讲解', order: 3, startTime: '00:00:08', endTime: '00:00:20', teacher: '张老师', objectives: ['讲解家庭词汇'] },
    { name: '练习环节', order: 2, startTime: '00:00:05', endTime: '00:00:08', teacher: '李助教', objectives: ['复习上周内容'] }
  ];
  
  const sampleFeedback = [
    { student: '小明', question: '哥哥和弟弟的手语区别是什么？', category: '词汇', status: 'pending' },
    { student: '小红', question: '希望能多一些练习时间', category: '建议', status: 'closed', response: '下次课程会增加练习环节' }
  ];
  
  await subtitleDao.saveSubtitles(sampleSubtitles);
  await vocabularyDao.saveVocabulary(sampleVocabulary);
  await segmentDao.saveSegments(sampleSegments);
  await feedbackDao.saveFeedback(sampleFeedback);
  
  console.log(chalk.green(`  ✓ 创建了 ${sampleSubtitles.length} 条示例字幕`));
  console.log(chalk.green(`  ✓ 创建了 ${sampleVocabulary.length} 个示例词汇`));
  console.log(chalk.green(`  ✓ 创建了 ${sampleSegments.length} 个示例环节`));
  console.log(chalk.green(`  ✓ 创建了 ${sampleFeedback.length} 条示例反馈`));
}

async function runCheck() {
  console.log(chalk.blue(`\n🔍 运行检查...\n`));
  
  const result = await checkers.runAllChecks();
  
  console.log(chalk.bold(`  检查结果:`));
  console.log(`    总计问题: ${chalk.yellow(result.total)}`);
  console.log(`    - 时间重叠: ${result.byType.timeOverlap}`);
  console.log(`    - 词汇覆盖: ${result.byType.vocabulary}`);
  console.log(`    - 环节顺序: ${result.byType.segmentOrder}`);
  console.log(`    - 反馈闭环: ${result.byType.feedbackLoop}`);
  
  if (result.issues.length > 0) {
    console.log(chalk.yellow(`\n  问题详情:`));
    result.issues.forEach((issue, idx) => {
      const severityColor = issue.severity === 'critical' ? chalk.red : 
                            issue.severity === 'warning' ? chalk.yellow : chalk.blue;
      console.log(`    ${idx + 1}. [${severityColor(issue.severity)}] ${issue.title}`);
    });
  }
}

async function exportData(type, outputDir) {
  const outDir = outputDir || path.join(process.cwd(), 'export');
  
  console.log(chalk.blue(`\n📤 导出数据到: ${outDir}\n`));
  
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  if (type === 'markdown' || type === 'all') {
    const mdPath = await markdownExporter.exportMarkdown(path.join(outDir, '复盘报告.md'));
    console.log(chalk.green(`  ✓ Markdown 复盘单: ${mdPath}`));
  }
  
  if (type === 'csv' || type === 'all') {
    const csvPaths = await csvExporter.exportAllCSV(outDir);
    Object.values(csvPaths).forEach(p => {
      console.log(chalk.green(`  ✓ CSV: ${p}`));
    });
  }
  
  if (type === 'json' || type === 'all') {
    const jsonPath = await jsonExporter.exportJSON(path.join(outDir, '审计包.json'));
    console.log(chalk.green(`  ✓ JSON 审计包: ${jsonPath}`));
  }
}

async function startServer(port) {
  await server.startServer(port);
}

async function showInteractiveMenu() {
  console.log(chalk.bold(`\n🎯 手语课复盘工具 v${pkg.version}`));
  console.log(chalk.gray(`  ${pkg.description}\n`));
  
  while (true) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '选择操作:',
        choices: [
          { name: '📥 导入数据', value: 'import' },
          { name: '🔍 运行检查', value: 'check' },
          { name: '🌐 启动Web服务', value: 'serve' },
          { name: '📤 导出数据', value: 'export' },
          { name: '📊 查看统计', value: 'stats' },
          { name: '❌ 退出', value: 'exit' }
        ]
      }
    ]);
    
    switch (answers.action) {
      case 'import':
        await handleImport();
        break;
      case 'check':
        await runCheck();
        break;
      case 'serve':
        await handleServe();
        return;
      case 'export':
        await handleExport();
        break;
      case 'stats':
        await showStats();
        break;
      case 'exit':
        console.log(chalk.green('\n👋 再见！\n'));
        return;
    }
  }
}

async function handleImport() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'source',
      message: '导入来源:',
      choices: [
        { name: '使用示例数据', value: 'examples' },
        { name: '从文件/目录导入', value: 'file' }
      ]
    }
  ]);
  
  if (answers.source === 'examples') {
    await loadExamples();
  } else {
    const fileAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'path',
        message: '输入文件或目录路径:',
        default: process.cwd()
      }
    ]);
    
    if (fs.existsSync(fileAnswer.path)) {
      await importData(fileAnswer.path);
    } else {
      console.log(chalk.red(`  ✗ 路径不存在: ${fileAnswer.path}`));
    }
  }
}

async function handleServe() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: '端口号:',
      default: '3000',
      validate: (val) => !isNaN(parseInt(val)) || '请输入有效端口号'
    }
  ]);
  
  await startServer(parseInt(answers.port));
}

async function handleExport() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: '导出格式:',
      choices: [
        { name: '全部格式', value: 'all' },
        { name: 'Markdown 复盘单', value: 'markdown' },
        { name: 'CSV 问题清单', value: 'csv' },
        { name: 'JSON 审计包', value: 'json' }
      ]
    },
    {
      type: 'input',
      name: 'output',
      message: '输出目录:',
      default: path.join(process.cwd(), 'export')
    }
  ]);
  
  await exportData(answers.type, answers.output);
}

async function showStats() {
  const [
    subtitleCount,
    vocabCount,
    segmentCount,
    feedbackCount,
    issueCount
  ] = await Promise.all([
    subtitleDao.getSubtitleCount(),
    vocabularyDao.getVocabularyCount(),
    segmentDao.getSegmentCount(),
    feedbackDao.getFeedbackCount(),
    issueDao.getIssueCount()
  ]);
  
  console.log(chalk.blue(`\n📊 数据统计:\n`));
  console.log(`  字幕: ${subtitleCount} 条`);
  console.log(`  词汇: ${vocabCount} 个`);
  console.log(`  环节: ${segmentCount} 个`);
  console.log(`  反馈: ${feedbackCount} 条`);
  console.log(`  问题: ${issueCount} 个\n`);
}

main().catch(err => {
  console.error(chalk.red('\n❌ 错误:'), err.message);
  console.error(err.stack);
  process.exit(1);
});
