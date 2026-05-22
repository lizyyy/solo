import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import * as XLSX from 'xlsx';
import moment from 'moment';
import { getDatabase } from '../database';

interface ExportOptions {
  format?: 'csv' | 'xlsx' | 'json';
  output?: string;
  batch?: string;
  frozenOnly?: boolean;
  includeRaw?: boolean;
}

export async function exportCommand(workDir: string, options: ExportOptions): Promise<void> {
  const absoluteDir = path.resolve(workDir);
  const db = getDatabase(absoluteDir);

  const format = options.format || 'xlsx';
  const exportDir = path.join(absoluteDir, 'exports');
  const timestamp = moment().format('YYYYMMDD_HHmmss');
  const filename = `pmi_export_${timestamp}.${format}`;
  const outputPath = options.output || path.join(exportDir, filename);

  console.log(chalk.blue('导出数据'));
  console.log(chalk.gray(`  格式: ${format}`));
  console.log(chalk.gray(`  输出: ${outputPath}`));
  console.log('');

  const facts = await db.getFactRecords();
  const exportFacts = options.frozenOnly ? facts.filter(f => f.isFrozen) : facts;

  if (exportFacts.length === 0) {
    console.log(chalk.yellow('没有可导出的数据'));
    return;
  }

  const exportData: any[] = [];

  for (const fact of exportFacts) {
    const stdRecords = await db.getStandardizedRecordsByFact(fact.id);

    const baseData = {
      工单号: fact.orderNumber,
      当前状态: fact.currentStatus,
      版本: fact.version,
      是否冻结: fact.isFrozen ? '是' : '否',
      冻结时间: fact.frozenAt ? moment(fact.frozenAt).format('YYYY-MM-DD HH:mm') : '',
      创建时间: moment(fact.createdAt).format('YYYY-MM-DD HH:mm'),
      更新时间: moment(fact.updatedAt).format('YYYY-MM-DD HH:mm'),
    };

    const mergedData: any = { ...baseData };

    for (const std of stdRecords) {
      if (std.residentName) mergedData['住户姓名'] = std.residentName;
      if (std.roomNumber) mergedData['房间号'] = std.roomNumber;
      if (std.phoneNumber) mergedData['联系电话'] = std.phoneNumber;
      if (std.repairType) mergedData['维修类型'] = std.repairType;
      if (std.description) mergedData['问题描述'] = std.description;
      if (std.reportTime) mergedData['报修时间'] = moment(std.reportTime).format('YYYY-MM-DD HH:mm');
      if (std.technicianName) mergedData['维修师傅'] = std.technicianName;
      if (std.arrivalTime) mergedData['到达时间'] = moment(std.arrivalTime).format('YYYY-MM-DD HH:mm');
      if (std.completionTime) mergedData['完成时间'] = moment(std.completionTime).format('YYYY-MM-DD HH:mm');
      if (std.repairResult) mergedData['维修结果'] = std.repairResult;
      if (std.materialName) mergedData['材料名称'] = std.materialName;
      if (std.materialQuantity !== undefined) mergedData['材料数量'] = std.materialQuantity;
      if (std.materialUnit) mergedData['单位'] = std.materialUnit;
      if (std.supervisorNote) mergedData['主管批注'] = std.supervisorNote;
      if (std.isManualOverride) mergedData['人工改判'] = '是';
    }

    if (options.includeRaw) {
      const rawRecords = stdRecords.map(s => {
        return `${s.rawRecordId}`;
      }).filter(Boolean);
      mergedData['来源记录ID'] = rawRecords.join('; ');
    }

    exportData.push(mergedData);
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  switch (format) {
    case 'json':
      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      break;
    case 'csv':
      const csvContent = convertToCsv(exportData);
      fs.writeFileSync(outputPath, csvContent, 'utf8');
      break;
    case 'xlsx':
    default:
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '工单数据');

      if (options.includeRaw) {
        const errors = await db.getUnresolvedErrors();
        const errorData = errors.map(e => ({
          错误ID: e.id,
          记录ID: e.recordId,
          字段: e.fieldName,
          错误码: e.errorCode,
          错误信息: e.errorMessage,
          严重程度: e.severity,
          创建时间: moment(e.createdAt).format('YYYY-MM-DD HH:mm'),
        }));
        const wsErrors = XLSX.utils.json_to_sheet(errorData);
        XLSX.utils.book_append_sheet(wb, wsErrors, '错误清单');
      }

      XLSX.writeFile(wb, outputPath);
      break;
  }

  console.log(chalk.green(`✓ 导出成功!`));
  console.log(chalk.gray(`  导出记录数: ${exportData.length}`));
  console.log(chalk.gray(`  文件路径: ${outputPath}`));
}

function convertToCsv(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const headerLine = headers.join(',');

  const lines = data.map(row => {
    return headers.map(h => {
      let value = row[h] || '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    }).join(',');
  });

  return [headerLine, ...lines].join('\n');
}
