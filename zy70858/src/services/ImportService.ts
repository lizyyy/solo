import * as fs from 'fs';
import * as csvParser from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import {
  Case,
  BorrowRecord,
  UserPermission,
  ImportResult,
  ClassificationLevel,
  BorrowStatus
} from '../types';

export class ImportService {
  async importCasesFromJSON(filePath: string): Promise<ImportResult<Case>> {
    const result: ImportResult<Case> = {
      success: false,
      data: [],
      errors: [],
      totalCount: 0,
      validCount: 0
    };

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const rawData = JSON.parse(content);
      const cases = Array.isArray(rawData) ? rawData : [rawData];

      result.totalCount = cases.length;

      for (const item of cases) {
        try {
          const validatedCase = this.validateCase(item);
          result.data.push(validatedCase);
          result.validCount++;
        } catch (error) {
          result.errors.push(`案件 ${item.caseNumber || item.caseId}: ${(error as Error).message}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`文件解析失败: ${(error as Error).message}`);
    }

    return result;
  }

  async importBorrowRecordsFromCSV(filePath: string): Promise<ImportResult<BorrowRecord>> {
    const result: ImportResult<BorrowRecord> = {
      success: false,
      data: [],
      errors: [],
      totalCount: 0,
      validCount: 0
    };

    return new Promise((resolve) => {
      const records: BorrowRecord[] = [];
      let rowCount = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          rowCount++;
          try {
            const record = this.validateBorrowRecord(row, rowCount);
            records.push(record);
          } catch (error) {
            result.errors.push(`第 ${rowCount} 行: ${(error as Error).message}`);
          }
        })
        .on('end', () => {
          result.totalCount = rowCount;
          result.data = records;
          result.validCount = records.length;
          result.success = result.errors.length === 0;
          resolve(result);
        })
        .on('error', (error) => {
          result.errors.push(`CSV文件读取失败: ${error.message}`);
          resolve(result);
        });
    });
  }

  async importUserPermissionsFromJSON(filePath: string): Promise<ImportResult<UserPermission>> {
    const result: ImportResult<UserPermission> = {
      success: false,
      data: [],
      errors: [],
      totalCount: 0,
      validCount: 0
    };

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const rawData = JSON.parse(content);
      const permissions = Array.isArray(rawData) ? rawData : [rawData];

      result.totalCount = permissions.length;

      for (const item of permissions) {
        try {
          const validatedPermission = this.validateUserPermission(item);
          result.data.push(validatedPermission);
          result.validCount++;
        } catch (error) {
          result.errors.push(`用户 ${item.userName || item.userId}: ${(error as Error).message}`);
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`文件解析失败: ${(error as Error).message}`);
    }

    return result;
  }

  private validateCase(item: any): Case {
    if (!item.caseId && !item.caseNumber) {
      item.caseId = uuidv4();
    }

    if (!item.caseNumber) {
      throw new Error('缺少案件编号');
    }

    if (!item.title) {
      throw new Error('缺少案件标题');
    }

    const classification = item.classification?.toLowerCase?.() || 'public';

    if (!Object.values(ClassificationLevel).includes(classification)) {
      throw new Error(`无效的密级: ${item.classification}`);
    }

    return {
      caseId: item.caseId || uuidv4(),
      caseNumber: item.caseNumber,
      title: item.title,
      classification,
      createDate: item.createDate || new Date().toISOString().split('T')[0],
      handler: item.handler || '未知',
      description: item.description
    };
  }

  private validateBorrowRecord(row: any, rowNumber: number): BorrowRecord {
    if (!row.caseId) {
      throw new Error('缺少案件ID');
    }

    if (!row.borrowerId && !row.borrowerName) {
      throw new Error('缺少借阅人信息');
    }

    const status = this.parseStatus(row.status?.toLowerCase?.() || 'borrowed');

    const borrowDate = row.borrowDate || new Date().toISOString().split('T')[0];
    const dueDate = row.dueDate || this.calculateDueDate(borrowDate, 30);

    return {
      recordId: row.recordId || uuidv4(),
      caseId: row.caseId,
      borrowerId: row.borrowerId || `BORROWER-${rowNumber}`,
      borrowerName: row.borrowerName || '未知借阅人',
      borrowDate,
      dueDate,
      returnDate: row.returnDate || undefined,
      status,
      renewalCount: parseInt(row.renewalCount) || 0,
      handlerSignature: row.handlerSignature,
      remarks: row.remarks
    };
  }

  private validateUserPermission(item: any): UserPermission {
    if (!item.userId) {
      throw new Error('缺少用户ID');
    }

    let allowedClassifications = item.allowedClassifications || [];
    if (!Array.isArray(allowedClassifications)) {
      allowedClassifications = [allowedClassifications];
    }

    allowedClassifications = allowedClassifications.filter((c: string) =>
      Object.values(ClassificationLevel).includes(c.toLowerCase()
    );

    if (allowedClassifications.length === 0) {
      allowedClassifications = [ClassificationLevel.PUBLIC, ClassificationLevel.INTERNAL];
    }

    return {
      userId: item.userId,
      userName: item.userName || '未知用户',
      department: item.department || '未知部门',
      allowedClassifications,
      maxBorrowDays: parseInt(item.maxBorrowDays) || 30,
      maxRenewals: parseInt(item.maxRenewals) || 2,
      isActive: item.isActive !== false
    };
  }

  private parseStatus(status: string): BorrowStatus {
    const statusMap: Record<string, BorrowStatus> = {
      'borrowed': BorrowStatus.BORROWED,
      '借出': BorrowStatus.BORROWED,
      'returned': BorrowStatus.RETURNED,
      '已归还': BorrowStatus.RETURNED,
      'extended': BorrowStatus.EXTENDED,
      '已续借': BorrowStatus.EXTENDED,
      '续借': BorrowStatus.EXTENDED,
      'overdue': BorrowStatus.OVERDUE,
      '超期': BorrowStatus.OVERDUE
    };

    return statusMap[status] || BorrowStatus.BORROWED;
  }

  private calculateDueDate(borrowDate: string, days: number): string {
    const date = new Date(borrowDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }
}
