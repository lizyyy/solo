const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const chalk = require('chalk');
const Table = require('cli-table3');

class Reporter {
  constructor(dataStore, outputDir = null) {
    this.dataStore = dataStore;
    this.outputDir = outputDir || path.join(process.cwd(), 'data', 'reports');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateFullReport(date = null, format = 'console') {
    const data = this.dataStore.load();
    const tasks = date 
      ? data.tasks.filter(t => t.date === date)
      : data.tasks;

    const report = {
      generatedAt: new Date().toISOString(),
      dateFilter: date,
      summary: this.generateSummary(tasks),
      failedTasks: this.generateFailedTasksReport(tasks),
      sourceEvidence: this.generateSourceEvidenceReport(tasks),
      auditTrail: this.generateAuditTrailReport(tasks),
      importSessions: data.importSessions
    };

    if (format === 'json') {
      return this.saveJsonReport(report, 'full');
    } else if (format === 'csv') {
      return this.saveCsvReports(report);
    } else {
      return this.printConsoleReport(report);
    }
  }

  generateSummary(tasks) {
    const summary = {
      total: tasks.length,
      byStatus: {},
      byType: {},
      bySource: {},
      conflicts: {
        total: 0,
        resolved: 0,
        unresolved: 0,
        byType: {}
      },
      overrides: tasks.filter(t => t.manualOverride).length,
      frozen: tasks.filter(t => t.isFrozen).length
    };

    tasks.forEach(task => {
      summary.byStatus[task.status] = (summary.byStatus[task.status] || 0) + 1;
      summary.byType[task.type] = (summary.byType[task.type] || 0) + 1;
      
      task.sourceEvidences.forEach(e => {
        summary.bySource[e.sourceType] = (summary.bySource[e.sourceType] || 0) + 1;
      });

      task.conflicts.forEach(c => {
        summary.conflicts.total++;
        summary.conflicts.byType[c.type] = (summary.conflicts.byType[c.type] || 0) + 1;
        if (c.resolved) {
          summary.conflicts.resolved++;
        } else {
          summary.conflicts.unresolved++;
        }
      });
    });

    return summary;
  }

  generateFailedTasksReport(tasks) {
    const failedTasks = tasks.filter(t => 
      t.status === 'failed' || t.conflicts.some(c => !c.resolved)
    );

    return failedTasks.map(task => {
      const unresolvedConflicts = task.conflicts.filter(c => !c.resolved);
      const resolvedConflicts = task.conflicts.filter(c => c.resolved);

      return {
        taskId: task.id,
        roomNumber: task.roomNumber,
        date: task.date,
        type: task.type,
        status: task.status,
        hasManualOverride: !!task.manualOverride,
        unresolvedConflicts: unresolvedConflicts.map(c => ({
          conflictId: c.id,
          type: c.type,
          description: c.description,
          evidence: c.evidence
        })),
        resolvedConflicts: resolvedConflicts.map(c => ({
          conflictId: c.id,
          type: c.type,
          resolution: c.resolution
        })),
        sources: task.sourceEvidences.map(e => ({
          sourceType: e.sourceType,
          fileName: e.fileName,
          lineNumber: e.lineNumber,
          rawContent: e.rawContent
        }))
      };
    });
  }

  generateSourceEvidenceReport(tasks) {
    const evidenceList = [];

    tasks.forEach(task => {
      task.sourceEvidences.forEach(evidence => {
        evidenceList.push({
          taskId: task.id,
          roomNumber: task.roomNumber,
          taskDate: task.date,
          taskType: task.type,
          sourceType: evidence.sourceType,
          fileName: evidence.fileName,
          lineNumber: evidence.lineNumber,
          rawContent: evidence.rawContent.substring(0, 200),
          parsedValue: JSON.stringify(evidence.parsedValue).substring(0, 300),
          importedAt: evidence.importedAt
        });
      });
    });

    return evidenceList.sort((a, b) => {
      if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
      return a.lineNumber - b.lineNumber;
    });
  }

  generateAuditTrailReport(tasks) {
    const allTrails = [];

    tasks.forEach(task => {
      task.auditTrail.forEach(trail => {
        allTrails.push({
          taskId: task.id,
          roomNumber: task.roomNumber,
          date: task.date,
          trailId: trail.id,
          timestamp: trail.timestamp,
          operator: trail.operator,
          reason: trail.reason
        });
      });
    });

    return allTrails.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  printConsoleReport(report) {
    console.log('\n' + chalk.bgBlue.white('='.repeat(80)));
    console.log(chalk.bgBlue.white('  民宿保洁排班巡检报告'));
    console.log(chalk.bgBlue.white('='.repeat(80)));
    console.log(chalk.gray(`生成时间: ${report.generatedAt}`));
    if (report.dateFilter) {
      console.log(chalk.gray(`日期过滤: ${report.dateFilter}`));
    }
    console.log('');

    this.printSummaryTable(report.summary);
    this.printFailedTasksTable(report.failedTasks);
    this.printSourceEvidenceTable(report.sourceEvidence.slice(0, 20));

    console.log('');
    console.log(chalk.yellow('提示: 使用 --format json 或 --format csv 获取完整详细报告'));
    console.log('');

    return report;
  }

  printSummaryTable(summary) {
    console.log(chalk.bold.green('【汇总统计】'));
    
    const table = new Table({
      head: ['指标', '数值'],
      colWidths: [40, 35]
    });

    table.push(['总任务数', summary.total]);
    table.push(['已冻结', summary.frozen]);
    table.push(['人工改判', summary.overrides]);
    table.push(['--- 按状态 ---', '']);
    Object.entries(summary.byStatus).forEach(([status, count]) => {
      table.push([`  ${status}`, count]);
    });
    table.push(['--- 冲突统计 ---', '']);
    table.push(['  总冲突数', summary.conflicts.total]);
    table.push(['  已解决', summary.conflicts.resolved]);
    table.push(['  待解决', chalk.red(summary.conflicts.unresolved)]);

    console.log(table.toString());
    console.log('');
  }

  printFailedTasksTable(failedTasks) {
    if (failedTasks.length === 0) {
      console.log(chalk.bold.green('【失败任务】无失败任务 ✓'));
      console.log('');
      return;
    }

    console.log(chalk.bold.red(`【失败任务】共 ${failedTasks.length} 条`));
    
    const table = new Table({
      head: ['房间', '日期', '类型', '状态', '未解决冲突', '来源文件:行号'],
      colWidths: [10, 15, 15, 12, 35, 35]
    });

    failedTasks.forEach(task => {
      const conflictTypes = task.unresolvedConflicts.map(c => c.type).join(', ');
      const sourceInfo = task.sources
        .map(s => `${s.fileName}:${s.lineNumber}`)
        .join('; ');

      table.push([
        task.roomNumber,
        task.date,
        task.type,
        chalk.red(task.status),
        conflictTypes,
        sourceInfo.substring(0, 30)
      ]);
    });

    console.log(table.toString());

    console.log(chalk.gray('\n--- 失败任务详情 ---'));
    failedTasks.forEach((task, idx) => {
      console.log(`\n${idx + 1}. 房间 ${task.roomNumber} (${task.date}) - 任务ID: ${task.taskId}`);
      console.log(`   类型: ${task.type} | 状态: ${task.status}`);
      
      task.unresolvedConflicts.forEach((c, ci) => {
        console.log(`   冲突 ${ci + 1}: ${chalk.red(c.type)} - ${c.description}`);
      });

      console.log(`   来源证据:`);
      task.sources.forEach((s, si) => {
        console.log(`     [${si + 1}] ${s.sourceType} @ ${s.fileName}:${s.lineNumber}`);
        console.log(`         原始: ${s.rawContent.substring(0, 80)}`);
      });

      if (task.resolvedConflicts.length > 0) {
        console.log(`   已解决冲突:`);
        task.resolvedConflicts.forEach(c => {
          console.log(`     ✓ ${c.type} - ${c.resolution.method} (${c.resolution.operator})`);
        });
      }
    });
    console.log('');
  }

  printSourceEvidenceTable(evidenceList) {
    if (evidenceList.length === 0) return;

    console.log(chalk.bold.blue(`【来源证据追踪】(显示前${evidenceList.length}条)`));
    
    const table = new Table({
      head: ['来源文件', '行号', '类型', '房间', '原始内容'],
      colWidths: [25, 8, 18, 10, 40]
    });

    evidenceList.forEach(e => {
      table.push([
        e.fileName,
        e.lineNumber,
        e.sourceType,
        e.roomNumber,
        e.rawContent.substring(0, 35)
      ]);
    });

    console.log(table.toString());
    console.log('');
  }

  saveJsonReport(report, type) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `report-${type}-${timestamp}.json`;
    const filePath = path.join(this.outputDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`JSON报告已保存: ${filePath}`));
    
    return { filePath, report };
  }

  saveCsvReports(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const files = [];

    const summaryCsv = stringify([
      ['指标', '数值'],
      ['生成时间', report.generatedAt],
      ['总任务数', report.summary.total],
      ['已冻结', report.summary.frozen],
      ['人工改判', report.summary.overrides],
      ...Object.entries(report.summary.byStatus).map(([k, v]) => [`状态:${k}`, v]),
      ...Object.entries(report.summary.byType).map(([k, v]) => [`类型:${k}`, v]),
      ...Object.entries(report.summary.bySource).map(([k, v]) => [`来源:${k}`, v])
    ]);
    const summaryPath = path.join(this.outputDir, `report-summary-${timestamp}.csv`);
    fs.writeFileSync(summaryPath, summaryCsv);
    files.push({ type: 'summary', path: summaryPath });

    const failedCsv = stringify([
      ['任务ID', '房间号', '日期', '类型', '状态', '冲突类型', '来源文件', '原始行号', '原始内容'],
      ...report.failedTasks.flatMap(task => 
        task.unresolvedConflicts.flatMap(conflict =>
          task.sources.map(source => [
            task.taskId,
            task.roomNumber,
            task.date,
            task.type,
            task.status,
            conflict.type,
            source.fileName,
            source.lineNumber,
            source.rawContent.replace(/\n/g, ' ')
          ])
        )
      )
    ]);
    const failedPath = path.join(this.outputDir, `report-failed-${timestamp}.csv`);
    fs.writeFileSync(failedPath, failedCsv);
    files.push({ type: 'failed', path: failedPath });

    const evidenceCsv = stringify([
      ['任务ID', '房间号', '任务日期', '来源类型', '来源文件', '原始行号', '原始内容', '导入时间'],
      ...report.sourceEvidence.map(e => [
        e.taskId,
        e.roomNumber,
        e.taskDate,
        e.sourceType,
        e.fileName,
        e.lineNumber,
        e.rawContent.replace(/\n/g, ' '),
        e.importedAt
      ])
    ]);
    const evidencePath = path.join(this.outputDir, `report-evidence-${timestamp}.csv`);
    fs.writeFileSync(evidencePath, evidenceCsv);
    files.push({ type: 'evidence', path: evidencePath });

    const auditCsv = stringify([
      ['任务ID', '房间号', '任务日期', '操作时间', '操作者', '操作原因'],
      ...report.auditTrail.map(t => [
        t.taskId,
        t.roomNumber,
        t.date,
        t.timestamp,
        t.operator,
        t.reason
      ])
    ]);
    const auditPath = path.join(this.outputDir, `report-audit-${timestamp}.csv`);
    fs.writeFileSync(auditPath, auditCsv);
    files.push({ type: 'audit', path: auditPath });

    console.log(chalk.green(`CSV报告已生成:`));
    files.forEach(f => console.log(`  - ${f.type}: ${f.path}`));

    return { files, report };
  }

  generateCompareReport(beforeSnapshot, afterSnapshot) {
    const before = beforeSnapshot.data;
    const after = afterSnapshot.data;

    const comparison = {
      generatedAt: new Date().toISOString(),
      beforeTime: beforeSnapshot.timestamp,
      afterTime: afterSnapshot.timestamp,
      changes: []
    };

    const beforeTaskMap = new Map(before.tasks.map(t => [t.id, t]));
    const afterTaskMap = new Map(after.tasks.map(t => [t.id, t]));

    after.tasks.forEach(afterTask => {
      const beforeTask = beforeTaskMap.get(afterTask.id);
      if (!beforeTask) {
        comparison.changes.push({
          type: 'added',
          taskId: afterTask.id,
          roomNumber: afterTask.roomNumber,
          date: afterTask.date,
          after: { status: afterTask.status, conflicts: afterTask.conflicts.length }
        });
      } else if (beforeTask.status !== afterTask.status || 
                 beforeTask.conflicts.filter(c => !c.resolved).length !== 
                 afterTask.conflicts.filter(c => !c.resolved).length) {
        comparison.changes.push({
          type: 'modified',
          taskId: afterTask.id,
          roomNumber: afterTask.roomNumber,
          date: afterTask.date,
          before: {
            status: beforeTask.status,
            unresolvedConflicts: beforeTask.conflicts.filter(c => !c.resolved).length
          },
          after: {
            status: afterTask.status,
            unresolvedConflicts: afterTask.conflicts.filter(c => !c.resolved).length
          }
        });
      }
    });

    before.tasks.forEach(beforeTask => {
      if (!afterTaskMap.has(beforeTask.id)) {
        comparison.changes.push({
          type: 'removed',
          taskId: beforeTask.id,
          roomNumber: beforeTask.roomNumber,
          date: beforeTask.date,
          before: { status: beforeTask.status }
        });
      }
    });

    return comparison;
  }
}

module.exports = { Reporter };
