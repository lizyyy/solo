// @ts-ignore
const XLSX = require('xlsx');
import { VisitRecord, ChannelRecord, BadRecord } from '../types/index';
import { normalizePhone, isValidPhone } from '../utils/phone';
import { findColumnByConfig, getColumnValue } from '../utils/columnMatcher';
import chalk from 'chalk';

export interface ReadResult<T> {
  records: T[];
  badRecords: BadRecord[];
  totalCount: number;
}

export function readVisitFile(filePath: string): ReadResult<VisitRecord> {
  console.log(chalk.blue(`📖 正在读取来访表: ${filePath}`));
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  if (data.length < 2) {
    throw new Error('来访表数据为空或只有表头');
  }

  const headers = data[0].map(h => String(h || '').trim());
  const records: VisitRecord[] = [];
  const badRecords: BadRecord[] = [];

  const phoneColumn = findColumnByConfig(headers, '电话');
  
  if (!phoneColumn) {
    throw new Error('来访表中未找到电话列，请检查文件格式或使用 --phone-column 指定');
  }

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = rowData[idx];
    });

    const rawPhone = String(row[phoneColumn] || '').trim();
    const normalizedPhone = normalizePhone(rawPhone);

    if (!rawPhone || !isValidPhone(normalizedPhone)) {
      badRecords.push({
        来源文件: '来访表',
        原始行号: i + 1,
        错误原因: !rawPhone ? '电话为空' : '电话格式无效',
        原始数据: row
      });
      continue;
    }

    const record: VisitRecord = {
      原始行号: i + 1,
      客户电话: rawPhone,
      归一化电话: normalizedPhone,
      客户姓名: getColumnValue(row, headers, '客户姓名'),
      来访日期: getColumnValue(row, headers, '来访日期'),
      置业顾问: getColumnValue(row, headers, '置业顾问'),
      渠道名称: getColumnValue(row, headers, '渠道名称'),
      认领状态: getColumnValue(row, headers, '认领状态'),
      ...row
    };

    records.push(record);
  }

  console.log(chalk.green(`  ✅ 来访表读取完成: 共 ${data.length - 1} 行，有效 ${records.length} 条`));
  
  return {
    records,
    badRecords,
    totalCount: data.length - 1
  };
}

export function readChannelFile(filePath: string): ReadResult<ChannelRecord> {
  console.log(chalk.blue(`📖 正在读取渠道表: ${filePath}`));
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  
  if (data.length < 2) {
    throw new Error('渠道表数据为空或只有表头');
  }

  const headers = data[0].map(h => String(h || '').trim());
  const records: ChannelRecord[] = [];
  const badRecords: BadRecord[] = [];

  const phoneColumn = findColumnByConfig(headers, '电话');
  const channelColumn = findColumnByConfig(headers, '渠道名称');
  
  if (!phoneColumn) {
    throw new Error('渠道表中未找到电话列，请检查文件格式或使用 --phone-column 指定');
  }

  for (let i = 1; i < data.length; i++) {
    const rowData = data[i];
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = rowData[idx];
    });

    const rawPhone = String(row[phoneColumn] || '').trim();
    const normalizedPhone = normalizePhone(rawPhone);
    const channelName = channelColumn ? String(row[channelColumn] || '').trim() : '未知渠道';

    if (!rawPhone || !isValidPhone(normalizedPhone)) {
      badRecords.push({
        来源文件: '渠道表',
        原始行号: i + 1,
        错误原因: !rawPhone ? '电话为空' : '电话格式无效',
        原始数据: row
      });
      continue;
    }

    if (!channelName) {
      badRecords.push({
        来源文件: '渠道表',
        原始行号: i + 1,
        错误原因: '渠道名称为空',
        原始数据: row
      });
      continue;
    }

    const record: ChannelRecord = {
      原始行号: i + 1,
      客户电话: rawPhone,
      归一化电话: normalizedPhone,
      客户姓名: getColumnValue(row, headers, '客户姓名'),
      渠道名称: channelName,
      置业顾问: getColumnValue(row, headers, '置业顾问'),
      认领状态: getColumnValue(row, headers, '认领状态'),
      ...row
    };

    records.push(record);
  }

  console.log(chalk.green(`  ✅ 渠道表读取完成: 共 ${data.length - 1} 行，有效 ${records.length} 条`));
  
  return {
    records,
    badRecords,
    totalCount: data.length - 1
  };
}
