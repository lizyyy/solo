import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import {
  MedicalReport,
  Statistics,
  DuplicateEmployee,
  WithdrawnRecord,
  ParseError,
  ProcessResult
} from './types';

export class Reporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    fs.mkdirSync(outputDir, { recursive: true });
  }

  analyzeRecords(records: MedicalReport[], errors: ParseError[]): Statistics {
    const duplicateEmployees = this.findDuplicateEmployees(records);
    const withdrawnRecords = this.findWithdrawnRecords(records);
    const formatErrors = errors.filter(e => e.errorType !== 'parse_failed');

    return {
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalRecords: records.length + errors.length,
      validRecords: records.length,
      duplicateEmployees,
      withdrawnRecords,
      formatErrors,
      skippedRecords: 0,
      distributedRecords: records.filter(r => r.distributionStatus === 'distributed').length
    };
  }

  private findDuplicateEmployees(records: MedicalReport[]): DuplicateEmployee[] {
    const nameMap = new Map<string, MedicalReport[]>();

    records.forEach(record => {
      const existing = nameMap.get(record.name) || [];
      existing.push(record);
      nameMap.set(record.name, existing);
    });

    const duplicates: DuplicateEmployee[] = [];
    nameMap.forEach((recordList, name) => {
      if (recordList.length > 1) {
        duplicates.push({
          name,
          count: recordList.length,
          records: recordList.map(r => ({
            employeeId: r.employeeId,
            department: r.department,
            sourceFile: r.sourceFile
          }))
        });
      }
    });

    return duplicates.sort((a, b) => b.count - a.count);
  }

  private findWithdrawnRecords(records: MedicalReport[]): WithdrawnRecord[] {
    return records
      .filter(r => r.reportStatus === 'withdrawn')
      .map(r => ({
        employeeId: r.employeeId,
        name: r.name,
        department: r.department,
        withdrawnDate: r.examinationDate,
        reason: '用户撤回授权',
        sourceFile: r.sourceFile
      }));
  }

  async writeOutput(records: MedicalReport[], statistics: Statistics): Promise<ProcessResult> {
    const distributionFile = path.join(this.outputDir, 'distribution-list.csv');
    const errorsFile = path.join(this.outputDir, 'parse-errors.csv');
    const duplicatesFile = path.join(this.outputDir, 'duplicate-employees.csv');
    const withdrawnFile = path.join(this.outputDir, 'withdrawn-records.csv');
    const summaryFile = path.join(this.outputDir, 'summary-report.md');

    await Promise.all([
      this.writeDistributionList(records, distributionFile),
      this.writeErrorsList(statistics.formatErrors, errorsFile),
      this.writeDuplicatesList(statistics.duplicateEmployees, duplicatesFile),
      this.writeWithdrawnList(statistics.withdrawnRecords, withdrawnFile),
      this.writeSummaryReport(statistics, summaryFile)
    ]);

    return {
      success: true,
      statistics,
      outputFiles: {
        distribution: distributionFile,
        errors: errorsFile,
        duplicates: duplicatesFile,
        withdrawn: withdrawnFile,
        summary: summaryFile
      }
    };
  }

  private async writeDistributionList(records: MedicalReport[], filePath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'employeeId', title: '员工编号' },
        { id: 'name', title: '姓名' },
        { id: 'department', title: '部门' },
        { id: 'examinationDate', title: '体检日期' },
        { id: 'reportStatus', title: '报告状态' },
        { id: 'distributionStatus', title: '分发状态' },
        { id: 'phone', title: '联系电话' },
        { id: 'email', title: '电子邮箱' },
        { id: 'clinicName', title: '体检中心' },
        { id: 'reportType', title: '报告类型' },
        { id: 'items', title: '体检项目' },
        { id: 'sourceFile', title: '来源文件' },
        { id: 'processedAt', title: '处理时间' }
      ]
    });

    const recordsForCsv = records.map(r => ({
      ...r,
      items: r.items.join('、')
    }));

    await csvWriter.writeRecords(recordsForCsv);
  }

  private async writeErrorsList(errors: ParseError[], filePath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'file', title: '文件名' },
        { id: 'rowNumber', title: '行号' },
        { id: 'errorType', title: '错误类型' },
        { id: 'message', title: '错误信息' },
        { id: 'rawData', title: '原始数据' }
      ]
    });

    await csvWriter.writeRecords(errors);
  }

  private async writeDuplicatesList(duplicates: DuplicateEmployee[], filePath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: '姓名' },
        { id: 'count', title: '重复次数' },
        { id: 'employeeIds', title: '关联员工编号' },
        { id: 'departments', title: '所属部门' },
        { id: 'sourceFiles', title: '来源文件' }
      ]
    });

    const recordsForCsv = duplicates.map(d => ({
      name: d.name,
      count: d.count,
      employeeIds: d.records.map(r => r.employeeId).join('、'),
      departments: d.records.map(r => r.department).join('、'),
      sourceFiles: d.records.map(r => r.sourceFile).join('、')
    }));

    await csvWriter.writeRecords(recordsForCsv);
  }

  private async writeWithdrawnList(withdrawn: WithdrawnRecord[], filePath: string): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'employeeId', title: '员工编号' },
        { id: 'name', title: '姓名' },
        { id: 'department', title: '部门' },
        { id: 'withdrawnDate', title: '撤回日期' },
        { id: 'reason', title: '撤回原因' },
        { id: 'sourceFile', title: '来源文件' }
      ]
    });

    await csvWriter.writeRecords(withdrawn);
  }

  private async writeSummaryReport(stats: Statistics, filePath: string): Promise<void> {
    const markdown = `# 体检中心体检报告分发汇总报告

## 📊 执行概览

| 指标 | 数值 |
|------|------|
| 总文件数 | ${stats.totalFiles} |
| 成功处理文件 | ${stats.processedFiles} |
| 失败文件 | ${stats.failedFiles} |
| 总记录数 | ${stats.totalRecords} |
| 有效记录 | ${stats.validRecords} |
| 跳过记录 | ${stats.skippedRecords} |
| 已分发记录 | ${stats.distributedRecords} |

## 👥 同名员工统计

共发现 **${stats.duplicateEmployees.length}** 个同名员工需要核对：

${stats.duplicateEmployees.length > 0 ? `
| 姓名 | 重复次数 | 员工编号 | 部门 |
|------|----------|----------|------|
${stats.duplicateEmployees.map(d => 
  `| ${d.name} | ${d.count} | ${d.records.map(r => r.employeeId).join('、')} | ${d.records.map(r => r.department).join('、')} |`
).join('\n')}
` : '*暂无同名员工*'}

## ❌ 撤回授权记录

共 **${stats.withdrawnRecords.length}** 条撤回授权记录：

${stats.withdrawnRecords.length > 0 ? `
| 员工编号 | 姓名 | 部门 | 撤回日期 | 原因 |
|----------|------|------|----------|------|
${stats.withdrawnRecords.map(w => 
  `| ${w.employeeId} | ${w.name} | ${w.department} | ${w.withdrawnDate} | ${w.reason || '-'} |`
).join('\n')}
` : '*暂无撤回授权记录*'}

## ⚠️ 格式错误统计

共 **${stats.formatErrors.length}** 条格式错误：

### 按错误类型分类

| 错误类型 | 数量 |
|----------|------|
${this.groupErrorsByType(stats.formatErrors).map(([type, count]) => 
  `| ${this.translateErrorType(type)} | ${count} |`
).join('\n')}

### 详细错误列表

${stats.formatErrors.length > 0 ? `
| 文件 | 行号 | 错误类型 | 错误信息 |
|------|------|----------|----------|
${stats.formatErrors.slice(0, 20).map(e => 
  `| ${e.file} | ${e.rowNumber || '-'} | ${this.translateErrorType(e.errorType)} | ${e.message} |`
).join('\n')}
${stats.formatErrors.length > 20 ? `\n*仅显示前20条，详见 parse-errors.csv*` : ''}
` : '*暂无格式错误*'}

---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    fs.writeFileSync(filePath, markdown, 'utf8');
  }

  private groupErrorsByType(errors: ParseError[]): [string, number][] {
    const groups = new Map<string, number>();
    errors.forEach(e => {
      groups.set(e.errorType, (groups.get(e.errorType) || 0) + 1);
    });
    return Array.from(groups.entries());
  }

  private translateErrorType(type: string): string {
    const map: Record<string, string> = {
      'format_error': '格式错误',
      'missing_field': '缺少字段',
      'invalid_data': '无效数据',
      'duplicate': '重复记录',
      'parse_failed': '解析失败'
    };
    return map[type] || type;
  }

  printConsoleSummary(statistics: Statistics): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 体检中心体检报告分发 - 处理结果汇总');
    console.log('='.repeat(60));
    console.log(`\n📊 总览:`);
    console.log(`  总文件数: ${statistics.totalFiles}`);
    console.log(`  成功处理: ${statistics.processedFiles}`);
    console.log(`  失败文件: ${statistics.failedFiles}`);
    console.log(`  总记录数: ${statistics.totalRecords}`);
    console.log(`  有效记录: ${statistics.validRecords}`);
    console.log(`  跳过记录: ${statistics.skippedRecords}`);

    console.log(`\n👥 同名员工: ${statistics.duplicateEmployees.length} 人`);
    if (statistics.duplicateEmployees.length > 0) {
      statistics.duplicateEmployees.slice(0, 5).forEach(d => {
        console.log(`  - ${d.name}: ${d.count} 条记录`);
      });
      if (statistics.duplicateEmployees.length > 5) {
        console.log(`  ...还有 ${statistics.duplicateEmployees.length - 5} 人`);
      }
    }

    console.log(`\n❌ 撤回授权: ${statistics.withdrawnRecords.length} 条`);
    console.log(`\n⚠️ 格式错误: ${statistics.formatErrors.length} 条`);

    console.log(`\n💾 输出目录: ${this.outputDir}`);
    console.log('='.repeat(60) + '\n');
  }
}
