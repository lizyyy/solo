import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { CreateCandidateRequest, SourceChannel, ImportError } from '../types';
import { store } from '../store';
import { candidateService } from './candidate.service';

export class ImportService {
  private validateRow(row: Record<string, any>, rowNumber: number): { valid: boolean; errors: ImportError[]; data?: CreateCandidateRequest } {
    const errors: ImportError[] = [];
    
    if (!row['姓名'] || String(row['姓名']).trim() === '') {
      errors.push({
        rowNumber,
        field: '姓名',
        message: '姓名不能为空',
        rawData: row
      });
    }

    if (!row['手机号'] || !/^1[3-9]\d{9}$/.test(String(row['手机号']))) {
      errors.push({
        rowNumber,
        field: '手机号',
        message: '手机号格式不正确',
        rawData: row
      });
    }

    if (!row['邮箱'] || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row['邮箱']))) {
      errors.push({
        rowNumber,
        field: '邮箱',
        message: '邮箱格式不正确',
        rawData: row
      });
    }

    const sourceChannelMap: Record<string, SourceChannel> = {
      '猎头': SourceChannel.HEADHUNTER,
      '官网': SourceChannel.OFFICIAL_WEBSITE,
      '内推': SourceChannel.INTERNAL_RECOMMENDATION,
      '智联': SourceChannel.ZHAOPIN,
      '猎聘': SourceChannel.LIEPIN,
      'BOSS直聘': SourceChannel.BOSS,
      '其他': SourceChannel.OTHER
    };

    let sourceChannel: SourceChannel | undefined;
    if (!row['来源渠道'] || !sourceChannelMap[String(row['来源渠道'])]) {
      errors.push({
        rowNumber,
        field: '来源渠道',
        message: '来源渠道不正确，可选值: 猎头、官网、内推、智联、猎聘、BOSS直聘、其他',
        rawData: row
      });
    } else {
      sourceChannel = sourceChannelMap[String(row['来源渠道'])];
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: [],
      data: {
        name: String(row['姓名']).trim(),
        phone: String(row['手机号']).trim(),
        email: String(row['邮箱']).trim(),
        sourceChannel: sourceChannel!,
        position: row['应聘职位'] ? String(row['应聘职位']).trim() : undefined,
        resumeUrl: row['简历链接'] ? String(row['简历链接']).trim() : undefined
      }
    };
  }

  async importFromCsv(fileName: string, fileBuffer: Buffer): Promise<{ importId: string; successCount: number; failedCount: number; errors: ImportError[] }> {
    const importRecord = store.addImportRecord({
      fileName,
      totalRows: 0,
      successCount: 0,
      failedCount: 0,
      status: 'processing',
      errors: []
    });

    const results: Record<string, any>[] = [];
    const allErrors: ImportError[] = [];
    let successCount = 0;
    let rowNumber = 0;

    const stream = Readable.from(fileBuffer);
    
    await new Promise<void>((resolve) => {
      stream
        .pipe(csvParser())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', () => {
          resolve();
        });
    });

    for (const row of results) {
      rowNumber++;
      const validation = this.validateRow(row, rowNumber);
      
      if (!validation.valid) {
        allErrors.push(...validation.errors);
        continue;
      }

      try {
        candidateService.createCandidate(validation.data!);
        successCount++;
      } catch (error) {
        allErrors.push({
          rowNumber,
          field: 'system',
          message: error instanceof Error ? error.message : '导入失败',
          rawData: row
        });
      }
    }

    store.updateImportRecord(importRecord.id, {
      totalRows: rowNumber,
      successCount,
      failedCount: allErrors.length,
      status: 'completed',
      completedAt: new Date(),
      errors: allErrors
    });

    return {
      importId: importRecord.id,
      successCount,
      failedCount: allErrors.length,
      errors: allErrors
    };
  }

  getImportRecord(id: string) {
    return store.getImportRecord(id);
  }

  getAllImportRecords() {
    return store.getAllImportRecords();
  }
}

export const importService = new ImportService();
