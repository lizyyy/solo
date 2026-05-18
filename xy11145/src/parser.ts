import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { MedicalReport, ParseError } from './types';

export class FileParser {
  private errors: ParseError[] = [];

  async parseFile(filePath: string): Promise<{ records: MedicalReport[]; errors: ParseError[] }> {
    this.errors = [];
    const records: MedicalReport[] = [];
    const fileName = path.basename(filePath);

    if (!fs.existsSync(filePath)) {
      this.errors.push({
        file: fileName,
        errorType: 'parse_failed',
        message: `文件不存在: ${filePath}`
      });
      return { records: [], errors: this.errors };
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
      return this.parseCSV(filePath, fileName);
    } else if (ext === '.json') {
      return this.parseJSON(filePath, fileName);
    } else {
      this.errors.push({
        file: fileName,
        errorType: 'format_error',
        message: `不支持的文件格式: ${ext}`
      });
      return { records: [], errors: this.errors };
    }
  }

  private async parseCSV(filePath: string, fileName: string): Promise<{ records: MedicalReport[]; errors: ParseError[] }> {
    const records: MedicalReport[] = [];
    let rowNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(filePath, 'utf8')
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          try {
            const record = this.validateAndTransformRow(row, fileName, rowNumber);
            if (record) {
              records.push(record);
            }
          } catch (e: any) {
            this.errors.push({
              file: fileName,
              rowNumber,
              errorType: 'format_error',
              message: e.message,
              rawData: JSON.stringify(row)
            });
          }
        })
        .on('end', () => {
          resolve({ records, errors: this.errors });
        })
        .on('error', (err) => {
          this.errors.push({
            file: fileName,
            errorType: 'parse_failed',
            message: `CSV解析失败: ${err.message}`
          });
          resolve({ records: [], errors: this.errors });
        });
    });
  }

  private async parseJSON(filePath: string, fileName: string): Promise<{ records: MedicalReport[]; errors: ParseError[] }> {
    const records: MedicalReport[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const rows = Array.isArray(data) ? data : [data];

      rows.forEach((row, index) => {
        try {
          const record = this.validateAndTransformRow(row, fileName, index + 1);
          if (record) {
            records.push(record);
          }
        } catch (e: any) {
          this.errors.push({
            file: fileName,
            rowNumber: index + 1,
            errorType: 'format_error',
            message: e.message,
            rawData: JSON.stringify(row)
          });
        }
      });
    } catch (err: any) {
      this.errors.push({
        file: fileName,
        errorType: 'parse_failed',
        message: `JSON解析失败: ${err.message}`
      });
    }

    return { records, errors: this.errors };
  }

  private validateAndTransformRow(row: any, fileName: string, rowNumber: number): MedicalReport | null {
    const requiredFields = ['employeeId', 'name', 'department', 'examinationDate', 'clinicName', 'reportType'];
    const missingFields = requiredFields.filter(field => !row[field]);

    if (missingFields.length > 0) {
      this.errors.push({
        file: fileName,
        rowNumber,
        errorType: 'missing_field',
        message: `缺少必填字段: ${missingFields.join(', ')}`,
        rawData: JSON.stringify(row)
      });
      return null;
    }

    const validReportTypes = ['普通体检', '入职体检', '年度体检', '健康证'];
    if (!validReportTypes.includes(row.reportType)) {
      this.errors.push({
        file: fileName,
        rowNumber,
        errorType: 'invalid_data',
        message: `无效的报告类型: ${row.reportType}，有效值为: ${validReportTypes.join(', ')}`,
        rawData: JSON.stringify(row)
      });
      return null;
    }

    const validReportStatuses = ['pending', 'completed', 'withdrawn'];
    let reportStatus = row.reportStatus || 'completed';
    if (!validReportStatuses.includes(reportStatus)) {
      reportStatus = 'completed';
    }

    let items: string[] = [];
    if (row.items) {
      if (typeof row.items === 'string') {
        items = row.items.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
      } else if (Array.isArray(row.items)) {
        items = row.items;
      }
    }

    const recordId = this.generateRecordId(row, fileName);

    return {
      id: recordId,
      employeeId: String(row.employeeId).trim(),
      name: String(row.name).trim(),
      department: String(row.department).trim(),
      examinationDate: String(row.examinationDate).trim(),
      reportStatus: reportStatus as any,
      distributionStatus: 'pending',
      phone: row.phone ? String(row.phone).trim() : undefined,
      email: row.email ? String(row.email).trim() : undefined,
      clinicName: String(row.clinicName).trim(),
      reportType: row.reportType.trim(),
      items,
      sourceFile: fileName,
      processedAt: new Date().toISOString()
    };
  }

  private generateRecordId(row: any, fileName: string): string {
    const key = `${fileName}-${row.employeeId || ''}-${row.name || ''}-${row.examinationDate || ''}`;
    return Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }
}
