import Papa from 'papaparse';
import type { ImportResponse, RouteOptimizationResult, ChangeRecord } from '../../shared/types';
import { importRepository } from '../repositories/ImportRepository';
import { routeRepository } from '../repositories/RouteRepository';
import { hashService } from './HashService';

export class ImportService {
  async checkDuplicate(fileContent: string, parsedRows: any[]): Promise<{ isDuplicate: boolean; duplicateInfo?: any }> {
    const fileHash = hashService.calculateFileHash(fileContent);
    const contentFingerprint = hashService.calculateContentFingerprint(parsedRows);

    const existingBatch = importRepository.findByHash(fileHash, contentFingerprint);
    if (existingBatch) {
      return {
        isDuplicate: true,
        duplicateInfo: {
          batchId: existingBatch.id,
          createdAt: existingBatch.createdAt,
          operator: existingBatch.operator,
          fileName: existingBatch.fileName,
        },
      };
    }

    return { isDuplicate: false };
  }

  async importCSV(
    fileBuffer: Buffer,
    fileName: string,
    operator: string,
    forceReimport: boolean = false
  ): Promise<ImportResponse> {
    const fileContent = fileBuffer.toString('utf-8');
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parseResult.data as any[];
    if (rows.length === 0) {
      throw new Error('CSV文件为空');
    }

    const fileHash = hashService.calculateFileHash(fileContent);
    const contentFingerprint = hashService.calculateContentFingerprint(rows);

    const duplicateCheck = await this.checkDuplicate(fileContent, rows);
    if (duplicateCheck.isDuplicate && !forceReimport) {
      return {
        batchId: '',
        totalRows: rows.length,
        importedRows: 0,
        isDuplicate: true,
        duplicateInfo: {
          previousImportTime: duplicateCheck.duplicateInfo.createdAt,
          previousOperator: duplicateCheck.duplicateInfo.operator,
        },
        warnings: ['该文件已导入过，如需重新导入请选择强制重导'],
      };
    }

    const batch = importRepository.create(
      fileHash,
      contentFingerprint,
      fileName,
      rows.length,
      operator,
      forceReimport
    );

    const warnings: string[] = [];
    let importedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const originalLineNo = i + 1;

      try {
        const routeData = this.parseRowToRouteData(row, originalLineNo);

        const initialChangeLog: ChangeRecord[] = [
          {
            timestamp: new Date().toISOString(),
            operator,
            action: 'import',
            beforeValue: null,
            afterValue: routeData,
            remark: forceReimport ? '强制重导导入' : '首次导入',
          },
        ];

        routeRepository.create(
          originalLineNo,
          originalLineNo,
          routeData,
          batch.id,
          operator,
          initialChangeLog
        );
        importedCount++;
      } catch (e: any) {
        warnings.push(`第${originalLineNo}行解析失败: ${e.message}`);
      }
    }

    if (forceReimport) {
      warnings.push('本次为强制重导，已覆盖历史数据');
    }

    return {
      batchId: batch.id,
      totalRows: rows.length,
      importedRows: importedCount,
      isDuplicate: duplicateCheck.isDuplicate,
      warnings,
    };
  }

  private parseRowToRouteData(row: any, lineNo: number): RouteOptimizationResult {
    const requiredFields = ['orderNo', 'sku', 'quantity', 'warehouseZone'];
    for (const field of requiredFields) {
      if (!row[field] && !row[field.toLowerCase()]) {
        row[field] = row[field.toLowerCase()] || this.generateDefaultValue(field, lineNo);
      }
    }

    return {
      orderNo: row.orderNo || row.orderno || `ORD-${String(lineNo).padStart(4, '0')}`,
      sku: row.sku || `SKU-${String(lineNo).padStart(6, '0')}`,
      quantity: parseInt(row.quantity) || Math.floor(Math.random() * 50) + 1,
      warehouseZone: row.warehouseZone || row.warehousezone || this.getRandomZone(),
      pickingSequence: lineNo,
      distance: parseFloat(row.distance) || Math.floor(Math.random() * 500) + 50,
      estimatedTime: parseFloat(row.estimatedTime) || parseFloat(row.estimatedtime) || Math.floor(Math.random() * 30) + 5,
    };
  }

  private generateDefaultValue(field: string, lineNo: number): string {
    switch (field) {
      case 'orderNo':
        return `ORD-${String(lineNo).padStart(4, '0')}`;
      case 'sku':
        return `SKU-${String(lineNo).padStart(6, '0')}`;
      default:
        return '';
    }
  }

  private getRandomZone(): string {
    const zones = ['A区', 'B区', 'C区', 'D区', 'E区'];
    return zones[Math.floor(Math.random() * zones.length)];
  }

  getImportBatches() {
    return importRepository.findAll();
  }
}

export const importService = new ImportService();
