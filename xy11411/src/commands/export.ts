import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import xlsx from 'xlsx';
import { dbService } from '../services/database';
import { createStateManager } from '../services/stateManager';
import { AutoCheckService } from '../services/autoCheck';
import { formatDate, formatCurrency } from '../utils/fileUtils';
import { RecordStatus, DataSourceType, TeaMaterialRecord } from '../models/types';

export async function exportCommand(options: {
  format?: string;
  output?: string;
  batchId?: string;
  validOnly?: boolean;
  includeHistory?: boolean;
  operator?: string;
}): Promise<void> {
  console.log(chalk.blue('\n=== 导出数据 ===\n'));

  try {
    const operatorId = options.operator || 'default-admin';
    const stateManager = await createStateManager(operatorId);
    const autoCheck = new AutoCheckService(stateManager);

    const hasPermission = await autoCheck.checkPermission('export', 'data');
    if (!hasPermission) {
      console.error(chalk.red('✗ 权限不足: 没有导出数据的权限'));
      process.exit(1);
    }

    const { consistent, inconsistencies } = await autoCheck.checkDataConsistency();
    if (!consistent) {
      console.log(chalk.yellow(`⚠️  检测到 ${inconsistencies.length} 个数据一致性问题`));
      for (const issue of inconsistencies.slice(0, 5)) {
        console.log(chalk.yellow(`  - ${issue.message}`));
      }
    }

    let records = await dbService.getAllRecords();

    if (options.batchId) {
      records = records.filter(r => r.rawData.importBatchId === options.batchId);
    }

    if (options.validOnly) {
      records = records.filter(r =>
        r.status === RecordStatus.VALID ||
        r.status === RecordStatus.EXPORTED
      );
    }

    if (records.length === 0) {
      console.log(chalk.yellow('没有可导出的数据'));
      return;
    }

    const config = dbService.getConfig();
    const format = options.format || 'json';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `export_${timestamp}.${format}`;
    const outputPath = options.output || path.join(config.exportDir, defaultFilename);

    console.log(chalk.gray(`导出记录数: ${records.length}`));
    console.log(chalk.gray(`导出格式: ${format}`));
    console.log(chalk.gray(`输出路径: ${outputPath}`));
    console.log();

    let exportedCount = 0;
    let failedCount = 0;

    switch (format) {
      case 'json':
        await exportToJson(records, outputPath, options.includeHistory || false);
        exportedCount = records.length;
        break;
      case 'csv':
        await exportToCsv(records, outputPath);
        exportedCount = records.length;
        break;
      case 'xlsx':
      case 'excel':
        await exportToExcel(records, outputPath);
        exportedCount = records.length;
        break;
      default:
        console.error(chalk.red(`✗ 不支持的导出格式: ${format}`));
        process.exit(1);
    }

    for (const record of records) {
      try {
        await stateManager.transitionState(
          record.id,
          record.status,
          RecordStatus.EXPORTED,
          '数据导出',
          {
            format,
            outputPath,
            exportedAt: Date.now()
          }
        );
      } catch (e) {
        failedCount++;
      }
    }

    await stateManager.logAction('data_exported', 'export', undefined, {
      format,
      outputPath,
      totalRecords: records.length,
      exportedCount,
      failedCount,
      batchId: options.batchId,
      validOnly: options.validOnly || false,
      dataConsistent: consistent,
      inconsistencyCount: inconsistencies.length
    });

    console.log(chalk.green(`✓ 导出成功!`));
    console.log(chalk.gray(`  导出记录: ${exportedCount} 条`));
    console.log(chalk.gray(`  输出文件: ${outputPath}`));

    if (failedCount > 0) {
      console.log(chalk.yellow(`  ⚠️  状态更新失败: ${failedCount} 条`));
    }

  } catch (error) {
    console.error(chalk.red('\n✗ 导出失败:'), (error as Error).message);
    process.exit(1);
  }
}

async function exportToJson(
  records: TeaMaterialRecord[],
  outputPath: string,
  includeHistory: boolean
): Promise<void> {
  const exportData = {
    exportInfo: {
      exportedAt: Date.now(),
      exportedAtFormatted: formatDate(Date.now()),
      totalRecords: records.length,
      includeHistory,
      version: '1.0.0'
    },
    records: records.map(record => {
      const base = {
        id: record.id,
        rawData: record.rawData,
        status: record.status,
        materialCode: record.materialCode,
        materialName: record.materialName,
        quantity: record.quantity,
        unit: record.unit,
        price: record.price,
        totalAmount: record.totalAmount,
        supplier: record.supplier,
        batchNumber: record.batchNumber,
        productionDate: record.productionDate,
        expiryDate: record.expiryDate,
        storeId: record.storeId,
        storeName: record.storeName,
        photoPath: record.photoPath,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        tags: record.tags,
        stateChanges: includeHistory ? record.stateChanges : undefined,
        checkResults: includeHistory ? record.checkResults : undefined
      };
      return base;
    })
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
}

async function exportToCsv(
  records: TeaMaterialRecord[],
  outputPath: string
): Promise<void> {
  const headers = [
    '记录ID',
    '原始行号',
    '数据源类型',
    '来源文件',
    '当前状态',
    '物料编码',
    '物料名称',
    '数量',
    '单位',
    '单价',
    '总金额',
    '供应商',
    '批次号',
    '生产日期',
    '保质期',
    '门店ID',
    '门店名称',
    '创建时间',
    '更新时间'
  ];

  const statusNames: Record<string, string> = {
    pending: '待处理',
    imported: '已导入',
    checking: '校验中',
    valid: '有效',
    invalid: '无效',
    fixing: '修正中',
    fixed: '已修正',
    reimported: '重新导入',
    exported: '已导出',
    archived: '已归档'
  };

  const typeNames: Record<string, string> = {
    order: '订货表',
    loss: '损耗登记',
    price: '总部价格表',
    photo: '异常照片'
  };

  const rows = records.map(record => [
    record.id,
    record.rawData.originalRowNumber,
    typeNames[record.rawData.sourceType] || record.rawData.sourceType,
    record.rawData.sourceFile,
    statusNames[record.status] || record.status,
    record.materialCode || '',
    record.materialName || '',
    record.quantity || '',
    record.unit || '',
    record.price || '',
    record.totalAmount || '',
    record.supplier || '',
    record.batchNumber || '',
    record.productionDate || '',
    record.expiryDate || '',
    record.storeId || '',
    record.storeName || '',
    formatDate(record.createdAt),
    formatDate(record.updatedAt)
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const str = String(cell || '');
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','))
  ].join('\n');

  fs.writeFileSync(outputPath, '\uFEFF' + csvContent, 'utf-8');
}

async function exportToExcel(
  records: TeaMaterialRecord[],
  outputPath: string
): Promise<void> {
  const statusNames: Record<string, string> = {
    pending: '待处理',
    imported: '已导入',
    checking: '校验中',
    valid: '有效',
    invalid: '无效',
    fixing: '修正中',
    fixed: '已修正',
    reimported: '重新导入',
    exported: '已导出',
    archived: '已归档'
  };

  const typeNames: Record<string, string> = {
    order: '订货表',
    loss: '损耗登记',
    price: '总部价格表',
    photo: '异常照片'
  };

  const data = records.map(record => ({
    '记录ID': record.id,
    '原始行号': record.rawData.originalRowNumber,
    '数据源类型': typeNames[record.rawData.sourceType] || record.rawData.sourceType,
    '来源文件': record.rawData.sourceFile,
    '当前状态': statusNames[record.status] || record.status,
    '物料编码': record.materialCode || '',
    '物料名称': record.materialName || '',
    '数量': record.quantity || '',
    '单位': record.unit || '',
    '单价': record.price || '',
    '总金额': record.totalAmount || '',
    '供应商': record.supplier || '',
    '批次号': record.batchNumber || '',
    '生产日期': record.productionDate || '',
    '保质期': record.expiryDate || '',
    '门店ID': record.storeId || '',
    '门店名称': record.storeName || '',
    '创建时间': formatDate(record.createdAt),
    '更新时间': formatDate(record.updatedAt)
  }));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 36 },
    { wch: 10 },
    { wch: 12 },
    { wch: 20 },
    { wch: 10 },
    { wch: 15 },
    { wch: 20 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 20 },
    { wch: 20 }
  ];

  xlsx.utils.book_append_sheet(wb, ws, '导出数据');

  const failureRecords = records.filter(r => r.status === RecordStatus.INVALID);
  if (failureRecords.length > 0) {
    const failureData = failureRecords.map(record => {
      const failedChecks = record.checkResults.filter(c => c.status === 'fail');
      return {
        '记录ID': record.id,
        '原始行号': record.rawData.originalRowNumber,
        '物料名称': record.materialName || '',
        '失败原因': failedChecks.map(c => c.message).join('; '),
        '来源文件': record.rawData.sourceFile,
        '修正次数': record.stateChanges.filter(s =>
          s.toStatus === 'fixing' || s.toStatus === 'fixed'
        ).length
      };
    });

    const wsFailures = xlsx.utils.json_to_sheet(failureData);
    xlsx.utils.book_append_sheet(wb, wsFailures, '失败记录');
  }

  xlsx.writeFile(wb, outputPath);
}
