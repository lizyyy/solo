import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../models/database';
import { SampleRetention, TemperatureLog, DiscardRecord } from '../models/types';

export class ExportService {
  async exportSampleRetention(startDate: string, endDate: string, outputDir: string): Promise<string> {
    const rows = await db.all(
      `SELECT * FROM sample_retention WHERE date >= ? AND date <= ? ORDER BY date DESC`,
      [startDate, endDate]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('留样记录');

    worksheet.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '菜品名称', key: 'dishName', width: 20 },
      { header: '菜品类型', key: 'dishType', width: 12 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '留样人', key: 'reservedBy', width: 12 },
      { header: '留样时间', key: 'reservedAt', width: 20 },
      { header: '存放位置', key: 'storageLocation', width: 15 },
      { header: '废弃日期', key: 'discardDate', width: 12 },
      { header: '状态', key: 'status', width: 10 },
      { header: '备注', key: 'remarks', width: 20 }
    ];

    rows.forEach(row => {
      worksheet.addRow({
        date: row.date,
        dishName: row.dish_name,
        dishType: row.dish_type,
        quantity: row.quantity,
        reservedBy: row.reserved_by,
        reservedAt: row.reserved_at,
        storageLocation: row.storage_location,
        discardDate: row.discard_date,
        status: this.translateStatus(row.status),
        remarks: row.remarks || ''
      });
    });

    worksheet.getRow(1).font = { bold: true };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `留样记录_${startDate}_${endDate}.xlsx`;
    const filePath = path.join(outputDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  async exportTemperatureLog(startDate: string, endDate: string, outputDir: string): Promise<string> {
    const rows = await db.all(
      `SELECT * FROM temperature_log WHERE date >= ? AND date <= ? ORDER BY date DESC`,
      [startDate, endDate]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('温度记录');

    worksheet.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '冰箱编号', key: 'refrigeratorId', width: 12 },
      { header: '冰箱名称', key: 'refrigeratorName', width: 15 },
      { header: '温度(℃)', key: 'temperature', width: 10 },
      { header: '最低温度(℃)', key: 'minTemperature', width: 12 },
      { header: '最高温度(℃)', key: 'maxTemperature', width: 12 },
      { header: '是否正常', key: 'isNormal', width: 10 },
      { header: '测量人', key: 'measuredBy', width: 12 },
      { header: '测量时间', key: 'measuredAt', width: 20 },
      { header: '状态', key: 'status', width: 10 },
      { header: '备注', key: 'remarks', width: 20 }
    ];

    rows.forEach(row => {
      worksheet.addRow({
        date: row.date,
        refrigeratorId: row.refrigerator_id,
        refrigeratorName: row.refrigerator_name,
        temperature: row.temperature,
        minTemperature: row.min_temperature,
        maxTemperature: row.max_temperature,
        isNormal: row.is_normal === 1 ? '是' : '否',
        measuredBy: row.measured_by,
        measuredAt: row.measured_at,
        status: this.translateStatus(row.status),
        remarks: row.remarks || ''
      });
    });

    worksheet.getRow(1).font = { bold: true };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `温度记录_${startDate}_${endDate}.xlsx`;
    const filePath = path.join(outputDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  async exportFailedRecords(importId: string, outputDir: string): Promise<string> {
    const rows = await db.all(
      `SELECT * FROM failed_record WHERE import_id = ? ORDER BY row_number`,
      [importId]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('错误记录');

    worksheet.columns = [
      { header: '行号', key: 'rowNumber', width: 8 },
      { header: '原始数据', key: 'originalData', width: 50 },
      { header: '错误原因', key: 'errorMessage', width: 40 },
      { header: '修改建议', key: 'suggestion', width: 40 },
      { header: '是否已解决', key: 'isResolved', width: 12 }
    ];

    rows.forEach(row => {
      worksheet.addRow({
        rowNumber: row.row_number,
        originalData: row.original_data,
        errorMessage: row.error_message,
        suggestion: row.suggestion,
        isResolved: row.is_resolved === 1 ? '是' : '否'
      });
    });

    worksheet.getRow(1).font = { bold: true };

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `导入错误记录_${importId.substring(0, 8)}.xlsx`;
    const filePath = path.join(outputDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  async exportAll(startDate: string, endDate: string, outputDir: string): Promise<string[]> {
    const files: string[] = [];

    files.push(await this.exportSampleRetention(startDate, endDate, outputDir));
    files.push(await this.exportTemperatureLog(startDate, endDate, outputDir));

    return files;
  }

  async exportMonthlyReport(year: number, month: number, outputDir: string): Promise<string> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('月度汇总');
    summarySheet.columns = [
      { header: '统计项', key: 'item', width: 30 },
      { header: '数值', key: 'value', width: 20 }
    ];

    const sampleStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
      FROM sample_retention WHERE date >= ? AND date <= ?
    `, [startDate, endDate]);

    const tempStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_normal = 1 THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN is_normal = 0 THEN 1 ELSE 0 END) as abnormal,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified
      FROM temperature_log WHERE date >= ? AND date <= ?
    `, [startDate, endDate]);

    summarySheet.addRow({ item: '统计周期', value: `${year}年${month}月` });
    summarySheet.addRow({ item: '留样记录总数', value: sampleStats?.total || 0 });
    summarySheet.addRow({ item: '留样已复核数', value: sampleStats?.verified || 0 });
    summarySheet.addRow({ item: '温度记录总数', value: tempStats?.total || 0 });
    summarySheet.addRow({ item: '温度正常记录数', value: tempStats?.normal || 0 });
    summarySheet.addRow({ item: '温度异常记录数', value: tempStats?.abnormal || 0 });
    summarySheet.addRow({ item: '温度已复核数', value: tempStats?.verified || 0 });

    summarySheet.getRow(1).font = { bold: true };

    await this.addDetailSheet(workbook, '留样明细', 'sample_retention', startDate, endDate, [
      { header: '日期', key: 'date', width: 12 },
      { header: '菜品名称', key: 'dish_name', width: 20 },
      { header: '数量', key: 'quantity', width: 10 },
      { header: '留样人', key: 'reserved_by', width: 12 }
    ]);

    await this.addDetailSheet(workbook, '温度明细', 'temperature_log', startDate, endDate, [
      { header: '日期', key: 'date', width: 12 },
      { header: '冰箱名称', key: 'refrigerator_name', width: 15 },
      { header: '温度', key: 'temperature', width: 10 },
      { header: '是否正常', key: 'is_normal', width: 10 },
      { header: '测量人', key: 'measured_by', width: 12 }
    ]);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `品控月度报告_${year}年${month}月.xlsx`;
    const filePath = path.join(outputDir, fileName);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  private async addDetailSheet(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    tableName: string,
    startDate: string,
    endDate: string,
    columns: Array<{ header: string; key: string; width: number }>
  ): Promise<void> {
    const rows = await db.all(
      `SELECT * FROM ${tableName} WHERE date >= ? AND date <= ? ORDER BY date DESC`,
      [startDate, endDate]
    );

    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.columns = columns;

    rows.forEach(row => {
      const rowData: any = {};
      columns.forEach(col => {
        rowData[col.key] = row[col.key];
        if (col.key === 'is_normal') {
          rowData[col.key] = row[col.key] === 1 ? '是' : '否';
        }
      });
      worksheet.addRow(rowData);
    });

    worksheet.getRow(1).font = { bold: true };
  }

  private translateStatus(status: string): string {
    const mapping: Record<string, string> = {
      'pending': '待复核',
      'verified': '已复核',
      'rejected': '已拒绝'
    };
    return mapping[status] || status;
  }
}

export const exportService = new ExportService();