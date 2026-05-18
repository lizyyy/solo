import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

export class ReportGenerator {
  constructor(outputDir = './reports') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generateReports(summary) {
    const generatedFiles = [];

    generatedFiles.push(this.generateTextReport(summary));
    generatedFiles.push(this.generateConflictReport(summary));
    generatedFiles.push(this.generateSpecialCasesReport(summary));
    generatedFiles.push(this.generateSummaryJson(summary));

    return generatedFiles;
  }

  generateTextReport(summary) {
    const timestamp = this.getTimestamp();
    const filename = `排班冲突检查报告_${timestamp}.txt`;
    const filepath = path.join(this.outputDir, filename);

    const lines = [];
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                司机排班表换班冲突检查报告');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`📅 检查时间: ${this.formatDateTime(summary.checkTime)}`);
    lines.push('');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                      一、基本统计信息');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  1. 处理文件数: ${summary.totalFiles} 个`);
    lines.push(`  2. 排班记录数: ${summary.totalSchedules} 条`);
    lines.push(`  3. 涉及司机数: ${summary.totalDrivers} 人`);
    lines.push(`  4. 涉及车辆数: ${summary.totalVehicles} 辆`);
    lines.push('');

    if (summary.parseErrors.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('                      二、解析错误详情');
      lines.push('───────────────────────────────────────────────────────────────');
      for (let i = 0; i < summary.parseErrors.length; i++) {
        const error = summary.parseErrors[i];
        lines.push(`  ${i + 1}. [${error.type}] ${error.file}`);
        lines.push(`     ${error.message}`);
      }
      lines.push('');
    }

    if (summary.parseWarnings.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('                      三、解析警告详情');
      lines.push('───────────────────────────────────────────────────────────────');
      for (let i = 0; i < summary.parseWarnings.length; i++) {
        const warning = summary.parseWarnings[i];
        lines.push(`  ${i + 1}. [${warning.type}] ${warning.message}`);
      }
      lines.push('');
    }

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                      四、冲突检查结果');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  总冲突数: ${summary.conflicts.total} 个`);
    lines.push(`  - 错误级冲突: ${summary.conflicts.errors} 个`);
    lines.push(`  - 警告级冲突: ${summary.conflicts.warnings} 个`);
    lines.push(`  - 司机时间冲突: ${summary.conflicts.driverConflicts.length} 个`);
    lines.push(`  - 车辆时间冲突: ${summary.conflicts.vehicleConflicts.length} 个`);
    lines.push('');

    if (summary.conflicts.driverConflicts.length > 0) {
      lines.push('  ▶ 司机时间冲突详情:');
      for (let i = 0; i < summary.conflicts.driverConflicts.length; i++) {
        const conflict = summary.conflicts.driverConflicts[i];
        const severity = conflict.severity === 'ERROR' ? '严重' : '警告';
        lines.push(`    ${i + 1}. [${severity}] ${conflict.driverName}`);
        lines.push(`       ${conflict.message.split('\n').join('\n       ')}`);
      }
      lines.push('');
    }

    if (summary.conflicts.vehicleConflicts.length > 0) {
      lines.push('  ▶ 车辆时间冲突详情:');
      for (let i = 0; i < summary.conflicts.vehicleConflicts.length; i++) {
        const conflict = summary.conflicts.vehicleConflicts[i];
        const severity = conflict.severity === 'ERROR' ? '严重' : '警告';
        lines.push(`    ${i + 1}. [${severity}] ${conflict.vehicleNo}`);
        lines.push(`       ${conflict.message.split('\n').join('\n       ')}`);
      }
      lines.push('');
    }

    const hasSpecialCases = 
      summary.specialCases.concurrentPosts.length > 0 ||
      summary.specialCases.maintenance.length > 0 ||
      summary.specialCases.crossDayShifts.length > 0;

    if (hasSpecialCases) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('                      五、特殊情况记录');
      lines.push('───────────────────────────────────────────────────────────────');
      
      if (summary.specialCases.concurrentPosts.length > 0) {
        lines.push('  ▶ 司机兼岗列表:');
        for (let i = 0; i < summary.specialCases.concurrentPosts.length; i++) {
          const item = summary.specialCases.concurrentPosts[i];
          lines.push(`    ${i + 1}. ${item.driverName} (${item.route || '未指定'})`);
          lines.push(`       文件: ${item.file.split('/').pop()}, 行号: ${item.row}`);
        }
        lines.push('');
      }

      if (summary.specialCases.maintenance.length > 0) {
        lines.push('  ▶ 车辆保养列表:');
        for (let i = 0; i < summary.specialCases.maintenance.length; i++) {
          const item = summary.specialCases.maintenance[i];
          lines.push(`    ${i + 1}. ${item.vehicleNo} - 司机: ${item.driverName}`);
          lines.push(`       文件: ${item.file.split('/').pop()}, 行号: ${item.row}`);
        }
        lines.push('');
      }

      if (summary.specialCases.crossDayShifts.length > 0) {
        lines.push('  ▶ 跨日班次列表:');
        for (let i = 0; i < summary.specialCases.crossDayShifts.length; i++) {
          const item = summary.specialCases.crossDayShifts[i];
          lines.push(`    ${i + 1}. ${item.driverName} - ${item.vehicleNo || '未指定车辆'}`);
          lines.push(`       时间: ${item.startTime} - 次日${item.endTime}`);
          lines.push(`       文件: ${item.file.split('/').pop()}, 行号: ${item.row}`);
        }
        lines.push('');
      }
    }

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('                      六、检查结论');
    lines.push('───────────────────────────────────────────────────────────────');
    if (summary.conflicts.errors > 0) {
      lines.push('  ❌ 结论: 发现严重换班冲突，必须处理后再进行排班');
      lines.push('  建议:');
      lines.push('    1. 优先处理所有错误级别的司机时间冲突');
      lines.push('    2. 检查车辆分配是否合理');
      lines.push('    3. 调整冲突班次的时间安排');
    } else if (summary.conflicts.warnings > 0) {
      lines.push('  ⚠️  结论: 存在警告级冲突，请人工确认');
      lines.push('  建议:');
      lines.push('    1. 确认兼岗司机是否能够同时承担多个班次');
      lines.push('    2. 确认保养车辆的排班是否合理');
      lines.push('    3. 如无特殊情况，建议调整相关班次');
    } else {
      lines.push('  ✅ 结论: 未发现换班冲突，排班正常');
    }
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    报告生成完毕');
    lines.push('═══════════════════════════════════════════════════════════════');

    fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    return {
      type: 'text_report',
      filename,
      filepath,
      description: '详细文本报告，包含所有检查信息'
    };
  }

  generateConflictReport(summary) {
    const timestamp = this.getTimestamp();
    const filename = `排班冲突明细表_${timestamp}.xlsx`;
    const filepath = path.join(this.outputDir, filename);

    const allConflicts = [
      ...summary.conflicts.driverConflicts.map(c => ({
        '冲突类型': '司机时间冲突',
        '严重程度': c.severity === 'ERROR' ? '严重' : '警告',
        '主体名称': c.driverName,
        '冲突描述': c.message,
        '重叠时长(分钟)': c.overlap.durationMinutes,
        '班次1-文件': c.schedule1.file.split('/').pop(),
        '班次1-行号': c.schedule1.row,
        '班次1-日期': this.formatDate(c.schedule1.date),
        '班次1-开始时间': c.schedule1.startTime,
        '班次1-结束时间': c.schedule1.endTime,
        '班次1-线路': c.schedule1.route,
        '班次1-车牌号': c.schedule1.vehicleNo,
        '班次2-文件': c.schedule2.file.split('/').pop(),
        '班次2-行号': c.schedule2.row,
        '班次2-日期': this.formatDate(c.schedule2.date),
        '班次2-开始时间': c.schedule2.startTime,
        '班次2-结束时间': c.schedule2.endTime,
        '班次2-线路': c.schedule2.route,
        '班次2-车牌号': c.schedule2.vehicleNo
      })),
      ...summary.conflicts.vehicleConflicts.map(c => ({
        '冲突类型': '车辆时间冲突',
        '严重程度': c.severity === 'ERROR' ? '严重' : '警告',
        '主体名称': c.vehicleNo,
        '冲突描述': c.message,
        '重叠时长(分钟)': c.overlap.durationMinutes,
        '班次1-文件': c.schedule1.file.split('/').pop(),
        '班次1-行号': c.schedule1.row,
        '班次1-日期': this.formatDate(c.schedule1.date),
        '班次1-开始时间': c.schedule1.startTime,
        '班次1-结束时间': c.schedule1.endTime,
        '班次1-线路': c.schedule1.route,
        '班次1-司机': c.driverName || '-',
        '班次2-文件': c.schedule2.file.split('/').pop(),
        '班次2-行号': c.schedule2.row,
        '班次2-日期': this.formatDate(c.schedule2.date),
        '班次2-开始时间': c.schedule2.startTime,
        '班次2-结束时间': c.schedule2.endTime,
        '班次2-线路': c.schedule2.route,
        '班次2-司机': c.driverName || '-'
      }))
    ];

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(allConflicts);
    xlsx.utils.book_append_sheet(workbook, worksheet, '冲突明细');
    xlsx.writeFile(workbook, filepath);

    return {
      type: 'conflict_excel',
      filename,
      filepath,
      description: '冲突明细Excel表，便于筛选和排序'
    };
  }

  generateSpecialCasesReport(summary) {
    const timestamp = this.getTimestamp();
    const filename = `特殊情况记录_${timestamp}.xlsx`;
    const filepath = path.join(this.outputDir, filename);

    const workbook = xlsx.utils.book_new();

    if (summary.specialCases.concurrentPosts.length > 0) {
      const data = summary.specialCases.concurrentPosts.map((item, index) => ({
        '序号': index + 1,
        '司机姓名': item.driverName,
        '线路': item.route || '未指定',
        '文件': item.file.split('/').pop(),
        '行号': item.row
      }));
      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, '司机兼岗');
    }

    if (summary.specialCases.maintenance.length > 0) {
      const data = summary.specialCases.maintenance.map((item, index) => ({
        '序号': index + 1,
        '车牌号': item.vehicleNo,
        '司机姓名': item.driverName,
        '文件': item.file.split('/').pop(),
        '行号': item.row
      }));
      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, '车辆保养');
    }

    if (summary.specialCases.crossDayShifts.length > 0) {
      const data = summary.specialCases.crossDayShifts.map((item, index) => ({
        '序号': index + 1,
        '司机姓名': item.driverName,
        '车牌号': item.vehicleNo || '未指定',
        '开始时间': item.startTime,
        '结束时间': `次日${item.endTime}`,
        '文件': item.file.split('/').pop(),
        '行号': item.row
      }));
      const worksheet = xlsx.utils.json_to_sheet(data);
      xlsx.utils.book_append_sheet(workbook, worksheet, '跨日班次');
    }

    if (workbook.SheetNames.length > 0) {
      xlsx.writeFile(workbook, filepath);
      return {
        type: 'special_cases_excel',
        filename,
        filepath,
        description: '特殊情况记录（兼岗/保养/跨日班次）'
      };
    }
    return null;
  }

  generateSummaryJson(summary) {
    const timestamp = this.getTimestamp();
    const filename = `检查结果摘要_${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    const jsonData = {
      checkTime: summary.checkTime.toISOString(),
      statistics: {
        totalFiles: summary.totalFiles,
        totalSchedules: summary.totalSchedules,
        totalDrivers: summary.totalDrivers,
        totalVehicles: summary.totalVehicles
      },
      parseResult: {
        errors: summary.parseErrors.length,
        warnings: summary.parseWarnings.length
      },
      conflictResult: {
        total: summary.conflicts.total,
        errors: summary.conflicts.errors,
        warnings: summary.conflicts.warnings,
        driverConflicts: summary.conflicts.driverConflicts.length,
        vehicleConflicts: summary.conflicts.vehicleConflicts.length
      },
      specialCases: {
        concurrentPosts: summary.specialCases.concurrentPosts.length,
        maintenance: summary.specialCases.maintenance.length,
        crossDayShifts: summary.specialCases.crossDayShifts.length
      }
    };

    fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2), 'utf8');
    return {
      type: 'summary_json',
      filename,
      filepath,
      description: '机器可读的摘要数据，便于集成'
    };
  }

  printGeneratedFiles(files) {
    const validFiles = files.filter(f => f !== null);
    console.log('\n📄 已生成报告文件:');
    console.log('───────────────────────────────────────────────────────────────');
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      console.log(`  ${i + 1}. 📁 ${file.filename}`);
      console.log(`     ${file.description}`);
      console.log(`     路径: ${file.filepath}`);
    }
    console.log('───────────────────────────────────────────────────────────────\n');
  }

  getTimestamp() {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
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

  formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
