#!/usr/bin/env node

const { Command } = require('commander');
const storage = require('../src/utils/storage');
const importCmd = require('../src/commands/import');
const reviewCmd = require('../src/commands/review');
const correctCmd = require('../src/commands/correct');
const historyCmd = require('../src/commands/history');
const exportCmd = require('../src/commands/export');

const program = new Command();

program
  .name('lp-review')
  .description('线性规划讲评 - 教研组长专用CLI工具')
  .version('1.0.0');

storage.ensureAllDirs();

program
  .command('list')
  .description('列出所有项目')
  .action(async () => {
    const projects = storage.listProjects();
    if (projects.length === 0) {
      console.log('暂无项目，请先导入数据创建项目');
      return;
    }
    console.log('项目列表:');
    projects.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p}`);
    });
  });

const importProgram = program.command('import')
  .description('导入数据');

importProgram
  .command('questions <project> <inputPath>')
  .description('导入题库表')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, inputPath, options) => {
    await importCmd.importQuestionBank(project, inputPath, options);
  });

importProgram
  .command('mistakes <project> <inputPath>')
  .description('导入学生错题')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, inputPath, options) => {
    await importCmd.importMistakes(project, inputPath, options);
  });

importProgram
  .command('notes <project> <inputPath>')
  .description('导入备注')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, inputPath, options) => {
    await importCmd.importNotes(project, inputPath, options);
  });

const reviewProgram = program.command('review')
  .description('复核相关');

reviewProgram
  .command('auto <project>')
  .description('运行自动复核')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, options) => {
    await reviewCmd.runAutoReview(project, options);
  });

reviewProgram
  .command('anomalies <project>')
  .description('查看异常记录')
  .option('--detail', '显示详细信息')
  .action(async (project, options) => {
    await reviewCmd.showAnomalies(project, options);
  });

reviewProgram
  .command('pending <project>')
  .description('查看待复核记录')
  .action(async (project, options) => {
    await reviewCmd.showPendingReview(project, options);
  });

reviewProgram
  .command('status <project>')
  .description('查看项目状态')
  .action(async (project, options) => {
    await reviewCmd.showStatus(project, options);
  });

reviewProgram
  .command('explain <code>')
  .description('查看异常代码说明')
  .action(async (code) => {
    await reviewCmd.showAnomalyExplain(code);
  });

const correctProgram = program.command('correct')
  .description('修正相关');

correctProgram
  .command('mistake <project>')
  .description('手动修正错题判定')
  .option('--question <no>', '题号', parseInt)
  .option('--student <id>', '学生ID或姓名')
  .option('--judgment <j>', '判定结果: correct/wrong')
  .option('--reason <r>', '改判原因')
  .option('--notes <n>', '补充备注')
  .option('--error-type <t>', '错误类型')
  .option('--error-analysis <a>', '错误分析')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, options) => {
    await correctCmd.correctMistake(project, options);
  });

correctProgram
  .command('question <project> <questionNo>')
  .description('更新题目信息')
  .option('--standard-answer <a>', '更新标准答案')
  .option('--equivalent-answer <a>', '添加等价答案', (v, p) => { p.push(v); return p; }, [])
  .option('--remove-equivalent-answer <a>', '移除等价答案', (v, p) => { p.push(v); return p; }, [])
  .option('--notes <n>', '更新题目备注')
  .option('--knowledge-point <kp>', '更新知识点')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, questionNo, options) => {
    await correctCmd.updateQuestion(project, parseInt(questionNo), options);
  });

correctProgram
  .command('section <project>')
  .description('更新讲评分段')
  .option('--knowledge-point <kp>', '知识点(必填)')
  .option('--title <t>', '分段标题')
  .option('--summary <s>', '考点分析')
  .option('--common-mistakes <m>', '常见错误', (v, p) => { p.push(v); return p; }, [])
  .option('--teaching-points <p>', '教学要点', (v, p) => { p.push(v); return p; }, [])
  .option('--screenshot-note <n>', '讲义截图备注')
  .option('--teacher-notes <n>', '教师备注')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, options) => {
    await correctCmd.updateReviewSection(project, options);
  });

correctProgram
  .command('meta <project>')
  .description('更新讲评稿元数据')
  .option('--title <t>', '讲评稿标题')
  .option('--exam-name <n>', '考试名称')
  .option('--class-name <n>', '班级名称')
  .option('--reviewer <n>', '讲评人')
  .option('--overall-analysis <a>', '整体分析')
  .option('--suggestions <s>', '后续建议')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, options) => {
    await correctCmd.updateReviewMeta(project, options);
  });

correctProgram
  .command('done <project>')
  .description('标记复核完成')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, options) => {
    await correctCmd.markReviewed(project, options);
  });

const historyProgram = program.command('history')
  .description('历史记录');

historyProgram
  .command('list <project>')
  .description('查看历史记录')
  .option('--latest <n>', '显示最近N条', parseInt)
  .option('--operation <op>', '按操作类型筛选')
  .option('--screenshot', '只看截图变更')
  .option('--correction', '只看手动改判')
  .option('--target <target>', '按目标筛选，格式: 类型:ID')
  .action(async (project, options) => {
    await historyCmd.showHistory(project, options);
  });

historyProgram
  .command('detail <project> <entryId>')
  .description('查看历史记录详情')
  .option('--full', '显示完整的前后状态')
  .action(async (project, entryId, options) => {
    await historyCmd.showHistoryDetail(project, entryId, options);
  });

historyProgram
  .command('screenshot <project>')
  .description('查看讲义截图变更历史')
  .action(async (project, options) => {
    await historyCmd.showScreenshotHistory(project, options);
  });

historyProgram
  .command('correction <project>')
  .description('查看手动改判历史')
  .action(async (project, options) => {
    await historyCmd.showCorrectionHistory(project, options);
  });

historyProgram
  .command('compare <project>')
  .description('对比版本变化')
  .action(async (project, options) => {
    await historyCmd.compareVersions(project, options);
  });

const exportProgram = program.command('export')
  .description('导出数据');

exportProgram
  .command('script <project>')
  .description('导出讲评稿')
  .option('--force', '强制导出，忽略检查')
  .option('--operator <name>', '操作人姓名', 'teacher')
  .action(async (project, options) => {
    await exportCmd.exportReviewScript(project, options);
  });

exportProgram
  .command('mistakes <project>')
  .description('导出错题明细')
  .option('--question <no>', '按题号筛选', parseInt)
  .option('--student <id>', '按学生筛选')
  .action(async (project, options) => {
    await exportCmd.exportMistakeDetail(project, options);
  });

exportProgram
  .command('check <project>')
  .description('导出前检查')
  .action(async (project, options) => {
    await exportCmd.preExportCheck(project, options);
  });

program.parseAsync(process.argv).catch(err => {
  console.error('执行出错:', err.message);
  process.exit(1);
});
