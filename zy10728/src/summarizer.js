export class ResultSummarizer {
  constructor() {
    this.summary = {
      checkTime: new Date(),
      totalFiles: 0,
      totalSchedules: 0,
      totalDrivers: 0,
      totalVehicles: 0,
      parseErrors: [],
      parseWarnings: [],
      conflicts: {
        total: 0,
        errors: 0,
        warnings: 0,
        driverConflicts: [],
        vehicleConflicts: []
      },
      specialCases: {
        concurrentPosts: [],
        maintenance: [],
        crossDayShifts: []
      }
    };
  }

  addParseResults(parsedResults, parserErrors) {
    this.summary.totalFiles = parsedResults.length;
    this.summary.parseErrors = parserErrors;

    const allDrivers = new Set();
    const allVehicles = new Set();

    for (const result of parsedResults) {
      this.summary.parseWarnings.push(...result.warnings);
      this.summary.totalSchedules += result.schedules.length;

      for (const schedule of result.schedules) {
        allDrivers.add(schedule.driverName);
        if (schedule.vehicleNo) {
          allVehicles.add(schedule.vehicleNo);
        }

        this.captureSpecialCases(schedule, result.file);
      }
    }

    this.summary.totalDrivers = allDrivers.size;
    this.summary.totalVehicles = allVehicles.size;
  }

  captureSpecialCases(schedule, file) {
    if (schedule.isConcurrent) {
      this.summary.specialCases.concurrentPosts.push({
        driverName: schedule.driverName,
        file,
        row: schedule.rowNum,
        route: schedule.route
      });
    }

    if (schedule.isMaintenance) {
      this.summary.specialCases.maintenance.push({
        vehicleNo: schedule.vehicleNo,
        driverName: schedule.driverName,
        file,
        row: schedule.rowNum
      });
    }

    if (schedule.warnings) {
      const crossDayWarning = schedule.warnings.find(w => w.type === 'CROSS_DAY_SHIFT');
      if (crossDayWarning) {
        this.summary.specialCases.crossDayShifts.push({
          driverName: schedule.driverName,
          vehicleNo: schedule.vehicleNo,
          file,
          row: schedule.rowNum,
          startTime: `${schedule.startTime.hour}:${schedule.startTime.minute}`,
          endTime: `${schedule.endTime.hour}:${schedule.endTime.minute}`
        });
      }
    }
  }

  addValidationResults(validationResult) {
    this.summary.conflicts.total = validationResult.conflicts.length;
    this.summary.conflicts.errors = validationResult.conflicts.filter(c => c.severity === 'ERROR').length;
    this.summary.conflicts.warnings = validationResult.conflicts.filter(c => c.severity === 'WARNING').length;
    
    this.summary.conflicts.driverConflicts = validationResult.conflicts.filter(c => c.type === 'DRIVER_TIME_CONFLICT');
    this.summary.conflicts.vehicleConflicts = validationResult.conflicts.filter(c => c.type === 'VEHICLE_TIME_CONFLICT');
  }

  getSummary() {
    return this.summary;
  }

  getConsoleSummary() {
    const lines = [];
    lines.push('');
    lines.push('════════════════════════════════════════════════════════════');
    lines.push('           司机排班表换班冲突检查 - 结果汇总');
    lines.push('════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`📅 检查时间: ${this.formatDateTime(this.summary.checkTime)}`);
    lines.push('');
    lines.push('┌──────────────────────────────────────────────────────────┐');
    lines.push('│                     基本统计信息                         │');
    lines.push('└──────────────────────────────────────────────────────────┘');
    lines.push(`  处理文件数: ${this.summary.totalFiles} 个`);
    lines.push(`  排班记录数: ${this.summary.totalSchedules} 条`);
    lines.push(`  涉及司机数: ${this.summary.totalDrivers} 人`);
    lines.push(`  涉及车辆数: ${this.summary.totalVehicles} 辆`);
    lines.push('');

    if (this.summary.parseErrors.length > 0) {
      lines.push('┌──────────────────────────────────────────────────────────┐');
      lines.push('│                     解析错误 (严重)                      │');
      lines.push('└──────────────────────────────────────────────────────────┘');
      for (const error of this.summary.parseErrors) {
        lines.push(`  ❌ ${error.file}: ${error.message}`);
      }
      lines.push('');
    }

    if (this.summary.parseWarnings.length > 0) {
      lines.push('┌──────────────────────────────────────────────────────────┐');
      lines.push('│                     解析警告 (提示)                      │');
      lines.push('└──────────────────────────────────────────────────────────┘');
      for (const warning of this.summary.parseWarnings.slice(0, 10)) {
        lines.push(`  ⚠️  ${warning.message}`);
      }
      if (this.summary.parseWarnings.length > 10) {
        lines.push(`  ... 还有 ${this.summary.parseWarnings.length - 10} 条警告，请查看详细报告`);
      }
      lines.push('');
    }

    lines.push('┌──────────────────────────────────────────────────────────┐');
    lines.push('│                     冲突检查结果                         │');
    lines.push('└──────────────────────────────────────────────────────────┘');
    
    const hasConflicts = this.summary.conflicts.total > 0;
    lines.push(`  总冲突数: ${this.summary.conflicts.total} 个`);
    lines.push(`  - 错误级冲突: ${this.summary.conflicts.errors} 个 ${hasConflicts && this.summary.conflicts.errors > 0 ? '❌' : '✅'}`);
    lines.push(`  - 警告级冲突: ${this.summary.conflicts.warnings} 个 ${hasConflicts && this.summary.conflicts.warnings > 0 ? '⚠️' : '✅'}`);
    lines.push(`  - 司机时间冲突: ${this.summary.conflicts.driverConflicts.length} 个`);
    lines.push(`  - 车辆时间冲突: ${this.summary.conflicts.vehicleConflicts.length} 个`);
    lines.push('');

    if (hasConflicts) {
      lines.push('┌──────────────────────────────────────────────────────────┐');
      lines.push('│                     冲突详情 (前5条)                     │');
      lines.push('└──────────────────────────────────────────────────────────┘');
      const conflicts = [...this.summary.conflicts.driverConflicts, ...this.summary.conflicts.vehicleConflicts];
      for (const conflict of conflicts.slice(0, 5)) {
        const icon = conflict.severity === 'ERROR' ? '❌' : '⚠️';
        lines.push(`  ${icon} ${conflict.message.split('\n')[0]}`);
      }
      if (conflicts.length > 5) {
        lines.push(`  ... 还有 ${conflicts.length - 5} 条冲突，请查看详细报告`);
      }
      lines.push('');
    }

    const hasSpecialCases = 
      this.summary.specialCases.concurrentPosts.length > 0 ||
      this.summary.specialCases.maintenance.length > 0 ||
      this.summary.specialCases.crossDayShifts.length > 0;

    if (hasSpecialCases) {
      lines.push('┌──────────────────────────────────────────────────────────┐');
      lines.push('│                     特殊情况记录                         │');
      lines.push('└──────────────────────────────────────────────────────────┘');
      
      if (this.summary.specialCases.concurrentPosts.length > 0) {
        lines.push(`  👥 司机兼岗: ${this.summary.specialCases.concurrentPosts.length} 人`);
      }
      if (this.summary.specialCases.maintenance.length > 0) {
        lines.push(`  🔧 车辆保养: ${this.summary.specialCases.maintenance.length} 辆`);
      }
      if (this.summary.specialCases.crossDayShifts.length > 0) {
        lines.push(`  🌙 跨日班次: ${this.summary.specialCases.crossDayShifts.length} 个`);
      }
      lines.push('');
    }

    lines.push('════════════════════════════════════════════════════════════');
    if (this.summary.conflicts.errors > 0) {
      lines.push('  ❌ 检查结果: 发现严重冲突，请处理后再进行排班');
    } else if (this.summary.conflicts.warnings > 0) {
      lines.push('  ⚠️  检查结果: 存在警告，请确认兼岗/保养情况');
    } else {
      lines.push('  ✅ 检查结果: 未发现换班冲突，排班正常');
    }
    lines.push('════════════════════════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
  }

  formatDateTime(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
}
