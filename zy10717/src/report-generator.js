const fs = require('fs');
const path = require('path');

class ReportGenerator {
  generate(results, outputDir, format = 'both') {
    const formats = format === 'both' ? ['json', 'csv'] : [format];
    
    formats.forEach(fmt => {
      this.generateByFormat(results, outputDir, fmt);
    });

    this.generateSummaryReport(results, outputDir);
    this.generateReadableReport(results, outputDir);
  }

  generateByFormat(results, outputDir, format) {
    if (format === 'json') {
      this.writeJson(path.join(outputDir, 'rework-packages.json'), results.packages);
      this.writeJson(path.join(outputDir, 'reviewer-report.json'), results.reviewerReport);
      this.writeJson(path.join(outputDir, 'audit-log.json'), results.auditLog);
      this.writeJson(path.join(outputDir, 'stats.json'), {
        ...results.stats,
        ...results.metadata
      });
    } else if (format === 'csv') {
      this.writeCsv(path.join(outputDir, 'rework-packages.csv'), results.packages, [
        'packageId', 'taskCount', 'reworkCount', 'inspectionFailCount', 'annotators'
      ]);
      this.writeCsv(path.join(outputDir, 'reviewer-report.csv'), results.reviewerReport, [
        'annotator', 'totalRework', 'inspectionFails', 'riskLevel', 'packages'
      ]);
      this.writeCsv(path.join(outputDir, 'audit-log.csv'), results.auditLog, [
        'taskId', 'action', 'reason', 'annotator', 'packageId', 'sourceFile'
      ]);
    }
  }

  writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  writeCsv(filePath, data, columns) {
    const lines = [columns.join(',')];
    
    data.forEach(item => {
      const values = columns.map(col => {
        let value = item[col];
        if (Array.isArray(value)) {
          value = value.join(';');
        }
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value || '';
      });
      lines.push(values.join(','));
    });
    
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  generateSummaryReport(results, outputDir) {
    const report = [
      '==================================================',
      '  标注任务导出返工拆包清理 - 汇总报告',
      '  Annotation Export Rework Summary Report',
      '==================================================',
      '',
      `生成时间: ${new Date().toLocaleString('zh-CN')}`,
      `输入文件数: ${(results.metadata.inputFiles || []).length}`,
      '',
      '【统计数据】',
      `  总任务数: ${results.stats.totalTasks}`,
      `  返工任务数: ${results.stats.reworkTasks}`,
      `  去重排除数: ${results.stats.duplicateRemoved}`,
      `  离职排除数: ${results.stats.leftAnnotatorRemoved}`,
      `  重叠包合并数: ${results.stats.overlapMerged}`,
      `  抽检失败数: ${results.stats.inspectionFailed}`,
      '',
      '【业务处理说明】',
      '  ✓ 拆出返工包: 筛选 needRework=true 或 status=NEED_REWORK 的任务',
      '  ✓ 避免重复分配: 按 taskId 去重，防止同一任务多次分配',
      '  ✓ 人员离职处理: 根据 activeAnnotators 名单过滤离职人员任务',
      '  ✓ 包号重叠合并: 跨文件的同 packageId 任务合并标注',
      '  ✓ 抽检失败标记: inspectionFailed=true 的任务特殊标记',
      '',
      '【返工包分布】',
      ...results.packages.map(pkg => 
        `  包 ${pkg.packageId}: ${pkg.taskCount} 个任务 (标注员: ${pkg.annotators.join(', ')})`
      ),
      '',
      '【标注员风险等级】',
      ...results.reviewerReport.map(r => 
        `  ${r.annotator}: ${r.riskLevel} (返工${r.totalRework}个, 抽检失败${r.inspectionFails}个)`
      ),
      ''
    ].join('\n');

    fs.writeFileSync(path.join(outputDir, 'SUMMARY.txt'), report, 'utf-8');
  }

  generateReadableReport(results, outputDir) {
    const report = [
      '==================================================',
      '  标注任务导出返工拆包清理 - 可复核报告',
      '  Reviewable Report for Rework Tasks',
      '==================================================',
      '',
      '一、返工任务清单',
      '--------------------',
      ...results.tasks.map((task, i) => [
        `#${i + 1} 任务ID: ${task.taskId}`,
        `  包号: ${task.packageId}`,
        `  标注员: ${task.annotator}`,
        `  状态: ${task.status}`,
        `  质量分: ${task.quality || 'N/A'}`,
        `  抽检失败: ${task.inspectionFailed ? '是' : '否'}`,
        `  来源文件: ${task.sourceFile}`,
        task.packageOverlap ? `  ⚠️  跨文件重叠包 (来源: ${task.mergedFromSources.join(', ')})` : '',
        ''
      ].filter(Boolean).join('\n')),
      '',
      '二、审计日志 - 排除/合并记录',
      '--------------------------------',
      ...results.auditLog.map(log => 
        `  [${log.action}] ${log.taskId} - 原因: ${log.reason} (标注员: ${log.annotator}, 包: ${log.packageId})`
      ),
      '',
      '三、复核检查要点',
      '--------------------',
      '1. 对照 audit-log 确认排除的任务理由是否合理',
      '2. 检查 package 重叠合并是否正确（标记有 packageOverlap）',
      '3. 抽检失败任务需要优先处理（inspectionFailed=true）',
      '4. HIGH 风险标注员的任务需要重点复核',
      '5. 用 diff 命令对比历史版本，确认规则变更影响',
      ''
    ].join('\n');

    fs.writeFileSync(path.join(outputDir, 'REVIEW-REPORT.txt'), report, 'utf-8');
  }

  generateDiff(oldDir, newDir) {
    const changes = [];
    
    const oldStats = this.loadJsonSafe(path.join(oldDir, 'stats.json'));
    const newStats = this.loadJsonSafe(path.join(newDir, 'stats.json'));
    
    if (oldStats && newStats) {
      if (oldStats.totalTasks !== newStats.totalTasks) {
        changes.push({
          type: 'TASK_COUNT',
          description: `总任务数变化: ${oldStats.totalTasks} → ${newStats.totalTasks} (差: ${newStats.totalTasks - oldStats.totalTasks})`
        });
      }
      if (oldStats.reworkTasks !== newStats.reworkTasks) {
        changes.push({
          type: 'REWORK_COUNT',
          description: `返工任务数变化: ${oldStats.reworkTasks} → ${newStats.reworkTasks} (差: ${newStats.reworkTasks - oldStats.reworkTasks})`
        });
      }
      if (oldStats.duplicateRemoved !== newStats.duplicateRemoved) {
        changes.push({
          type: 'DEDUP_CHANGE',
          description: `去重数量变化: ${oldStats.duplicateRemoved} → ${newStats.duplicateRemoved}`
        });
      }
      if (oldStats.leftAnnotatorRemoved !== newStats.leftAnnotatorRemoved) {
        changes.push({
          type: 'ANNOTATOR_LEFT',
          description: `离职排除数变化: ${oldStats.leftAnnotatorRemoved} → ${newStats.leftAnnotatorRemoved} - 这就是标注任务导出返工拆包清理的人员离职场景！`
        });
      }
      if (oldStats.overlapMerged !== newStats.overlapMerged) {
        changes.push({
          type: 'OVERLAP_CHANGE',
          description: `重叠包合并数变化: ${oldStats.overlapMerged} → ${newStats.overlapMerged} - 这就是标注任务导出返工拆包清理的包号重叠场景！`
        });
      }
      if (oldStats.inspectionFailed !== newStats.inspectionFailed) {
        changes.push({
          type: 'INSPECTION_CHANGE',
          description: `抽检失败数变化: ${oldStats.inspectionFailed} → ${newStats.inspectionFailed} - 这就是标注任务导出返工拆包清理的抽检失败场景！`
        });
      }
    }

    const hasChanges = changes.length > 0;
    let summary = '';
    
    if (hasChanges) {
      summary = `[发现差异] 两次拆包结果有 ${changes.length} 处差异\n`;
      summary += '  这就是标注任务导出返工拆包清理的 diff 能力 - 规则变更、人员离职、包号重叠、抽检失败都能看清！';
    } else {
      summary = '[无差异] 两次拆包结果完全一致';
    }

    return { summary, changes, hasChanges };
  }

  loadJsonSafe(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      // silent
    }
    return null;
  }
}

module.exports = { ReportGenerator };
