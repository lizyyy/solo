const { getErrorMessage, formatError } = require('./errorMessages');

class SelfChecker {
  constructor(system) {
    this.system = system;
    this.checks = [
      { id: 'duplicate_import', name: '重复导入检测', run: this.checkDuplicateImports.bind(this) },
      { id: 'duplicate_names', name: '同一障碍物多名称检测', run: this.checkDuplicateNames.bind(this) },
      { id: 'recalc_after_supplement', name: '补录后重算验证', run: this.checkRecalcAfterSupplement.bind(this) },
      { id: 'export_consistency', name: '导出一致性检查', run: this.checkExportConsistency.bind(this) },
      { id: 'view_history_sync', name: '视图与历史记录同步', run: this.checkViewHistorySync.bind(this) }
    ];
  }

  async runAllChecks() {
    const results = [];
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const check of this.checks) {
      try {
        const result = await check.run();
        result.checkId = check.id;
        result.checkName = check.name;
        results.push(result);
        
        if (result.status === 'pass') passed++;
        else if (result.status === 'fail') failed++;
        else if (result.status === 'warning') warnings++;
      } catch (error) {
        results.push({
          checkId: check.id,
          checkName: check.name,
          status: 'error',
          message: `检查执行出错: ${error.message}`
        });
        failed++;
      }
    }

    return {
      timestamp: new Date(),
      summary: {
        total: this.checks.length,
        passed,
        failed,
        warnings
      },
      results,
      allPassed: failed === 0 && warnings === 0
    };
  }

  checkDuplicateImports() {
    const issues = [];
    const layerNames = new Map();

    for (const layer of this.system.cadLayers) {
      const key = layer.layerName;
      if (layerNames.has(key)) {
        const first = layerNames.get(key);
        issues.push({
          layerName: layer.layerName,
          firstImport: {
            time: first.importedAt,
            by: first.importedBy
          },
          duplicateImport: {
            time: layer.importedAt,
            by: layer.importedBy
          }
        });
      } else {
        layerNames.set(key, layer);
      }
    }

    if (issues.length > 0) {
      return {
        status: 'warning',
        message: `发现 ${issues.length} 个重复导入的CAD图层`,
        issues
      };
    }

    return {
      status: 'pass',
      message: '没有检测到重复导入'
    };
  }

  checkDuplicateNames() {
    const issues = [];

    for (const obstacle of Object.values(this.system.obstacles)) {
      if (obstacle.hasMultipleNames()) {
        const pendingNames = obstacle.names.filter(n => n.status === 'pending');
        issues.push({
          obstacleId: obstacle.id,
          names: obstacle.names.map(n => ({
            name: n.name,
            source: n.source,
            status: n.status,
            operator: n.operator
          })),
          pendingCount: pendingNames.length,
          needsReview: pendingNames.length > 0
        });
      }
    }

    if (issues.length > 0) {
      return {
        status: 'warning',
        message: `发现 ${issues.length} 个障碍物有多个名称，需培训学员复核`,
        issues
      };
    }

    return {
      status: 'pass',
      message: '所有障碍物名称唯一'
    };
  }

  checkRecalcAfterSupplement() {
    const issues = [];
    const supplementRecords = this.system.viewSync.getHistory({
      action: 'supplement_data'
    });

    for (const record of supplementRecords) {
      const obstacleId = record.details.obstacleId;
      const obstacle = this.system.obstacles[obstacleId];
      
      if (obstacle) {
        const recalcHistory = this.system.viewSync.getHistory({
          action: 'recalculate'
        }).filter(h => 
          h.timestamp >= record.timestamp && 
          h.details.obstacleId === obstacleId
        );

        if (recalcHistory.length === 0) {
          issues.push({
            obstacleId,
            supplementTime: record.timestamp,
            supplementedBy: record.operator
          });
        }
      }
    }

    if (issues.length > 0) {
      return {
        status: 'fail',
        message: `${issues.length} 个障碍物补录数据后没有重新计算`,
        issues
      };
    }

    return {
      status: 'pass',
      message: '所有补录数据后都执行了重算'
    };
  }

  checkExportConsistency() {
    const exportData = this.system.viewSync.exportViewData();
    const issues = [];

    if (!exportData.consistencyCheck.consistent) {
      issues.push(...exportData.consistencyCheck.issues);
    }

    const annotationIds = new Set(
      exportData.annotations.map(a => a.annotationId)
    );
    const historyAnnotationIds = new Set(
      this.system.viewSync.getHistory({ action: 'add_annotation' })
        .map(h => h.details.annotationId)
    );

    for (const id of annotationIds) {
      if (!historyAnnotationIds.has(id)) {
        issues.push({
          type: 'annotation_missing_history',
          message: `标注 ${id} 在视图中但没有历史记录`
        });
      }
    }

    if (issues.length > 0) {
      const error = getErrorMessage('EXPORT_MISMATCH', {
        viewCount: exportData.annotationCount,
        historyCount: historyAnnotationIds.size
      });
      return {
        status: 'fail',
        message: formatError(error),
        issues
      };
    }

    return {
      status: 'pass',
      message: '导出数据一致性检查通过'
    };
  }

  checkViewHistorySync() {
    const result = this.system.viewSync.verifyConsistency();
    
    if (!result.consistent) {
      return {
        status: 'fail',
        message: result.summary,
        issues: result.issues
      };
    }

    return {
      status: 'pass',
      message: result.summary
    };
  }

  formatReport(report) {
    const lines = [
      '═══════════════════════════════════════════════════════',
      '           🧪 物流分拣线堵点演示 - 自检报告',
      '═══════════════════════════════════════════════════════',
      `检测时间: ${report.timestamp.toLocaleString()}`,
      `总计: ${report.summary.total} 项 | 通过: ${report.summary.passed} | 失败: ${report.summary.failed} | 警告: ${report.summary.warnings}`,
      '═══════════════════════════════════════════════════════',
      ''
    ];

    for (const result of report.results) {
      const statusIcon = result.status === 'pass' ? '✅' : 
                         result.status === 'fail' ? '❌' : '⚠️';
      lines.push(`${statusIcon} 【${result.checkName}】`);
      lines.push(`   ${result.message}`);
      
      if (result.issues && result.issues.length > 0) {
        lines.push('   详细问题:');
        for (const issue of result.issues.slice(0, 3)) {
          if (issue.obstacleId) {
            lines.push(`     • 障碍物 ${issue.obstacleId}`);
            if (issue.names) {
              for (const n of issue.names) {
                lines.push(`       - ${n.name} (来源: ${n.source}, 状态: ${n.status})`);
              }
            }
          } else if (issue.layerName) {
            lines.push(`     • 图层: ${issue.layerName}`);
          } else if (issue.message) {
            lines.push(`     • ${issue.message}`);
          }
        }
        if (result.issues.length > 3) {
          lines.push(`     • ...还有 ${result.issues.length - 3} 个问题`);
        }
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════');
    lines.push(report.allPassed ? '✅ 全部检查通过！' : '⚠️  请处理上述问题后再导出');
    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

module.exports = SelfChecker;
