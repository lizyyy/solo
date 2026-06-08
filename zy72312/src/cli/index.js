#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { dataStore } from '../models/index.js';
import {
  processAllAnswers,
  createReviewRecord,
  updateWithQuestionnaire,
  updateWithManualExample,
  generateReport,
  approveRecord
} from '../review/engine.js';
import { analyzeGeometry } from '../geometry/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();

program
  .name('convex-fence-review')
  .description('凸包围栏面积复核系统')
  .version('1.0.0');

program
  .command('import <file>')
  .description('导入学生答案数据')
  .action(async (file) => {
    try {
      const filePath = path.resolve(file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      dataStore.loadFromFiles();

      let count = 0;
      data.forEach(answer => {
        if (dataStore.addStudentAnswer(answer)) {
          count++;
        }
      });

      dataStore.saveToFiles();

      console.log(chalk.green(`✓ 成功导入 ${count} 条学生答案记录`));
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
    }
  });

program
  .command('import-manual <file>')
  .description('导入手算反例数据')
  .action(async (file) => {
    try {
      const filePath = path.resolve(file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      dataStore.loadFromFiles();

      data.forEach(example => {
        dataStore.addManualExample(example);
      });

      dataStore.saveToFiles();

      console.log(chalk.green(`✓ 成功导入 ${data.length} 条手算反例记录`));
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
    }
  });

program
  .command('import-questionnaire <file>')
  .description('导入问卷原始行数据')
  .action(async (file) => {
    try {
      const filePath = path.resolve(file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      dataStore.loadFromFiles();

      data.forEach(questionnaire => {
        dataStore.addQuestionnaire(questionnaire);
      });

      dataStore.saveToFiles();

      console.log(chalk.green(`✓ 成功导入 ${data.length} 条问卷记录`));
    } catch (error) {
      console.error(chalk.red(`✗ 导入失败: ${error.message}`));
    }
  });

program
  .command('review')
  .description('执行复核处理')
  .action(async () => {
    try {
      dataStore.loadFromFiles();
      const records = processAllAnswers();

      console.log(chalk.green(`✓ 已创建 ${records.length} 条复核记录`));
      console.log();

      const table = new Table({
        head: ['学生ID', '答案ID', '状态', '多版本', '下一步'],
        colWidths: [12, 12, 20, 10, 20]
      });

      records.forEach(record => {
        table.push([
          record.studentId,
          record.answerId,
          getStatusText(record.status),
          record.hasMultipleVersions ? chalk.yellow('是') : chalk.gray('否'),
          record.nextStep
        ]);
      });

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red(`✗ 复核失败: ${error.message}`));
      console.error(error.stack);
    }
  });

program
  .command('list')
  .description('列出所有复核记录')
  .action(async () => {
    try {
      dataStore.loadFromFiles();
      const records = dataStore.getAllReviewRecords();

      const table = new Table({
        head: ['记录ID', '学生', '答案', '状态', '多版本', '分配给'],
        colWidths: [30, 10, 10, 20, 10, 15]
      });

      records.forEach(record => {
        table.push([
          record.id.substring(0, 28) + '...',
          record.studentId,
          record.answerId,
          getStatusText(record.status),
          record.hasMultipleVersions ? chalk.yellow('是') : chalk.gray('否'),
          record.assignedTo || '-'
        ]);
      });

      console.log(table.toString());
      console.log(chalk.gray(`\n共 ${records.length} 条记录`));
    } catch (error) {
      console.error(chalk.red(`✗ 操作失败: ${error.message}`));
    }
  });

program
  .command('show <recordId>')
  .description('查看复核记录详情')
  .action(async (recordId) => {
    try {
      dataStore.loadFromFiles();
      const fullRecord = dataStore.reviewRecords.find(r => r.id.startsWith(recordId) || r.id === recordId);

      if (!fullRecord) {
        console.log(chalk.yellow('未找到该记录'));
        return;
      }

      const report = generateReport(fullRecord.id);

      console.log(chalk.bold.blue('\n══════════════════════════════════════════════'));
      console.log(chalk.bold.blue('           凸包围栏面积复核报告'));
      console.log(chalk.bold.blue('══════════════════════════════════════════════\n'));

      console.log(chalk.bold('【基本信息】'));
      console.log(`  记录ID: ${report.record.id}`);
      console.log(`  学生ID: ${report.record.studentId}`);
      console.log(`  答案ID: ${report.record.answerId}`);
      console.log(`  状态: ${getStatusText(report.record.status)}`);
      console.log(`  创建时间: ${report.record.createdAt}`);
      console.log();

      if (report.record.hasMultipleVersions) {
        console.log(chalk.bold.yellow('⚠  同一学生有多版答案'));
        report.record.versions.forEach((v, i) => {
          console.log(`  版本 ${v.version}: ${v.submittedAt} (${v.source})`);
        });
        console.log();
      }

      console.log(chalk.bold('【几何分析】'));
      const geo = report.record.geometryAnalysis;
      if (geo) {
        console.log(`  原始面积: ${geo.rawArea.toFixed(2)} 平方米`);
        console.log(`  凸包面积: ${geo.convexArea.toFixed(2)} 平方米`);
        console.log(`  面积差值: ${geo.areaDiff.toFixed(2)} 平方米 (${(geo.areaDiffRatio * 100).toFixed(1)}%)`);
        console.log(`  是否凸多边形: ${geo.isConvex ? chalk.green('是') : chalk.red('否')}`);
        console.log(`  环绕方向: ${getWindingText(geo.windingOrder)}`);
        console.log();

        if (geo.issues && geo.issues.length > 0) {
          console.log(chalk.bold.red('  问题列表:'));
          geo.issues.forEach((issue, i) => {
            console.log(`    ${i + 1}. ${issue.message}`);
          });
          console.log();
        }

        if (geo.problemEdges && geo.problemEdges.length > 0) {
          console.log(chalk.bold.red('  问题边:'));
          geo.problemEdges.forEach((edge, i) => {
            console.log(`    ${i + 1}. (${edge.start.x}, ${edge.start.y}) → (${edge.end.x}, ${edge.end.y})`);
          });
          console.log();
        }
      }

      console.log(chalk.bold('【证据来源】'));
      console.log(`  手算反例: ${report.record.manualExample ? chalk.green('✓ 有') : chalk.red('✗ 缺少')}`);
      console.log(`  问卷原始行: ${report.record.questionnaire ? chalk.green('✓ 有') : chalk.red('✗ 缺少')}`);
      console.log();

      if (report.record.manualExample) {
        console.log(chalk.bold('  手算反例详情:'));
        console.log(`    审核人: ${report.record.manualExample.reviewer}`);
        console.log(`    期望面积: ${report.record.manualExample.expectedArea}`);
        console.log(`    实际面积: ${report.record.manualExample.actualArea}`);
        console.log(`    备注: ${report.record.manualExample.notes}`);
        console.log();
      }

      if (report.record.questionnaire) {
        console.log(chalk.bold('  问卷原始行 - 现场说法:'));
        console.log(`    ${report.record.questionnaire.siteStatement}`);
        console.log(`    调查员: ${report.record.questionnaire.interviewer}`);
        console.log(`    补充说明: ${report.record.questionnaire.additionalNotes}`);
        console.log();
      }

      console.log(chalk.bold.red('【误差说明 - 为什么被留下】'));
      console.log(report.record.errorAnalysis ? report.record.errorAnalysis.split('\n').map(l => '  ' + l).join('\n') : '  暂无');
      console.log();

      console.log(chalk.bold.cyan('【下一步行动 - 找谁、做什么】'));
      const nextDetail = report.record.nextStepDetail || report.summary.nextStepDetail || '暂无';
      console.log(nextDetail.split('\n').map(l => '  ' + l).join('\n'));
      console.log();

      console.log(chalk.bold('【摘要汇总】'));
      const s = report.summary;
      console.log(`  分配给：${report.record.assignedTo || s.assignedTo || '(未分配)'}`);
      console.log(`  证据齐全度：手算反例 ${s.hasManual ? '✓' : '✗'} / 问卷原始行 ${s.hasQuestionnaire ? '✓' : '✗'}`);
      console.log(`  几何问题：${s.issuesByType.total} 项 (凹点${s.issuesByType.concave || 0} / 重复${s.issuesByType.duplicate || 0} / 顺逆${s.issuesByType.winding || 0})`);
      console.log(`  问题边数：${s.problemEdgeCount || 0} 条`);
      console.log();

      console.log(chalk.bold('【处理历史 - 保留全部痕迹，不提前归正常】'));
      report.record.reviewHistory.forEach((entry, i) => {
        const ts = entry.timestamp ? entry.timestamp.substring(0, 19) : '未知时间';
        console.log(`  ${i + 1}. [${ts}] ${entry.action} - ${entry.message}`);
        if (entry.processReason) console.log(chalk.gray(`     原因：${entry.processReason}`));
        if (entry.snapshotBefore && entry.snapshotAfter) {
          const sb = entry.snapshotBefore;
          const sa = entry.snapshotAfter;
          const diffs = [];
          if (sb.status !== sa.status) diffs.push(`状态: ${sb.status}→${sa.status}`);
          if (sb.nextStep !== sa.nextStep) diffs.push(`找谁: ${sb.nextStep}→${sa.nextStep}`);
          if (sb.manualExample !== sa.manualExample) diffs.push(`手算: ${sb.manualExample}→${sa.manualExample}`);
          if (sb.questionnaire !== sa.questionnaire) diffs.push(`问卷: ${sb.questionnaire}→${sa.questionnaire}`);
          if (diffs.length > 0) console.log(chalk.gray('     变化：' + diffs.join(' / ')));
        }
      });
      console.log();

      console.log(chalk.bold('【正式报告文本（可直接导出）】'));
      console.log(chalk.gray(report.humanReport.split('\n').map(l => '  ' + l).join('\n')));
      console.log();

      console.log(chalk.bold.blue('══════════════════════════════════════════════\n'));

    } catch (error) {
      console.error(chalk.red(`✗ 操作失败: ${error.message}`));
      console.error(error.stack);
    }
  });

program
  .command('add-questionnaire <recordId>')
  .description('补充问卷原始行')
  .option('-s, --statement <text>', '现场说法')
  .option('-i, --interviewer <name>', '调查员')
  .action(async (recordId, options) => {
    try {
      dataStore.loadFromFiles();
      const fullRecord = dataStore.reviewRecords.find(r => r.id.startsWith(recordId) || r.id === recordId);

      if (!fullRecord) {
        console.log(chalk.yellow('未找到该记录'));
        return;
      }

      const questionnaireData = {
        id: `Q${Date.now()}`,
        studentId: fullRecord.studentId,
        answerId: fullRecord.answerId,
        siteStatement: options.statement || '现场说法补充中...',
        interviewer: options.interviewer || '吴老师'
      };

      const updated = updateWithQuestionnaire(fullRecord.id, questionnaireData);

      console.log(chalk.green('✓ 已补充问卷原始行，误差说明已更新'));
      console.log(chalk.gray(`新的下一步: ${updated.nextStep}`));
    } catch (error) {
      console.error(chalk.red(`✗ 操作失败: ${error.message}`));
      console.error(error.stack);
    }
  });

program
  .command('approve <recordId> [approver]')
  .description('批准复核记录')
  .action(async (recordId, approver = '系统') => {
    try {
      dataStore.loadFromFiles();
      const fullRecord = dataStore.reviewRecords.find(r => r.id.startsWith(recordId) || r.id === recordId);

      if (!fullRecord) {
        console.log(chalk.yellow('未找到该记录'));
        return;
      }

      approveRecord(fullRecord.id, approver);
      console.log(chalk.green(`✓ 已由 ${approver} 批准通过`));
    } catch (error) {
      console.error(chalk.red(`✗ 操作失败: ${error.message}`));
    }
  });

program
  .command('demo')
  .description('运行完整演示流程')
  .action(async () => {
    console.log(chalk.bold.blue('\n══════════════════════════════════════════════'));
    console.log(chalk.bold.blue('        凸包围栏面积复核系统 - 演示流程'));
    console.log(chalk.bold.blue('══════════════════════════════════════════════\n'));

    const dataDir = path.resolve(__dirname, '../../data');

    console.log(chalk.cyan('步骤 1: 导入学生答案数据'));
    const answersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'sample-student-answers.json'), 'utf-8'));
    dataStore.loadFromFiles();
    answersData.forEach(a => dataStore.addStudentAnswer(a));
    dataStore.saveToFiles();
    console.log(chalk.green(`  ✓ 导入 ${answersData.length} 条学生答案`));
    console.log();

    console.log(chalk.cyan('步骤 2: 执行复核处理'));
    const records = processAllAnswers();
    console.log(chalk.green(`  ✓ 创建 ${records.length} 条复核记录`));
    const multiVersionCount = records.filter(r => r.hasMultipleVersions).length;
    if (multiVersionCount > 0) {
      console.log(chalk.yellow(`  ⚠ 发现 ${multiVersionCount} 名学生提交了多版答案，留待业务运营复核`));
    }
    console.log();

    console.log(chalk.cyan('步骤 3: 显示复核记录列表'));
    const table = new Table({
      head: ['学生', '答案', '状态', '多版本', '下一步'],
      colWidths: [10, 10, 22, 10, 20]
    });
    records.forEach(record => {
      table.push([
        record.studentId,
        record.answerId,
        getStatusText(record.status),
        record.hasMultipleVersions ? chalk.yellow('是') : '否',
        record.nextStep
      ]);
    });
    console.log(table.toString());
    console.log();

    console.log(chalk.cyan('步骤 4: 模拟吴老师补看问卷原始行（S002 李四 - 有凹点）'));
    const s002 = records.find(r => r.studentId === 'S002');
    let s002Id = s002 ? s002.id : null;
    if (s002Id) {
      const qData = {
        id: 'Q-DEMO-001',
        studentId: 'S002',
        answerId: 'A001',
        siteStatement: '学生李四现场解释：中间凹进去的地方是因为要避开一棵大树，实际测量时特意留出的空间。现场测量数据和草图都显示此区域确实有凹陷。',
        interviewer: '吴老师',
        additionalNotes: '已核实，大树确实在现场，凹点为合理情况'
      };
      updateWithQuestionnaire(s002Id, qData);
      console.log(chalk.green('  ✓ 已为 S002 补充问卷原始行，误差说明与下一步已重新计算'));
    }
    console.log();

    console.log(chalk.cyan('步骤 5: 再次查看 S002 复核详情（误差说明、下一步、历史都要跟着变）'));
    if (s002Id) {
      dataStore.loadFromFiles();
      const rpt = generateReport(s002Id);
      console.log(chalk.bold('  误差说明（变化："还缺什么材料"里问卷那一项消失）:'));
      console.log(chalk.gray(rpt.record.errorAnalysis.split('\n').map(l => '    ' + l).join('\n')));
      console.log();
      console.log(chalk.bold('  下一步行动（变化：从"缺问卷"变为"人工复核几何问题"）:'));
      const nd = rpt.record.nextStepDetail || rpt.record.nextStep || '暂无';
      console.log(chalk.gray(String(nd).split('\n').map(l => '    ' + l).join('\n')));
      console.log();
      console.log(chalk.bold('  摘要汇总：'));
      const sm = rpt.summary;
      console.log(chalk.gray(`    分配给：${sm.assignedTo}　问题：${sm.issuesByType.total}项　手算${sm.hasManual ? '✓' : '✗'}问卷${sm.hasQuestionnaire ? '✓' : '✗'}`));
    }
    console.log();

    console.log(chalk.cyan('步骤 6: 人工批准 S003（王五 - 重复坐标），保留痕迹不提前归正常'));
    const s003 = records.find(r => r.studentId === 'S003');
    if (s003) {
      approveRecord(s003.id, '吴老师', '重复坐标为录入多一步，面积与手算反例一致，批注通过');
      console.log(chalk.green('  ✓ S003 已批准，历史中保留"批准时仍有未清事项"的说明'));
    }
    console.log();

    console.log(chalk.bold.green('✓ 演示完成！建议对照操作：'));
    console.log(chalk.gray('  1. npm run cli -- list          看列表：状态/下一步/分配给都一致'));
    console.log(chalk.gray(`  2. npm run cli -- show ${s002Id ? s002Id.substring(0, 24) : 'S002记录ID'}  看详情：误差/下一步/历史/报告都同步`));
    console.log(chalk.gray('  3. npm run server               小看板：点 S002 查看可视化与补录按钮\n'));
  });

function getStatusText(status) {
  const statusMap = {
    'pending': chalk.yellow('待处理'),
    'needs-operation-review': chalk.magenta('需运营复核'),
    'updated': chalk.blue('已更新'),
    'approved': chalk.green('已批准')
  };
  return statusMap[status] || status;
}

function getWindingText(order) {
  const map = {
    'counter-clockwise': chalk.green('逆时针(标准)'),
    'clockwise': chalk.yellow('顺时针'),
    'collinear': chalk.red('共线'),
    'unknown': chalk.gray('未知')
  };
  return map[order] || order;
}

program.parse(process.argv);
