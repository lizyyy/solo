import csvParser from 'csv-parser';
import { Readable } from 'stream';
import {
  AdjustmentRecord,
  AdjustmentType,
  AdjustmentStatus,
  BatchImportResult,
  ImportError,
  ApiResponse,
  NextActionItem
} from '../types';
import { db } from '../store/database';
import { adjustmentService } from './adjustment.service';

class BatchImportService {
  async parseCSV(fileBuffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const bufferStream = new Readable();
      bufferStream.push(fileBuffer);
      bufferStream.push(null);

      bufferStream
        .pipe(csvParser({
          headers: true,
          skipLines: 0
        }))
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error: Error) => reject(error));
    });
  }

  validateRow(row: any, rowIndex: number): ImportError[] {
    const errors: ImportError[] = [];

    if (!row.rentalNo || row.rentalNo.trim() === '') {
      errors.push({
        rowNumber: rowIndex + 1,
        field: 'rentalNo',
        value: row.rentalNo,
        errorMessage: '租借单号不能为空'
      });
    }

    if (!row.newEquipmentCode || row.newEquipmentCode.trim() === '') {
      errors.push({
        rowNumber: rowIndex + 1,
        field: 'newEquipmentCode',
        value: row.newEquipmentCode,
        errorMessage: '新装备编号不能为空'
      });
    }

    if (!row.adjustmentType || !Object.values(AdjustmentType).includes(row.adjustmentType as AdjustmentType)) {
      errors.push({
        rowNumber: rowIndex + 1,
        field: 'adjustmentType',
        value: row.adjustmentType,
        errorMessage: `调码类型不正确，可选值：${Object.values(AdjustmentType).join(', ')}`
      });
    }

    if (!row.adjustmentReason || row.adjustmentReason.trim() === '') {
      errors.push({
        rowNumber: rowIndex + 1,
        field: 'adjustmentReason',
        value: row.adjustmentReason,
        errorMessage: '调码原因不能为空'
      });
    }

    if (row.additionalCharge && isNaN(parseFloat(row.additionalCharge))) {
      errors.push({
        rowNumber: rowIndex + 1,
        field: 'additionalCharge',
        value: row.additionalCharge,
        errorMessage: '附加费用必须是数字'
      });
    }

    return errors;
  }

  async importAdjustments(
    fileBuffer: Buffer,
    operatorId: string,
    operatorName: string,
    rentalPointCode: string,
    rentalPointName: string
  ): Promise<ApiResponse<BatchImportResult>> {
    let rows: any[];
    try {
      rows = await this.parseCSV(fileBuffer);
    } catch (error) {
      return {
        success: false,
        message: 'CSV文件解析失败',
        errorCode: 'PARSE_ERROR'
      };
    }

    const errors: ImportError[] = [];
    const successIds: string[] = [];
    let nextActions: NextActionItem[] = [];
    let requiredMaterials: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors = this.validateRow(row, i);

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      const rental = db.getRentalByNo(row.rentalNo.trim());
      if (!rental) {
        errors.push({
          rowNumber: i + 1,
          field: 'rentalNo',
          value: row.rentalNo,
          errorMessage: '租借记录不存在'
        });
        continue;
      }

      const newEquipment = db.getEquipmentByCode(row.newEquipmentCode.trim());
      if (!newEquipment) {
        errors.push({
          rowNumber: i + 1,
          field: 'newEquipmentCode',
          value: row.newEquipmentCode,
          errorMessage: '新装备不存在'
        });
        continue;
      }

      const result = await adjustmentService.createAdjustment({
        rentalRecordId: rental.id,
        adjustmentType: row.adjustmentType as AdjustmentType,
        newEquipmentId: newEquipment.id,
        adjustmentReason: row.adjustmentReason,
        additionalCharge: parseFloat(row.additionalCharge || '0'),
        depositAdjustment: parseFloat(row.depositAdjustment || '0'),
        rentalPointCode,
        rentalPointName,
        operatorId,
        operatorName
      });

      if (result.success && result.data) {
        successIds.push(result.data.id);
        if (result.nextActions) {
          nextActions = [...nextActions, ...result.nextActions];
        }
        if (result.requiredMaterials) {
          requiredMaterials = [...requiredMaterials, ...result.requiredMaterials];
        }
      } else {
        errors.push({
          rowNumber: i + 1,
          field: 'system',
          value: row.rentalNo,
          errorMessage: result.message
        });
      }
    }

    requiredMaterials = [...new Set(requiredMaterials)];

    return {
      success: true,
      data: {
        successCount: successIds.length,
        failCount: errors.length,
        totalCount: rows.length,
        errors,
        batchNo: `BATCH-${Date.now()}`
      },
      message: `批量导入完成：成功${successIds.length}条，失败${errors.length}条`,
      nextActions: nextActions.length > 0 ? nextActions : undefined,
      requiredMaterials: requiredMaterials.length > 0 ? requiredMaterials : undefined
    };
  }

  getImportTemplate(): string {
    const headers = [
      'rentalNo',
      'newEquipmentCode',
      'adjustmentType',
      'adjustmentReason',
      'additionalCharge',
      'depositAdjustment'
    ];

    const sampleRows = [
      ['RENT-20240501-001', 'SB-BR-002', 'SIZE_EXCHANGE', '客户反映雪板尺寸偏大需要更换小一号', '50', '0'],
      ['RENT-20240501-002', 'SB-RO-003', 'EQUIPMENT_EXCHANGE', '雪板固定器故障需更换装备', '0', '100']
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
  }
}

export const batchImportService = new BatchImportService();
