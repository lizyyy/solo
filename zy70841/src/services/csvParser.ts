import csv from 'csv-parser';
import { Readable } from 'stream';
import { BoothApplication, DocumentType, DocumentInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

export interface ParsedRow {
  [key: string]: string;
}

export class CsvParserService {
  async parseApplications(buffer: Buffer, batchId: string): Promise<BoothApplication[]> {
    const results: ParsedRow[] = [];
    
    return new Promise((resolve, reject) => {
      const stream = Readable.from(buffer.toString());
      
      stream
        .pipe(csv())
        .on('data', (data: ParsedRow) => results.push(data))
        .on('end', () => {
          try {
            const applications = this.mapToApplications(results, batchId);
            resolve(applications);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private mapToApplications(rows: ParsedRow[], batchId: string): BoothApplication[] {
    return rows.map((row, index) => {
      const applicationId = uuidv4();
      
      const documents: DocumentInfo[] = [];
      
      if (row['营业执照编号']) {
        documents.push({
          id: uuidv4(),
          type: DocumentType.BUSINESS_LICENSE,
          documentNumber: row['营业执照编号'] || '',
          issueDate: row['营业执照签发日期'] || '',
          expiryDate: row['营业执照到期日期'] || '',
          fileName: row['营业执照文件名'],
          verified: false
        });
      }
      
      if (row['消防证编号']) {
        documents.push({
          id: uuidv4(),
          type: DocumentType.FIRE_SAFETY,
          documentNumber: row['消防证编号'] || '',
          issueDate: row['消防证签发日期'] || '',
          expiryDate: row['消防证到期日期'] || '',
          fileName: row['消防证文件名'],
          verified: false
        });
      }
      
      if (row['押金收据编号']) {
        documents.push({
          id: uuidv4(),
          type: DocumentType.DEPOSIT_RECEIPT,
          documentNumber: row['押金收据编号'] || '',
          issueDate: row['押金支付日期'] || '',
          expiryDate: '',
          fileName: row['押金收据文件名'],
          verified: false
        });
      }

      return {
        id: applicationId,
        batchId,
        boothNumber: row['摊位编号'] || '',
        companyName: row['公司名称'] || '',
        contactPerson: row['联系人'] || '',
        contactPhone: row['联系电话'] || '',
        startTime: row['进场时间'] || row['开始时间'] || '',
        endTime: row['退场时间'] || row['结束时间'] || '',
        depositAmount: parseFloat(row['应缴押金']) || 0,
        depositPaid: parseFloat(row['已缴押金']) || 0,
        documents,
        createdAt: moment().toISOString(),
        submittedAt: moment().toISOString()
      };
    });
  }

  async parseDocumentList(buffer: Buffer): Promise<DocumentInfo[]> {
    const results: ParsedRow[] = [];
    
    return new Promise((resolve, reject) => {
      const stream = Readable.from(buffer.toString());
      
      stream
        .pipe(csv())
        .on('data', (data: ParsedRow) => results.push(data))
        .on('end', () => {
          const documents = results.map(row => ({
            id: uuidv4(),
            type: this.mapDocumentType(row['证照类型']),
            documentNumber: row['证照编号'] || '',
            issueDate: row['签发日期'] || '',
            expiryDate: row['到期日期'] || '',
            fileName: row['文件名'],
            verified: false
          }));
          resolve(documents);
        })
        .on('error', reject);
    });
  }

  private mapDocumentType(type: string): DocumentType {
    const typeMap: Record<string, DocumentType> = {
      '营业执照': DocumentType.BUSINESS_LICENSE,
      '消防证': DocumentType.FIRE_SAFETY,
      '消防材料': DocumentType.FIRE_SAFETY,
      '押金收据': DocumentType.DEPOSIT_RECEIPT
    };
    return typeMap[type] || DocumentType.BUSINESS_LICENSE;
  }
}

export const csvParser = new CsvParserService();
