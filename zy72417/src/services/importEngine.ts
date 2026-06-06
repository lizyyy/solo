import { v4 as uuidv4 } from 'uuid';
import {
  AuthorizationTerm,
  ImportBatch,
  ProcessingStatus,
  AuthorizedCity
} from '../types';
import dataSource from './dataSource';

interface RawImportRow {
  rowNumber: number;
  bandName: string;
  equipmentType: string;
  equipmentModel: string;
  authorizationStartDate: string;
  authorizationEndDate: string;
  authorizedCities: string;
  repairFee: number;
}

export class ImportEngine {
  parseCityText(cityText: string): AuthorizedCity[] {
    if (!cityText || cityText.trim() === '') {
      return [];
    }

    const cities: AuthorizedCity[] = [];
    const pairs = cityText.split(/[,，;；]/).map(s => s.trim()).filter(s => s);
    
    for (const pair of pairs) {
      const parts = pair.split(/[省市区\-\/]/).map(s => s.trim()).filter(s => s);
      if (parts.length >= 2) {
        cities.push({
          province: parts[0] + '省',
          city: parts[1] + (parts[1].endsWith('市') ? '' : '市')
        });
      } else if (parts.length === 1) {
        cities.push({
          province: '',
          city: parts[0] + (parts[0].endsWith('市') ? '' : '市')
        });
      }
    }

    return cities;
  }

  importFromRawData(
    rawRows: RawImportRow[],
    fileName: string,
    importedBy: string
  ): { batch: ImportBatch; terms: AuthorizationTerm[]; errors: string[] } {
    const batchId = uuidv4();
    const errors: string[] = [];
    const terms: AuthorizationTerm[] = [];
    const now = new Date().toISOString();

    console.log(`[ImportEngine] 开始导入批次: ${batchId}, 文件名: ${fileName}, 共 ${rawRows.length} 行`);

    for (const row of rawRows) {
      try {
        const cities = this.parseCityText(row.authorizedCities);
        const term: AuthorizationTerm = {
          id: uuidv4(),
          originalRowNumber: row.rowNumber,
          importBatchId: batchId,
          bandName: row.bandName,
          equipmentType: row.equipmentType,
          equipmentModel: row.equipmentModel,
          authorizationStartDate: row.authorizationStartDate,
          authorizationEndDate: row.authorizationEndDate,
          authorizedCities: cities,
          originalAuthorizedCitiesText: row.authorizedCities,
          repairFee: row.repairFee,
          originalRepairFee: row.repairFee,
          status: ProcessingStatus.IMPORTED,
          createdAt: now,
          updatedAt: now,
          createdBy: importedBy,
          updatedBy: importedBy,
          version: 1
        };

        dataSource.addAuthorizationTerm(term);
        terms.push(term);
      } catch (e: any) {
        errors.push(`第 ${row.rowNumber} 行导入失败: ${e.message}`);
      }
    }

    const batch: ImportBatch = {
      id: batchId,
      fileName,
      importedBy,
      importedAt: now,
      totalRows: rawRows.length,
      successRows: terms.length,
      failedRows: errors.length,
      status: errors.length > 0 ? ProcessingStatus.ABNORMAL : ProcessingStatus.IMPORTED
    };

    dataSource.addImportBatch(batch);

    console.log(`[ImportEngine] 导入完成: 成功 ${terms.length} 条, 失败 ${errors.length} 条`);

    return { batch, terms, errors };
  }

  generateSampleImportData(): RawImportRow[] {
    return [
      {
        rowNumber: 1,
        bandName: '晨光乐队',
        equipmentType: '电吉他',
        equipmentModel: 'Fender Stratocaster',
        authorizationStartDate: '2026-01-01',
        authorizationEndDate: '2026-12-31',
        authorizedCities: '北京,上海,广州',
        repairFee: 1500
      },
      {
        rowNumber: 2,
        bandName: '午后阳光',
        equipmentType: '架子鼓',
        equipmentModel: 'Yamaha Stage Custom',
        authorizationStartDate: '2026-02-01',
        authorizationEndDate: '2026-12-31',
        authorizedCities: '广东-深圳',
        repairFee: 2800
      },
      {
        rowNumber: 3,
        bandName: '夜行者',
        equipmentType: '贝斯',
        equipmentModel: 'Ibanez SR500',
        authorizationStartDate: '2026-03-01',
        authorizationEndDate: '2026-11-30',
        authorizedCities: '江苏',
        repairFee: 1200
      },
      {
        rowNumber: 4,
        bandName: '晨曦乐团',
        equipmentType: '键盘',
        equipmentModel: 'Roland RD-2000',
        authorizationStartDate: '2026-01-15',
        authorizationEndDate: '2026-12-31',
        authorizedCities: '浙江-杭州,四川-成都',
        repairFee: 3200
      },
      {
        rowNumber: 5,
        bandName: '星辰乐队',
        equipmentType: '电吉他',
        equipmentModel: 'Gibson Les Paul',
        authorizationStartDate: '2026-04-01',
        authorizationEndDate: '2026-12-31',
        authorizedCities: '湖北-武汉',
        repairFee: 2000
      }
    ];
  }
}

export const importEngine = new ImportEngine();
export default importEngine;
