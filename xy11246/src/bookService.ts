import { v4 as uuidv4 } from 'uuid';
import {
  BookInput,
  BookCondition,
  GradeLevel,
  ProcessingStatus,
  Role,
  ProcessingResult,
  ShelfList,
  HistoryQuery,
  HistoryRecord,
  ImportBatch,
  BookRecord,
} from './types';
import { BookDatabase } from './database';

interface ValidationResult {
  valid: boolean;
  condition?: BookCondition;
  gradeLevel?: GradeLevel;
  reason?: string;
}

export class BookService {
  private db: BookDatabase;

  constructor(db: BookDatabase) {
    this.db = db;
  }

  private validateCondition(conditionStr?: string): ValidationResult {
    if (!conditionStr) {
      return { valid: false, reason: '缺少品相信息' };
    }

    const normalized = conditionStr.trim().toLowerCase();

    const conditionMap: Record<string, BookCondition> = {
      '全新': BookCondition.NEW,
      '新': BookCondition.NEW,
      '九成新': BookCondition.LIKE_NEW,
      '9成新': BookCondition.LIKE_NEW,
      '9新': BookCondition.LIKE_NEW,
      '八成新': BookCondition.GOOD,
      '8成新': BookCondition.GOOD,
      '8新': BookCondition.GOOD,
      '七成新': BookCondition.FAIR,
      '7成新': BookCondition.FAIR,
      '7新': BookCondition.FAIR,
      '六成新': BookCondition.POOR,
      '6成新': BookCondition.POOR,
      '6新': BookCondition.POOR,
    };

    for (const [key, value] of Object.entries(conditionMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return { valid: true, condition: value };
      }
    }

    return { valid: false, reason: `无法识别的品相: ${conditionStr}` };
  }

  private validateGradeLevel(gradeStr?: string): ValidationResult {
    if (!gradeStr) {
      return { valid: true, gradeLevel: GradeLevel.UNKNOWN };
    }

    const normalized = gradeStr.trim();

    const gradeMap: Record<string, GradeLevel> = {
      '一年级': GradeLevel.GRADE_1,
      '1年级': GradeLevel.GRADE_1,
      '二年级': GradeLevel.GRADE_2,
      '2年级': GradeLevel.GRADE_2,
      '三年级': GradeLevel.GRADE_3,
      '3年级': GradeLevel.GRADE_3,
      '四年级': GradeLevel.GRADE_4,
      '4年级': GradeLevel.GRADE_4,
      '五年级': GradeLevel.GRADE_5,
      '5年级': GradeLevel.GRADE_5,
      '六年级': GradeLevel.GRADE_6,
      '6年级': GradeLevel.GRADE_6,
      '七年级': GradeLevel.GRADE_7,
      '7年级': GradeLevel.GRADE_7,
      '初一': GradeLevel.GRADE_7,
      '八年级': GradeLevel.GRADE_8,
      '8年级': GradeLevel.GRADE_8,
      '初二': GradeLevel.GRADE_8,
      '九年级': GradeLevel.GRADE_9,
      '9年级': GradeLevel.GRADE_9,
      '初三': GradeLevel.GRADE_9,
      '高一': GradeLevel.GRADE_10,
      '10年级': GradeLevel.GRADE_10,
      '高二': GradeLevel.GRADE_11,
      '11年级': GradeLevel.GRADE_11,
      '高三': GradeLevel.GRADE_12,
      '12年级': GradeLevel.GRADE_12,
    };

    for (const [key, value] of Object.entries(gradeMap)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return { valid: true, gradeLevel: value };
      }
    }

    return { valid: true, gradeLevel: GradeLevel.UNKNOWN, reason: `未匹配到年级，设为未分级: ${gradeStr}` };
  }

  private validateISBN(isbn?: string): { valid: boolean; normalized: string | null; reason?: string } {
    if (!isbn || isbn.trim() === '') {
      return { valid: true, normalized: null, reason: '缺少ISBN，将按标题+品相进行去重' };
    }

    const cleaned = isbn.replace(/[^0-9Xx]/g, '');
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      return { valid: false, normalized: null, reason: `ISBN格式无效: ${isbn}` };
    }

    return { valid: true, normalized: cleaned.toUpperCase() };
  }

  async processBook(
    input: BookInput,
    batchId: string,
    operator: string,
    operatorRole: Role
  ): Promise<ProcessingResult> {
    const isbnResult = this.validateISBN(input.isbn);
    if (!isbnResult.valid) {
      return this.db.insertProcessingResult(
        batchId,
        input,
        ProcessingStatus.REJECTED,
        isbnResult.reason!,
        false,
        operator,
        operatorRole
      );
    }

    const conditionResult = this.validateCondition(input.condition);
    if (!conditionResult.valid) {
      return this.db.insertProcessingResult(
        batchId,
        input,
        ProcessingStatus.REJECTED,
        conditionResult.reason!,
        false,
        operator,
        operatorRole
      );
    }

    const gradeResult = this.validateGradeLevel(input.gradeLevel);

    const duplicate = await this.db.findDuplicateBook(
      isbnResult.normalized,
      input.title.trim(),
      conditionResult.condition!
    );

    if (duplicate) {
      return this.db.insertProcessingResult(
        batchId,
        input,
        ProcessingStatus.DUPLICATE,
        `重复书籍: ISBN=${isbnResult.normalized || '无'}, 标题=${input.title}, 品相=${conditionResult.condition}`,
        true,
        operator,
        operatorRole
      );
    }

    const recordId = uuidv4();
    this.db.insertBookRecord({
      id: recordId,
      isbn: isbnResult.normalized,
      title: input.title.trim(),
      author: input.author?.trim() || null,
      publisher: input.publisher?.trim() || null,
      condition: conditionResult.condition!,
      gradeLevel: gradeResult.gradeLevel!,
      donor: input.donor?.trim() || null,
      remark: input.remark?.trim() || null,
      importBatchId: batchId,
    });

    const reasons: string[] = [];
    if (isbnResult.reason) reasons.push(isbnResult.reason);
    if (gradeResult.reason) reasons.push(gradeResult.reason);

    return this.db.insertProcessingResult(
      batchId,
      input,
      ProcessingStatus.ACCEPTED,
      reasons.length > 0 ? reasons.join('; ') : '校验通过',
      false,
      operator,
      operatorRole,
      recordId
    );
  }

  async importBooks(
    books: BookInput[],
    operator: string,
    operatorRole: Role
  ): Promise<{ batch: ImportBatch; results: ProcessingResult[] }> {
    const batch = this.db.createBatch(operator, operatorRole);
    const results: ProcessingResult[] = [];

    let acceptedCount = 0;
    let rejectedCount = 0;
    let duplicateCount = 0;

    for (const book of books) {
      const result = await this.processBook(book, batch.id, operator, operatorRole);
      results.push(result);

      switch (result.status) {
        case ProcessingStatus.ACCEPTED:
          acceptedCount++;
          break;
        case ProcessingStatus.REJECTED:
          rejectedCount++;
          break;
        case ProcessingStatus.DUPLICATE:
          duplicateCount++;
          break;
      }
    }

    this.db.updateBatchCounts(batch.id, {
      total: books.length,
      accepted: acceptedCount,
      rejected: rejectedCount,
      duplicate: duplicateCount,
    });

    const updatedBatch = await this.db.getBatch(batch.id);

    return {
      batch: updatedBatch!,
      results,
    };
  }

  async generateShelfList(
    batchId: string,
    operator: string,
    operatorRole: Role
  ): Promise<ShelfList> {
    const books = await this.db.getBooksByBatch(batchId);

    const gradeOrder = [
      GradeLevel.GRADE_1,
      GradeLevel.GRADE_2,
      GradeLevel.GRADE_3,
      GradeLevel.GRADE_4,
      GradeLevel.GRADE_5,
      GradeLevel.GRADE_6,
      GradeLevel.GRADE_7,
      GradeLevel.GRADE_8,
      GradeLevel.GRADE_9,
      GradeLevel.GRADE_10,
      GradeLevel.GRADE_11,
      GradeLevel.GRADE_12,
      GradeLevel.UNKNOWN,
    ];

    const sortedBooks = [...books].sort((a, b) => {
      const gradeDiff = gradeOrder.indexOf(a.gradeLevel) - gradeOrder.indexOf(b.gradeLevel);
      if (gradeDiff !== 0) return gradeDiff;
      return a.title.localeCompare(b.title);
    });

    const items = sortedBooks.map((book, index) => {
      const gradeIndex = gradeOrder.indexOf(book.gradeLevel) + 1;
      const shelfNumber = `A${String(gradeIndex).padStart(2, '0')}-${String(Math.floor(index / 20) + 1).padStart(3, '0')}`;
      return {
        bookId: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        condition: book.condition,
        gradeLevel: book.gradeLevel,
        shelfNumber,
      };
    });

    return this.db.saveShelfList({
      operator,
      operatorRole,
      batchId,
      items,
      totalCount: items.length,
    });
  }

  async getHistory(query: HistoryQuery): Promise<{ records: HistoryRecord[]; total: number }> {
    return this.db.queryHistory(query);
  }

  async getAllBatches(): Promise<ImportBatch[]> {
    return this.db.getAllBatches();
  }

  async getBatch(batchId: string): Promise<ImportBatch | null> {
    return this.db.getBatch(batchId);
  }

  async getBatchResults(batchId: string): Promise<ProcessingResult[]> {
    return this.db.getProcessingResultsByBatch(batchId);
  }

  async getAllShelfLists(): Promise<ShelfList[]> {
    return this.db.getAllShelfLists();
  }

  async getShelfList(shelfListId: string): Promise<ShelfList | null> {
    return this.db.getShelfList(shelfListId);
  }
}
