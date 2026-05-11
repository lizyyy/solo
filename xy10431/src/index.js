#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { table } = require('table');
const program = new Command();

const importer = require('./services/importer');
const checker = require('./services/checker');
const exporter = require('./services/exporter');
const waiverManager = require('./services/waiver-manager');
const store = require('./storage/store');
const { PROBLEM_STATUS, PROBLEM_TYPES, DATA_DIR } = require('./models/types');

program
  .name('wechat-publish')
  .description('公众号素材发布CLI - 管理素材、排期和敏感词检查')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据目录')
  .action(() => {
    console.log(chalk.green(`✓ 数据目录已初始化: ${DATA_DIR}`));
    console.log(chalk.gray('可以开始导入素材、排期和敏感词表了'));
  });

program
  .command('import-materials <file>')
  .description('导入素材清单 (CSV)')
  .action((file) => {
    try {
      const result = importer.importMaterials(file);
      console.log(chalk.green('✓ 素材导入完成'));
      console.log(chalk.white(`  新增: ${result.added}`));
      console.log(chalk.white(`  更新: ${result.updated}`));
      console.log(chalk.gray(`  数据源: ${file}`));
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-schedules <file>')
  .description('导入排期表 (CSV)')
  .action((file) => {
    try {
      const result = importer.importSchedules(file);
      console.log(chalk.green('✓ 排期导入完成'));
      console.log(chalk.white(`  新增: ${result.added}`));
      console.log(chalk.white(`  更新: ${result.updated}`));
      if (result.skipped > 0) {
        console.log(chalk.yellow(`  跳过(未找到素材): ${result.skipped}`));
      }
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('import-sensitive-words <file>')
  .description('导入敏感词表 (CSV)')
  .action((file) => {
    try {
      const result = importer.importSensitiveWords(file);
      console.log(chalk.green('✓ 敏感词导入完成'));
      console.log(chalk.white(`  新增: ${result.added}`));
      console.log(chalk.gray(`  总记录: ${result.total}`));
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('运行所有检查')
  .action(() => {
    const result = checker.run();
    console.log(chalk.white('\n━ 检查结果 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white(`  总问题数: ${result.total}`));
    console.log(chalk.red(`  待处理: ${result.open}`));
    console.log(chalk.yellow(`  已豁免: ${result.waived}`));

    if (result.open > 0) {
      const typeCount = {};
      result.problems
        .filter(p => p.status === PROBLEM_STATUS.OPEN)
        .forEach(p => {
          typeCount[p.type] = (typeCount[p.type] || 0) + 1;
        });

      console.log(chalk.white('\n━ 问题分类 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      Object.entries(typeCount).forEach(([type, count]) => {
        const typeName = {
          [PROBLEM_TYPES.TITLE_DUPLICATE]: '标题重复',
          [PROBLEM_TYPES.COVER_MISSING]: '封面缺失',
          [PROBLEM_TYPES.SCHEDULE_CONFLICT]: '排期冲突',
          [PROBLEM_TYPES.SENSITIVE_WORD]: '敏感词命中',
          [PROBLEM_TYPES.GOLDEN_HOUR_CONSECUTIVE]: '黄金时段连续占用',
          [PROBLEM_TYPES.WAIVER_EXPIRED]: '豁免过期'
        }[type] || type;
        console.log(chalk.white(`  ${typeName}: ${count}`));
      });
    }
  });

function printProblems(problems, materials) {
  if (problems.length === 0) {
    console.log(chalk.green('✓ 没有发现问题'));
    return;
  }

  const materialMap = new Map(materials.map(m => [m.id, m]));

  const tableData = [
    [
      chalk.bold('#'),
      chalk.bold('问题ID'),
      chalk.bold('素材'),
      chalk.bold('类型'),
      chalk.bold('严重度'),
      chalk.bold('状态'),
      chalk.bold('描述')
    ]
  ];

  problems.forEach((problem, index) => {
    const material = materialMap.get(problem.materialId);
    const severityColor = {
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.blue
    }[problem.severity] || chalk.white;

    const statusColor = {
      [PROBLEM_STATUS.OPEN]: chalk.red,
      [PROBLEM_STATUS.WAIVED]: chalk.yellow,
      [PROBLEM_STATUS.RESOLVED]: chalk.green
    }[problem.status] || chalk.white;

    const statusName = {
      [PROBLEM_STATUS.OPEN]: '待处理',
      [PROBLEM_STATUS.WAIVED]: '已豁免',
      [PROBLEM_STATUS.RESOLVED]: '已解决'
    }[problem.status] || problem.status;

    const typeName = {
      [PROBLEM_TYPES.TITLE_DUPLICATE]: '标题重复',
      [PROBLEM_TYPES.COVER_MISSING]: '封面缺失',
      [PROBLEM_TYPES.SCHEDULE_CONFLICT]: '排期冲突',
      [PROBLEM_TYPES.SENSITIVE_WORD]: '敏感词',
      [PROBLEM_TYPES.GOLDEN_HOUR_CONSECUTIVE]: '黄金时段',
      [PROBLEM_TYPES.WAIVER_EXPIRED]: '豁免过期'
    }[problem.type] || problem.type;

    tableData.push([
      String(index + 1),
      problem.id.substring(0, 20) + '...',
      (material?.title || '未知').substring(0, 15),
      typeName,
      severityColor(problem.severity === 'high' ? '高' : problem.severity === 'medium' ? '中' : '低'),
      statusColor(statusName),
      problem.message.substring(0, 40)
    ]);
  });

  console.log(table(tableData, {
    columns: {
      0: { width: 4 },
      1: { width: 22 },
      2: { width: 17 },
      3: { width: 10 },
      4: { width: 8 },
      5: { width: 8 },
      6: { width: 42 }
    }
  }));
}

program
  .command('list-problems')
  .description('列出所有问题')
  .option('--status <status>', '按状态筛选 (open/waived/resolved)')
  .option('--severity <severity>', '按严重度筛选 (high/medium/low)')
  .option('--editor <editor>', '按编辑筛选')
  .action((options) => {
    const materials = store.getAllMaterials();
    let problems = store.getAllProblems();

    if (options.status) {
      problems = problems.filter(p => p.status === options.status);
    }
    if (options.severity) {
      problems = problems.filter(p => p.severity === options.severity);
    }
    if (options.editor) {
      const editorMaterialIds = materials
        .filter(m => m.editor && m.editor.includes(options.editor))
        .map(m => m.id);
      problems = problems.filter(p => editorMaterialIds.includes(p.materialId));
    }

    printProblems(problems, materials);
  });

program
  .command('show-problem <problemId>')
  .description('查看问题详情')
  .action((problemId) => {
    const materials = store.getAllMaterials();
    const problems = store.getAllProblems();
    const waivers = store.getAllWaivers();

    const problem = problems.find(p => p.id === problemId);
    if (!problem) {
      console.error(chalk.red(`✗ 未找到问题: ${problemId}`));
      process.exit(1);
    }

    const material = materials.find(m => m.id === problem.materialId);
    const problemWaivers = waivers.filter(w => w.problemId === problemId);

    console.log(chalk.white('\n━━━ 问题详情 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white(`  问题ID: ${chalk.cyan(problem.id)}`));
    console.log(chalk.white(`  类型: ${chalk.yellow(problem.title)}`));
    console.log(chalk.white(`  描述: ${problem.message}`));
    console.log(chalk.white(`  严重度: ${problem.severity === 'high' ? chalk.red('高') : problem.severity === 'medium' ? chalk.yellow('中') : chalk.blue('低')}`));
    console.log(chalk.white(`  状态: ${problem.status === PROBLEM_STATUS.OPEN ? chalk.red('待处理') : problem.status === PROBLEM_STATUS.WAIVED ? chalk.yellow('已豁免') : chalk.green('已解决')}`));

    if (material) {
      console.log(chalk.white('\n━━━ 关联素材 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      console.log(chalk.white(`  标题: ${material.title}`));
      console.log(chalk.white(`  作者: ${material.author || '-'}`));
      console.log(chalk.white(`  编辑: ${material.editor || '-'}`));
      console.log(chalk.white(`  封面: ${material.cover || chalk.red('缺失')}`));
    }

    console.log(chalk.white('\n━━━ 详细信息 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(JSON.stringify(problem.details, null, 2));

    if (problemWaivers.length > 0) {
      console.log(chalk.white('\n━━━ 豁免记录 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
      problemWaivers.forEach((w, i) => {
        const isExpired = new Date(w.expiresAt) <= new Date();
        console.log(chalk.white(`  [${i + 1}] 原因: ${w.reason}`));
        console.log(chalk.white(`      过期时间: ${w.expiresAt} ${isExpired ? chalk.red('(已过期)') : chalk.green('(有效)')}`));
      });
    }
  });

program
  .command('waive <problemId> <reason>')
  .description('添加人工豁免')
  .option('--days <days>', '豁免天数 (默认7天)', '7')
  .action((problemId, reason, options) => {
    const result = waiverManager.addWaiver(problemId, reason, parseInt(options.days));

    if (!result.success) {
      console.error(chalk.red(`✗ 添加豁免失败: ${result.error}`));
      process.exit(1);
    }

    console.log(chalk.green('✓ 豁免已添加'));
    console.log(chalk.white(`  过期时间: ${result.waiver.expiresAt}`));
    console.log(chalk.white(`  重新检查后: 待处理 ${result.checkResult.open}, 已豁免 ${result.checkResult.waived}`));
  });

program
  .command('list-waivers')
  .description('列出所有豁免')
  .option('--active', '只显示有效豁免')
  .option('--expired', '只显示过期豁免')
  .action((options) => {
    const waivers = waiverManager.listWaivers();
    let filtered = waivers;

    if (options.active) {
      filtered = waivers.filter(w => !w.isExpired);
    } else if (options.expired) {
      filtered = waivers.filter(w => w.isExpired);
    }

    if (filtered.length === 0) {
      console.log(chalk.gray('暂无豁免记录'));
      return;
    }

    const tableData = [
      [
        chalk.bold('#'),
        chalk.bold('素材'),
        chalk.bold('问题'),
        chalk.bold('原因'),
        chalk.bold('状态'),
        chalk.bold('剩余天数')
      ]
    ];

    filtered.forEach((w, i) => {
      tableData.push([
        String(i + 1),
        (w.materialTitle || '').substring(0, 15),
        (w.problemTitle || '').substring(0, 15),
        w.reason.substring(0, 20),
        w.isExpired ? chalk.red('已过期') : chalk.green('有效'),
        String(w.daysRemaining)
      ]);
    });

    console.log(table(tableData, {
      columns: {
        0: { width: 4 },
        1: { width: 17 },
        2: { width: 17 },
        3: { width: 22 },
        4: { width: 8 },
        5: { width: 10 }
      }
    }));
  });

program
  .command('export <outputPath>')
  .description('导出发布清单')
  .option('--editor <editor>', '按编辑筛选')
  .option('--date <date>', '按日期筛选 (YYYY-MM-DD)')
  .option('--ready-only', '只导出可发布的')
  .option('--needs-review', '只导出需修改的')
  .action((outputPath, options) => {
    const result = exporter.exportPublishList(outputPath, options);

    console.log(chalk.green('✓ 发布清单已导出'));
    console.log(chalk.white(`  路径: ${outputPath}`));
    console.log(chalk.white(`  总数: ${result.total}`));
    console.log(chalk.green(`  可发布: ${result.ready}`));
    console.log(chalk.yellow(`  需修改: ${result.needsReview}`));
  });

program
  .command('export-problems <outputPath>')
  .description('导出问题清单')
  .option('--editor <editor>', '按编辑筛选')
  .option('--status <status>', '按状态筛选')
  .action((outputPath, options) => {
    const result = exporter.exportProblems(outputPath, options);

    console.log(chalk.green('✓ 问题清单已导出'));
    console.log(chalk.white(`  路径: ${outputPath}`));
    console.log(chalk.white(`  问题数: ${result.total}`));
  });

program
  .command('status')
  .description('查看当前状态概览')
  .action(() => {
    const materials = store.getAllMaterials();
    const schedules = store.getAllSchedules();
    const sensitiveWords = store.getAllSensitiveWords();
    const problems = store.getAllProblems();
    const waivers = store.getAllWaivers();

    const openProblems = problems.filter(p => p.status === PROBLEM_STATUS.OPEN);
    const waivedProblems = problems.filter(p => p.status === PROBLEM_STATUS.WAIVED);

    const activeWaivers = waivers.filter(w => new Date(w.expiresAt) > new Date());
    const expiredWaivers = waivers.filter(w => new Date(w.expiresAt) <= new Date());

    console.log(chalk.white('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.white('        公众号素材发布状态概览'));
    console.log(chalk.white('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    console.log(chalk.white('\n  数据统计'));
    console.log(chalk.white(`    素材数: ${materials.length}`));
    console.log(chalk.white(`    排期数: ${schedules.length}`));
    console.log(chalk.white(`    敏感词: ${sensitiveWords.length}`));

    console.log(chalk.white('\n  问题统计'));
    console.log(chalk.red(`    待处理: ${openProblems.length}`));
    console.log(chalk.yellow(`    已豁免: ${waivedProblems.length}`));

    console.log(chalk.white('\n  豁免统计'));
    console.log(chalk.green(`    有效: ${activeWaivers.length}`));
    console.log(chalk.red(`    过期: ${expiredWaivers.length}`));

    if (openProblems.length === 0) {
      console.log(chalk.green('\n  ✓ 所有素材均可发布!'));
    } else {
      console.log(chalk.yellow('\n  ⚠ 存在待处理问题，请使用 list-problems 查看详情'));
    }
    console.log('');
  });

program
  .command('reset')
  .description('重置所有数据')
  .option('--force', '不提示确认')
  .action((options) => {
    if (!options.force) {
      console.log(chalk.yellow('⚠ 这将删除所有数据。使用 --force 选项确认'));
      return;
    }
    store.reset();
    console.log(chalk.green('✓ 所有数据已重置'));
  });

program.parse(process.argv);