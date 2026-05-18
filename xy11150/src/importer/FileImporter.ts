import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import { ShuttleRegistration, InvalidRecord, ImportOptions, EncodingType, DEFAULT_COLUMN_MAPPING, ColumnMapping } from '../models/ShuttleRegistration';

export class FileImportError extends Error {
  constructor(
    message: string,
    public readonly fileName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileImportError';
  }
}

export class ColumnMappingError extends Error {
  constructor(
    message: string,
    public readonly missingColumns: string[],
    public readonly availableColumns: string[]
  ) {
    super(message);
    this.name = 'ColumnMappingError';
  }
}

export class FileImporter {
  private columnMapping: ColumnMapping;

  constructor(customMapping?: Partial<ColumnMapping>) {
    this.columnMapping = { ...DEFAULT_COLUMN_MAPPING, ...customMapping };
  }

  importFile(filePath: string, options?: ImportOptions): {
    records: ShuttleRegistration[];
    invalidRecords: InvalidRecord[];
    headers: string[];
  } {
    if (!fs.existsSync(filePath)) {
      throw new FileImportError(`文件不存在: ${filePath}`, filePath);
    }

    const fileSize = fs.statSync(filePath).size;
    if (fileSize === 0) {
      throw new FileImportError(`文件为空: ${filePath}`, filePath);
    }

    const encoding = this.detectEncoding(filePath, options?.encoding);
    const content = this.readFileWithEncoding(filePath, encoding);
    const delimiter = options?.delimiter || ',';
    const hasHeader = options?.hasHeader !== false;

    const parsed = this.parseCsv(content, delimiter, hasHeader);
    const headers = parsed.headers;

    if (parsed.rows.length === 0) {
      return { records: [], invalidRecords: [], headers };
    }

    const fieldMapping = this.resolveColumnMapping(headers);

    const records: ShuttleRegistration[] = [];
    const invalidRecords: InvalidRecord[] = [];
    const fileName = path.basename(filePath);

    for (let i = 0; i < parsed.rows.length; i++) {
      const rowNumber = hasHeader ? i + 2 : i + 1;
      const rawData = parsed.rows[i];
      const { record, errors } = this.parseRow(rawData, fieldMapping, fileName, rowNumber);

      if (errors.length > 0) {
        invalidRecords.push({
          sourceFile: fileName,
          rowNumber,
          rawData,
          errors
        });
      } else {
        records.push(record!);
      }
    }

    return { records, invalidRecords, headers };
  }

  importFiles(filePaths: string[], options?: ImportOptions): {
    records: ShuttleRegistration[];
    invalidRecords: InvalidRecord[];
    fileResults: Array<{
      fileName: string;
      success: boolean;
      recordCount: number;
      error?: string;
    }>;
  } {
    const allRecords: ShuttleRegistration[] = [];
    const allInvalidRecords: InvalidRecord[] = [];
    const fileResults: Array<{
      fileName: string;
      success: boolean;
      recordCount: number;
      error?: string;
    }> = [];

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      try {
        const result = this.importFile(filePath, options);
        allRecords.push(...result.records);
        allInvalidRecords.push(...result.invalidRecords);
        fileResults.push({
          fileName,
          success: true,
          recordCount: result.records.length
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        fileResults.push({
          fileName,
          success: false,
          recordCount: 0,
          error: errorMessage
        });
      }
    }

    return {
      records: allRecords,
      invalidRecords: allInvalidRecords,
      fileResults
    };
  }

  private detectEncoding(filePath: string, encoding?: EncodingType): EncodingType {
    if (encoding && encoding !== 'Auto') {
      return encoding;
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'UTF-8';
    }

    try {
      const gbkContent = iconv.decode(buffer, 'GBK');
      if (gbkContent.includes('员工') || gbkContent.includes('班车') || gbkContent.includes('线路')) {
        return 'GBK';
      }
    } catch {
    }

    return 'UTF-8';
  }

  private readFileWithEncoding(filePath: string, encoding: EncodingType): string {
    const buffer = fs.readFileSync(filePath);
    try {
      if (encoding === 'GBK' || encoding === 'GB2312') {
        return iconv.decode(buffer, 'GBK');
      }
      return buffer.toString('utf8');
    } catch (error) {
      throw new FileImportError(
        `文件编码错误，无法解析: ${error instanceof Error ? error.message : String(error)}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  private parseCsv(content: string, delimiter: string, hasHeader: boolean): {
    headers: string[];
    rows: Record<string, unknown>[];
  } {
    try {
      const records = parse(content, {
        delimiter,
        columns: hasHeader,
        skip_empty_lines: true,
        trim: true
      });

      const headers = hasHeader && records.length > 0 ? Object.keys(records[0]) : [];
      const rows = hasHeader ? records : records.map((row: unknown[], index: number) => {
        const obj: Record<string, unknown> = {};
        (row as string[]).forEach((val, idx) => {
          obj[`column_${idx}`] = val;
        });
        return obj;
      });

      return { headers, rows };
    } catch (error) {
      throw new Error(`CSV解析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private resolveColumnMapping(headers: string[]): Map<keyof ColumnMapping, string> {
    const fieldMapping = new Map<keyof ColumnMapping, string>();
    const missingColumns: string[] = [];
    const requiredFields: Array<keyof ColumnMapping> = ['employeeId', 'employeeName', 'phone', 'routeName'];

    for (const field of requiredFields) {
      const possibleNames = this.columnMapping[field];
      let matchedColumn: string | null = null;

      for (const possibleName of possibleNames) {
        const found = headers.find(h =>
          h.trim().toLowerCase() === possibleName.trim().toLowerCase()
        );
        if (found) {
          matchedColumn = found;
          break;
        }
      }

      if (matchedColumn) {
        fieldMapping.set(field, matchedColumn);
      } else {
        missingColumns.push(field);
      }
    }

    if (missingColumns.length > 0) {
      const missingNames = missingColumns.map(c =>
        this.columnMapping[c as keyof ColumnMapping][0]
      ).join('、');
      throw new ColumnMappingError(
        `缺少必要的列: ${missingNames}`,
        missingNames.split('、'),
        headers
      );
    }

    const optionalFields: Array<keyof ColumnMapping> = [
      'department', 'boardingPoint', 'boardingTime', 'registrationDate', 'status'
    ];

    for (const field of optionalFields) {
      const possibleNames = this.columnMapping[field];
      for (const possibleName of possibleNames) {
        const found = headers.find(h =>
          h.trim().toLowerCase() === possibleName.trim().toLowerCase()
        );
        if (found) {
          fieldMapping.set(field, found);
          break;
        }
      }
    }

    return fieldMapping;
  }

  private parseRow(
    rawData: Record<string, unknown>,
    fieldMapping: Map<keyof ColumnMapping, string>,
    sourceFile: string,
    rowNumber: number
  ): { record?: ShuttleRegistration; errors: string[] } {
    const errors: string[] = [];

    const getValue = (field: keyof ColumnMapping): string => {
      const column = fieldMapping.get(field);
      if (!column) return '';
      const value = rawData[column];
      return value !== undefined && value !== null ? String(value).trim() : '';
    };

    const employeeId = getValue('employeeId');
    const employeeName = getValue('employeeName');
    const phone = getValue('phone');
    const routeName = getValue('routeName');

    if (!employeeId && !employeeName && !phone) {
      errors.push('员工信息缺失: 员工编号、姓名、手机号不能同时为空');
    }
    if (!routeName) {
      errors.push('线路名称不能为空');
    }

    if (errors.length > 0) {
      return { errors };
    }

    const record: ShuttleRegistration = {
      employeeId,
      employeeName,
      department: getValue('department'),
      phone,
      routeName,
      boardingPoint: getValue('boardingPoint'),
      boardingTime: getValue('boardingTime'),
      registrationDate: getValue('registrationDate'),
      status: this.parseStatus(getValue('status')),
      rawData,
      sourceFile,
      rowNumber
    };

    return { record, errors };
  }

  private parseStatus(status: string): '正常' | '调岗' | '待审核' | '已取消' {
    const statusMap: Record<string, '正常' | '调岗' | '待审核' | '已取消'> = {
      '正常': '正常',
      'active': '正常',
      '有效': '正常',
      '调岗': '调岗',
      'transfer': '调岗',
      '调动': '调岗',
      '待审核': '待审核',
      'pending': '待审核',
      '审核中': '待审核',
      '已取消': '已取消',
      'cancelled': '已取消',
      '取消': '已取消'
    };
    return statusMap[status?.trim()] || '正常';
  }
}
