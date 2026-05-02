import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import {
  BloodBag,
  Application,
  Ward,
  AuditLog,
  CreateBloodBagInput,
  BloodType,
  BloodComponentType,
} from '../types';
import {
  createBloodBag,
  getBloodBags,
  getApplications,
  getAllWards,
  getAuditLogs,
  getWardById,
  checkTemperatureAnomaly,
} from '../storage';

interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

interface CSVRow {
  [key: string]: string | undefined;
}

export async function importBloodBagsFromCSV(
  csvContent: string,
  operator: string
): Promise<ImportResult> {
  const results: ImportResult = {
    success: true,
    total: 0,
    imported: 0,
    failed: 0,
    errors: [],
    warnings: [],
  };

  const rows: CSVRow[] = [];
  
  return new Promise((resolve) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csvParser())
      .on('data', (row: CSVRow) => {
        rows.push(row);
      })
      .on('end', () => {
        results.total = rows.length;

        for (const [index, row] of rows.entries()) {
          const lineNumber = index + 2;

          try {
            const input = parseCSVRow(row, lineNumber, results);
            if (input) {
              createBloodBag(input);
              results.imported++;
            }
          } catch (error) {
            results.failed++;
            results.errors.push(
              `第${lineNumber}行: ${error instanceof Error ? error.message : '未知错误'}`
            );
          }
        }

        if (results.failed > 0) {
          results.success = false;
        }

        resolve(results);
      });
  });
}

function parseCSVRow(
  row: CSVRow,
  lineNumber: number,
  results: ImportResult
): CreateBloodBagInput | null {
  const requiredFields = ['bloodType', 'componentType', 'volume', 'donorId', 'collectionDate', 'expiryDate'];
  const altFieldNames: Record<string, string[]> = {
    bloodType: ['血型', 'blood_type', 'BloodType'],
    componentType: ['成分类型', 'component_type', 'ComponentType'],
    volume: ['容量', 'Volume'],
    donorId: ['献血者ID', 'donor_id', 'DonorId'],
    collectionDate: ['采集日期', 'collection_date', 'CollectionDate'],
    expiryDate: ['有效期', 'expiry_date', 'ExpiryDate', '过期日期'],
  };

  const getFieldValue = (field: string): string | undefined => {
    if (row[field]) return row[field];
    for (const alt of altFieldNames[field] || []) {
      if (row[alt]) return row[alt];
    }
    return undefined;
  };

  for (const field of requiredFields) {
    if (!getFieldValue(field)) {
      throw new Error(`缺少必填字段: ${field}`);
    }
  }

  const bloodType = getFieldValue('bloodType') as BloodType;
  const validBloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (!validBloodTypes.includes(bloodType)) {
    throw new Error(`无效的血型: ${bloodType}，有效类型: ${validBloodTypes.join(', ')}`);
  }

  const componentType = getFieldValue('componentType') as BloodComponentType;
  const componentTypeMap: Record<string, BloodComponentType> = {
    'RED_CELL': 'RED_CELL',
    '红细胞': 'RED_CELL',
    '红细胞悬液': 'RED_CELL',
    'PLASMA': 'PLASMA',
    '血浆': 'PLASMA',
    '新鲜冰冻血浆': 'PLASMA',
    'PLATELET': 'PLATELET',
    '血小板': 'PLATELET',
    'CRYOPRECIPITATE': 'CRYOPRECIPITATE',
    '冷沉淀': 'CRYOPRECIPITATE',
  };

  const mappedComponentType = componentTypeMap[componentType.toUpperCase()];
  if (!mappedComponentType) {
    throw new Error(`无效的成分类型: ${componentType}`);
  }

  const volumeStr = getFieldValue('volume');
  const volume = parseInt(volumeStr || '0', 10);
  if (isNaN(volume) || volume <= 0) {
    throw new Error(`无效的容量: ${volumeStr}`);
  }

  const donorId = getFieldValue('donorId') as string;
  const collectionDate = parseDate(getFieldValue('collectionDate') as string);
  const expiryDate = parseDate(getFieldValue('expiryDate') as string);

  if (new Date(expiryDate) <= new Date()) {
    results.warnings.push(`第${lineNumber}行: 血袋已过期，导入后状态为AVAILABLE`);
  }

  const crossMatchStatus = getFieldValue('crossMatchStatus') || getFieldValue('交叉配血状态');
  const validCrossMatchStatuses = ['PENDING', 'COMPATIBLE', 'INCOMPATIBLE', 'NOT_REQUIRED'];
  let parsedCrossMatchStatus: 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED' | undefined;
  
  if (crossMatchStatus) {
    const statusMap: Record<string, 'PENDING' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'NOT_REQUIRED'> = {
      'PENDING': 'PENDING',
      '待配': 'PENDING',
      'COMPATIBLE': 'COMPATIBLE',
      '相容': 'COMPATIBLE',
      '主侧相合': 'COMPATIBLE',
      'INCOMPATIBLE': 'INCOMPATIBLE',
      '不相容': 'INCOMPATIBLE',
      'NOT_REQUIRED': 'NOT_REQUIRED',
      '无需配血': 'NOT_REQUIRED',
    };
    parsedCrossMatchStatus = statusMap[crossMatchStatus.toUpperCase()];
    if (!parsedCrossMatchStatus && !validCrossMatchStatuses.includes(crossMatchStatus.toUpperCase())) {
      results.warnings.push(`第${lineNumber}行: 无效的交叉配血状态: ${crossMatchStatus}，使用默认值PENDING`);
    }
  }

  const initialTempStr = getFieldValue('initialTemperature') || getFieldValue('初始温度');
  let initialTemperature: number | undefined;
  if (initialTempStr) {
    initialTemperature = parseFloat(initialTempStr);
    if (isNaN(initialTemperature)) {
      results.warnings.push(`第${lineNumber}行: 无效的初始温度: ${initialTempStr}`);
      initialTemperature = undefined;
    }
  }

  const notes = getFieldValue('notes') || getFieldValue('备注');

  return {
    bloodType,
    componentType: mappedComponentType,
    volume,
    donorId,
    collectionDate,
    expiryDate,
    crossMatchStatus: parsedCrossMatchStatus,
    initialTemperature,
    notes,
  };
}

function parseDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`无效的日期格式: ${dateStr}`);
  }
  return date.toISOString();
}

export function exportInventoryToCSV(): string {
  const bloodBags = getBloodBags();
  
  const headers = [
    'ID', '血型', '成分类型', '容量', '献血者ID',
    '采集日期', '有效期', '交叉配血状态', '状态',
    '温控记录数', '是否有温控异常', '入库时间', '备注'
  ];

  const rows = bloodBags.map((bag) => {
    const hasAnomaly = checkTemperatureAnomaly(bag);
    
    return [
      bag.id,
      bag.bloodType,
      bag.componentType,
      bag.volume,
      bag.donorId,
      formatDateForCSV(bag.collectionDate),
      formatDateForCSV(bag.expiryDate),
      bag.crossMatchStatus,
      bag.status,
      bag.temperatureRecords.length,
      hasAnomaly ? '是' : '否',
      formatDateForCSV(bag.receivedAt),
      bag.notes || '',
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join('\n');
}

export function generateShiftReport(
  shiftStart: string,
  shiftEnd: string,
  format: 'markdown' | 'csv'
): string {
  const bloodBags = getBloodBags();
  const applications = getApplications();
  const wards = getAllWards();
  const auditLogs = getAuditLogs({
    startDate: shiftStart,
    endDate: shiftEnd,
  });

  const availableBags = bloodBags.filter((b) => b.status === 'AVAILABLE');
  const reservedBags = bloodBags.filter((b) => b.status === 'RESERVED');
  const issuedBags = bloodBags.filter((b) => b.status === 'ISSUED');
  const expiredBags = bloodBags.filter((b) => b.status === 'EXPIRED');
  
  const expiringSoon = bloodBags.filter((b) => {
    const hoursUntilExpiry = (new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilExpiry <= 48 && hoursUntilExpiry > 0 && b.status === 'AVAILABLE';
  });

  const bloodTypeStats: Record<string, { available: number; total: number }> = {};
  for (const bag of bloodBags) {
    if (!bloodTypeStats[bag.bloodType]) {
      bloodTypeStats[bag.bloodType] = { available: 0, total: 0 };
    }
    bloodTypeStats[bag.bloodType].total++;
    if (bag.status === 'AVAILABLE') {
      bloodTypeStats[bag.bloodType].available++;
    }
  }

  const shiftApplications = applications.filter((a) => {
    const reqTime = new Date(a.requestedAt).getTime();
    const start = new Date(shiftStart).getTime();
    const end = new Date(shiftEnd).getTime();
    return reqTime >= start && reqTime <= end;
  });

  const issuedDuringShift = auditLogs.filter((log) => 
    log.action === 'ISSUE' && log.entityType === 'BLOOD_BAG'
  );

  if (format === 'csv') {
    return generateShiftReportCSV({
      bloodTypeStats,
      availableCount: availableBags.length,
      reservedCount: reservedBags.length,
      issuedCount: issuedBags.length,
      expiredCount: expiredBags.length,
      expiringSoonCount: expiringSoon.length,
      shiftApplications,
      issuedDuringShift,
      shiftStart,
      shiftEnd,
    });
  }

  return generateShiftReportMarkdown({
    bloodTypeStats,
    availableCount: availableBags.length,
    reservedCount: reservedBags.length,
    issuedCount: issuedBags.length,
    expiredCount: expiredBags.length,
    expiringSoonCount: expiringSoon.length,
    shiftApplications,
    issuedDuringShift,
    shiftStart,
    shiftEnd,
    bloodBags,
    wards,
  });
}

interface ReportData {
  bloodTypeStats: Record<string, { available: number; total: number }>;
  availableCount: number;
  reservedCount: number;
  issuedCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  shiftApplications: Application[];
  issuedDuringShift: AuditLog[];
  shiftStart: string;
  shiftEnd: string;
  bloodBags?: BloodBag[];
  wards?: Ward[];
}

function generateShiftReportMarkdown(data: ReportData): string {
  const lines: string[] = [];

  lines.push('# 血库值班报告');
  lines.push('');
  lines.push(`**值班时间**: ${formatDateTime(data.shiftStart)} - ${formatDateTime(data.shiftEnd)}`);
  lines.push(`**生成时间**: ${formatDateTime(new Date().toISOString())}`);
  lines.push('');

  lines.push('## 一、库存概览');
  lines.push('');
  lines.push('| 血型 | 可用 | 总计 |');
  lines.push('|------|------|------|');
  
  const sortedTypes = Object.keys(data.bloodTypeStats).sort();
  for (const type of sortedTypes) {
    const stats = data.bloodTypeStats[type];
    lines.push(`| ${type} | ${stats.available} | ${stats.total} |`);
  }
  lines.push('');

  lines.push('## 二、状态统计');
  lines.push('');
  lines.push(`- **可用血袋**: ${data.availableCount} 袋`);
  lines.push(`- **已预留**: ${data.reservedCount} 袋`);
  lines.push(`- **已出库**: ${data.issuedCount} 袋`);
  lines.push(`- **已过期**: ${data.expiredCount} 袋`);
  lines.push(`- **临期预警(48小时内)**: ${data.expiringSoonCount} 袋`);
  lines.push('');

  if (data.expiringSoonCount > 0 && data.bloodBags) {
    lines.push('## 三、临期血袋明细');
    lines.push('');
    lines.push('| 血袋ID | 血型 | 成分类型 | 有效期(剩余小时) | 状态 |');
    lines.push('|--------|------|----------|------------------|------|');
    
    const expiringBags = data.bloodBags.filter((b) => {
      const hoursUntilExpiry = (new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilExpiry <= 48 && hoursUntilExpiry > 0 && b.status === 'AVAILABLE';
    });

    for (const bag of expiringBags) {
      const hoursLeft = Math.round((new Date(bag.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60));
      lines.push(`| ${bag.id} | ${bag.bloodType} | ${bag.componentType} | ${hoursLeft}h | ${bag.status} |`);
    }
    lines.push('');
  }

  lines.push('## 四、本班申请单');
  lines.push('');
  if (data.shiftApplications.length === 0) {
    lines.push('本班无申请单。');
  } else {
    lines.push('| 申请单ID | 病区 | 患者 | 血型 | 成分 | 数量 | 紧急程度 | 状态 |');
    lines.push('|----------|------|------|------|------|------|----------|------|');

    for (const app of data.shiftApplications) {
      const ward = data.wards?.find((w) => w.id === app.wardId);
      lines.push(
        `| ${app.id} | ${ward?.name || app.wardId} | ${app.patientName} | ${app.bloodType} | ${app.componentType} | ${app.quantity} | ${app.urgency} | ${app.status} |`
      );
    }
  }
  lines.push('');

  lines.push('## 五、本班出库记录');
  lines.push('');
  if (data.issuedDuringShift.length === 0) {
    lines.push('本班无出库记录。');
  } else {
    lines.push('| 时间 | 血袋ID | 操作人 |');
    lines.push('|------|--------|--------|');

    for (const log of data.issuedDuringShift) {
      lines.push(`| ${formatDateTime(log.timestamp)} | ${log.entityId} | ${log.operator} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('*本报告由系统自动生成*');

  return lines.join('\n');
}

function generateShiftReportCSV(data: ReportData): string {
  const lines: string[] = [];

  lines.push('值班报告,,' + formatDateTime(data.shiftStart) + ' - ' + formatDateTime(data.shiftEnd));
  lines.push('');

  lines.push('库存概览,');
  lines.push('血型,可用,总计');
  const sortedTypes = Object.keys(data.bloodTypeStats).sort();
  for (const type of sortedTypes) {
    const stats = data.bloodTypeStats[type];
    lines.push(`${type},${stats.available},${stats.total}`);
  }
  lines.push('');

  lines.push('状态统计,');
  lines.push(`可用血袋,${data.availableCount}`);
  lines.push(`已预留,${data.reservedCount}`);
  lines.push(`已出库,${data.issuedCount}`);
  lines.push(`已过期,${data.expiredCount}`);
  lines.push(`临期预警(48小时内),${data.expiringSoonCount}`);
  lines.push('');

  lines.push('本班申请单,');
  if (data.shiftApplications.length > 0) {
    lines.push('申请单ID,患者,血型,成分,数量,紧急程度,状态');
    for (const app of data.shiftApplications) {
      lines.push(
        `${app.id},${escapeCSV(app.patientName)},${app.bloodType},${app.componentType},${app.quantity},${app.urgency},${app.status}`
      );
    }
  } else {
    lines.push('无申请单');
  }

  return lines.join('\n');
}

function formatDateForCSV(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
