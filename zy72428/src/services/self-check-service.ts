import { dataStore } from '../store/data-store';
import { SelfCheckReport, SelfCheckItem, MaterialSource } from '../types';
import { scheduleImportService } from './schedule-import-service';
import { checklistService } from './checklist-service';

export class SelfCheckService {
  runFullCheck(): SelfCheckReport {
    const items: SelfCheckItem[] = [];

    items.push(this.checkDuplicateImports());
    items.push(this.checkLeaveCountedAsConsumed());
    items.push(this.checkSupplementRecalculate());
    items.push(this.checkExportConsistency());

    const passed = items.filter((i) => i.status === 'pass').length;
    const failed = items.filter((i) => i.status === 'fail').length;
    const warnings = items.filter((i) => i.status === 'warning').length;

    return {
      checkTime: new Date(),
      totalChecks: items.length,
      passed,
      failed,
      warnings,
      items,
    };
  }

  private checkDuplicateImports(): SelfCheckItem {
    const schedules = dataStore.getAllScheduleRecords();
    const seen = new Map<string, string[]>();
    const duplicates: string[] = [];

    for (const record of schedules) {
      const key = `${record.performerId}-${record.sessionDate.getTime()}-${record.locationId}-${record.trackName}`;
      if (seen.has(key)) {
        seen.get(key)!.push(record.id);
        if (!duplicates.includes(key)) {
          duplicates.push(key);
        }
      } else {
        seen.set(key, [record.id]);
      }
    }

    const affectedRecords: string[] = [];
    for (const key of duplicates) {
      affectedRecords.push(...seen.get(key)!);
    }

    if (duplicates.length === 0) {
      return {
        id: dataStore.generateId(),
        checkType: 'duplicate-import',
        status: 'pass',
        message: '未检测到重复导入的排班记录',
        details: '所有排班记录都是唯一的',
        affectedRecords: [],
      };
    }

    return {
      id: dataStore.generateId(),
      checkType: 'duplicate-import',
      status: 'warning',
      message: `检测到 ${duplicates.length} 组重复排班记录，共 ${affectedRecords.length} 条`,
      details:
        '相同艺人、相同日期、相同点位、相同曲目的记录被多次导入。请核对是否为误操作，或确认是否需要保留多条记录。',
      affectedRecords,
    };
  }

  private checkLeaveCountedAsConsumed(): SelfCheckItem {
    const schedules = dataStore.getAllScheduleRecords();
    const affectedRecords: string[] = [];
    const details: string[] = [];

    for (const record of schedules) {
      if (record.isLeave && record.isConsumed) {
        affectedRecords.push(record.id);
        details.push(
          `${record.performerName} ${record.sessionDate.toLocaleDateString()} ${record.locationName}: 请假但标记为已消耗 ${record.consumedHours} 课时`
        );
      }
    }

    if (affectedRecords.length === 0) {
      return {
        id: dataStore.generateId(),
        checkType: 'leave-counted-as-consumed',
        status: 'pass',
        message: '请假课时均未被误算为已消耗',
        details: '所有请假记录的消耗状态正确',
        affectedRecords: [],
      };
    }

    return {
      id: dataStore.generateId(),
      checkType: 'leave-counted-as-consumed',
      status: 'fail',
      message: `发现 ${affectedRecords.length} 条请假课时被误算为已消耗`,
      details: details.join('\n') + '\n\n请立即更正，不要将请假课时计入已消耗。已自动标记为待巡演统筹复核。',
      affectedRecords,
    };
  }

  private checkSupplementRecalculate(): SelfCheckItem {
    const supplementSchedules = dataStore
      .getAllScheduleRecords()
      .filter((r) => r.source === 'supplement');
    const affectedRecords: string[] = [];

    for (const record of supplementSchedules) {
      const shouldBeConsumed = !record.isLeave && record.consumedHours > 0;
      if (record.isConsumed !== shouldBeConsumed) {
        affectedRecords.push(record.id);
      }
    }

    if (affectedRecords.length === 0) {
      return {
        id: dataStore.generateId(),
        checkType: 'supplement-recalculate',
        status: 'pass',
        message: '补录材料的课时消耗计算正确',
        details: '所有补录记录均已正确重算',
        affectedRecords: [],
      };
    }

    return {
      id: dataStore.generateId(),
      checkType: 'supplement-recalculate',
      status: 'warning',
      message: `有 ${affectedRecords.length} 条补录记录需要重新计算课时消耗`,
      details: '补录材料导入后，系统需要重新核对请假状态和课时消耗。建议运行重算功能。',
      affectedRecords,
    };
  }

  private checkExportConsistency(): SelfCheckItem {
    const checklistItems = dataStore.getAllChecklistItems();
    const exported = checklistService.exportChecklist();
    const affectedRecords: string[] = [];

    if (checklistItems.length !== exported.length) {
      return {
        id: dataStore.generateId(),
        checkType: 'export-consistency',
        status: 'fail',
        message: '导出数据条数与内部记录不一致',
        details: `内部记录 ${checklistItems.length} 条，导出 ${exported.length} 条`,
        affectedRecords: [],
      };
    }

    for (let i = 0; i < checklistItems.length; i++) {
      const internal = checklistItems[i];
      const ext = exported[i];

      if (
        ext['艺人'] !== internal.performerName ||
        ext['点位'] !== internal.locationName ||
        ext['照片曲目'] !== internal.trackNameFromPhoto
      ) {
        affectedRecords.push(internal.id);
      }
    }

    if (affectedRecords.length === 0) {
      return {
        id: dataStore.generateId(),
        checkType: 'export-consistency',
        status: 'pass',
        message: '导出数据与内部记录完全一致',
        details: '导出校验通过',
        affectedRecords: [],
      };
    }

    return {
      id: dataStore.generateId(),
      checkType: 'export-consistency',
      status: 'fail',
      message: `有 ${affectedRecords.length} 条记录导出内容与内部不一致`,
      details: '请检查是否有手动修改过导出文件。建议在系统内调整后重新导出。',
      affectedRecords,
    };
  }

  autoFixIssues(report: SelfCheckReport): { fixed: string[]; messages: string[] } {
    const fixed: string[] = [];
    const messages: string[] = [];

    for (const item of report.items) {
      if (item.checkType === 'leave-counted-as-consumed' && item.status === 'fail') {
        for (const recordId of item.affectedRecords) {
          const record = dataStore.getScheduleRecord(recordId);
          if (record) {
            const updated = {
              ...record,
              isConsumed: false,
              consumedHours: 0,
              updatedAt: new Date(),
            };
            dataStore.saveScheduleRecord(updated);
            fixed.push(recordId);
            messages.push(
              `已修复：${record.performerName} ${record.sessionDate.toLocaleDateString()} 的请假课时更正为未消耗`
            );
          }
        }
      }

      if (item.checkType === 'supplement-recalculate' && item.status === 'warning') {
        const batchIds = new Set(
          dataStore
            .getAllScheduleRecords()
            .filter((r) => item.affectedRecords.includes(r.id))
            .map((r) => r.importBatchId)
        );

        for (const batchId of batchIds) {
          const result = scheduleImportService.recalculateConsumedHours(batchId);
          fixed.push(...result.updated.map((r) => r.id));
          messages.push(...result.messages);
        }
      }
    }

    return { fixed, messages };
  }

  formatReport(report: SelfCheckReport): string {
    const lines: string[] = [];
    lines.push('=' .repeat(60));
    lines.push('街头艺人点位排班 - 自检报告');
    lines.push(`检查时间：${report.checkTime.toLocaleString()}`);
    lines.push(`总检查项：${report.totalChecks}`);
    lines.push(`通过：${report.passed} | 失败：${report.failed} | 警告：${report.warnings}`);
    lines.push('=' .repeat(60));
    lines.push('');

    for (const item of report.items) {
      const statusIcon = item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : '⚠️';
      lines.push(`${statusIcon} ${this.getCheckTypeName(item.checkType)}`);
      lines.push(`   ${item.message}`);
      if (item.affectedRecords.length > 0) {
        lines.push(`   影响记录数：${item.affectedRecords.length}`);
      }
      lines.push(`   详细说明：${item.details}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private getCheckTypeName(type: string): string {
    const map: Record<string, string> = {
      'duplicate-import': '重复导入检测',
      'leave-counted-as-consumed': '请假课时误算检测',
      'supplement-recalculate': '补录后重算检测',
      'export-consistency': '导出一致性检测',
    };
    return map[type] || type;
  }
}

export const selfCheckService = new SelfCheckService();
