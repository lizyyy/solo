import * as sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  BookRecord,
  ImportBatch,
  ProcessingResult,
  ShelfList,
  HistoryRecord,
  HistoryQuery,
  BookCondition,
  GradeLevel,
  ProcessingStatus,
  Role,
  BookInput,
} from './types';
import * as path from 'path';

sqlite3.verbose();

export class BookDatabase {
  private db: sqlite3.Database;

  constructor(dbPath: string = path.join(process.cwd(), 'book-library.db')) {
    this.db = new sqlite3.Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS import_batches (
          id TEXT PRIMARY KEY,
          operator TEXT NOT NULL,
          operator_role TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          total_count INTEGER NOT NULL DEFAULT 0,
          accepted_count INTEGER NOT NULL DEFAULT 0,
          rejected_count INTEGER NOT NULL DEFAULT 0,
          duplicate_count INTEGER NOT NULL DEFAULT 0
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS book_records (
          id TEXT PRIMARY KEY,
          isbn TEXT,
          title TEXT NOT NULL,
          author TEXT,
          publisher TEXT,
          condition TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          donor TEXT,
          remark TEXT,
          import_batch_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS processing_results (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL,
          record_id TEXT,
          isbn TEXT,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          reason TEXT NOT NULL,
          is_duplicate INTEGER NOT NULL DEFAULT 0,
          operator TEXT NOT NULL,
          operator_role TEXT NOT NULL,
          processed_at TEXT NOT NULL,
          FOREIGN KEY (batch_id) REFERENCES import_batches(id),
          FOREIGN KEY (record_id) REFERENCES book_records(id)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS shelf_lists (
          id TEXT PRIMARY KEY,
          generated_at TEXT NOT NULL,
          operator TEXT NOT NULL,
          operator_role TEXT NOT NULL,
          batch_id TEXT,
          total_count INTEGER NOT NULL DEFAULT 0
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS shelf_items (
          id TEXT PRIMARY KEY,
          shelf_list_id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          isbn TEXT,
          title TEXT NOT NULL,
          author TEXT,
          condition TEXT NOT NULL,
          grade_level TEXT NOT NULL,
          shelf_number TEXT NOT NULL,
          FOREIGN KEY (shelf_list_id) REFERENCES shelf_lists(id),
          FOREIGN KEY (book_id) REFERENCES book_records(id)
        )
      `);

      this.db.run('CREATE INDEX IF NOT EXISTS idx_book_records_isbn ON book_records(isbn)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_book_records_batch ON book_records(import_batch_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_processing_results_batch ON processing_results(batch_id)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_processing_results_isbn ON processing_results(isbn)');
    });
  }

  createBatch(operator: string, operatorRole: Role): ImportBatch {
    const batch: ImportBatch = {
      id: uuidv4(),
      operator,
      operatorRole,
      importedAt: new Date(),
      totalCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
    };

    const stmt = this.db.prepare(`
      INSERT INTO import_batches (id, operator, operator_role, imported_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(batch.id, batch.operator, batch.operatorRole, batch.importedAt.toISOString());

    return batch;
  }

  updateBatchCounts(batchId: string, counts: { total: number; accepted: number; rejected: number; duplicate: number }): void {
    const stmt = this.db.prepare(`
      UPDATE import_batches
      SET total_count = ?, accepted_count = ?, rejected_count = ?, duplicate_count = ?
      WHERE id = ?
    `);
    stmt.run(counts.total, counts.accepted, counts.rejected, counts.duplicate, batchId);
  }

  getBatch(batchId: string): Promise<ImportBatch | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM import_batches WHERE id = ?', [batchId], (err: Error | null, row: any) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({
          id: row.id,
          operator: row.operator,
          operatorRole: row.operator_role as Role,
          importedAt: new Date(row.imported_at),
          totalCount: row.total_count,
          acceptedCount: row.accepted_count,
          rejectedCount: row.rejected_count,
          duplicateCount: row.duplicate_count,
        });
      });
    });
  }

  getAllBatches(): Promise<ImportBatch[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM import_batches ORDER BY imported_at DESC', (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          id: row.id,
          operator: row.operator,
          operatorRole: row.operator_role as Role,
          importedAt: new Date(row.imported_at),
          totalCount: row.total_count,
          acceptedCount: row.accepted_count,
          rejectedCount: row.rejected_count,
          duplicateCount: row.duplicate_count,
        })));
      });
    });
  }

  insertBookRecord(book: Omit<BookRecord, 'createdAt' | 'updatedAt'>): BookRecord {
    const now = new Date();
    const record: BookRecord = {
      ...book,
      createdAt: now,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO book_records (
        id, isbn, title, author, publisher, condition, grade_level,
        donor, remark, import_batch_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.id,
      record.isbn,
      record.title,
      record.author,
      record.publisher,
      record.condition,
      record.gradeLevel,
      record.donor,
      record.remark,
      record.importBatchId,
      record.createdAt.toISOString(),
      record.updatedAt.toISOString()
    );

    return record;
  }

  findDuplicateBook(isbn: string | null, title: string, condition: BookCondition): Promise<BookRecord | null> {
    return new Promise((resolve, reject) => {
      if (isbn) {
        const stmt = this.db.prepare(`
          SELECT * FROM book_records
          WHERE isbn = ? AND title = ? AND condition = ?
          LIMIT 1
        `);
        stmt.get(isbn, title, condition, (err: Error | null, row: any) => {
          if (err) return reject(err);
          if (row) return resolve(this.mapBookRecord(row));

          const stmt2 = this.db.prepare(`
            SELECT * FROM book_records
            WHERE isbn IS NULL AND title = ? AND condition = ?
            LIMIT 1
          `);
          stmt2.get(title, condition, (err2: Error | null, row2: any) => {
            if (err2) return reject(err2);
            resolve(row2 ? this.mapBookRecord(row2) : null);
          });
        });
      } else {
        const stmt = this.db.prepare(`
          SELECT * FROM book_records
          WHERE isbn IS NULL AND title = ? AND condition = ?
          LIMIT 1
        `);
        stmt.get(title, condition, (err: Error | null, row: any) => {
          if (err) return reject(err);
          resolve(row ? this.mapBookRecord(row) : null);
        });
      }
    });
  }

  private mapBookRecord(row: any): BookRecord {
    return {
      id: row.id,
      isbn: row.isbn,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      condition: row.condition as BookCondition,
      gradeLevel: row.grade_level as GradeLevel,
      donor: row.donor,
      remark: row.remark,
      importBatchId: row.import_batch_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  getBooksByBatch(batchId: string): Promise<BookRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM book_records WHERE import_batch_id = ?', [batchId], (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows.map(row => this.mapBookRecord(row)));
      });
    });
  }

  insertProcessingResult(
    batchId: string,
    input: BookInput,
    status: ProcessingStatus,
    reason: string,
    isDuplicate: boolean,
    operator: string,
    operatorRole: Role,
    recordId?: string
  ): ProcessingResult {
    const result: ProcessingResult = {
      recordId,
      input,
      status,
      reason,
      isDuplicate,
      audit: {
        operator,
        operatorRole,
        operatedAt: new Date(),
      },
      processedAt: new Date(),
    };

    const stmt = this.db.prepare(`
      INSERT INTO processing_results (
        id, batch_id, record_id, isbn, title, status, reason,
        is_duplicate, operator, operator_role, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      uuidv4(),
      batchId,
      recordId || null,
      input.isbn || null,
      input.title,
      status,
      reason,
      isDuplicate ? 1 : 0,
      operator,
      operatorRole,
      result.processedAt.toISOString()
    );

    return result;
  }

  getProcessingResultsByBatch(batchId: string): Promise<ProcessingResult[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM processing_results WHERE batch_id = ?', [batchId], (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          recordId: row.record_id,
          input: {
            isbn: row.isbn || undefined,
            title: row.title,
          } as BookInput,
          status: row.status as ProcessingStatus,
          reason: row.reason,
          isDuplicate: row.is_duplicate === 1,
          audit: {
            operator: row.operator,
            operatorRole: row.operator_role as Role,
            operatedAt: new Date(row.processed_at),
          },
          processedAt: new Date(row.processed_at),
        })));
      });
    });
  }

  saveShelfList(shelfList: Omit<ShelfList, 'id' | 'generatedAt'>): ShelfList {
    const list: ShelfList = {
      id: uuidv4(),
      generatedAt: new Date(),
      ...shelfList,
    };

    const insertListStmt = this.db.prepare(`
      INSERT INTO shelf_lists (id, generated_at, operator, operator_role, batch_id, total_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertListStmt.run(
      list.id,
      list.generatedAt.toISOString(),
      list.operator,
      list.operatorRole,
      list.batchId || null,
      list.totalCount
    );

    const insertItemStmt = this.db.prepare(`
      INSERT INTO shelf_items (id, shelf_list_id, book_id, isbn, title, author, condition, grade_level, shelf_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of list.items) {
      insertItemStmt.run(
        uuidv4(),
        list.id,
        item.bookId,
        item.isbn,
        item.title,
        item.author,
        item.condition,
        item.gradeLevel,
        item.shelfNumber
      );
    }

    return list;
  }

  getShelfList(shelfListId: string): Promise<ShelfList | null> {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM shelf_lists WHERE id = ?', [shelfListId], (err: Error | null, listRow: any) => {
        if (err) return reject(err);
        if (!listRow) return resolve(null);

        this.db.all('SELECT * FROM shelf_items WHERE shelf_list_id = ?', [shelfListId], (err2: Error | null, itemRows: any[]) => {
          if (err2) return reject(err2);
          resolve({
            id: listRow.id,
            generatedAt: new Date(listRow.generated_at),
            operator: listRow.operator,
            operatorRole: listRow.operator_role as Role,
            batchId: listRow.batch_id,
            items: itemRows.map(row => ({
              bookId: row.book_id,
              isbn: row.isbn,
              title: row.title,
              author: row.author,
              condition: row.condition as BookCondition,
              gradeLevel: row.grade_level as GradeLevel,
              shelfNumber: row.shelf_number,
            })),
            totalCount: listRow.total_count,
          });
        });
      });
    });
  }

  getAllShelfLists(): Promise<ShelfList[]> {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id FROM shelf_lists ORDER BY generated_at DESC', async (err: Error | null, rows: { id: string }[]) => {
        if (err) return reject(err);
        const lists: ShelfList[] = [];
        for (const row of rows) {
          const list = await this.getShelfList(row.id);
          if (list) lists.push(list);
        }
        resolve(lists);
      });
    });
  }

  queryHistory(query: HistoryQuery): Promise<{ records: HistoryRecord[]; total: number }> {
    return new Promise((resolve, reject) => {
      let whereClauses: string[] = [];
      const params: any[] = [];

      if (query.startDate) {
        whereClauses.push('processed_at >= ?');
        params.push(query.startDate.toISOString());
      }
      if (query.endDate) {
        whereClauses.push('processed_at <= ?');
        params.push(query.endDate.toISOString());
      }
      if (query.operator) {
        whereClauses.push('operator LIKE ?');
        params.push(`%${query.operator}%`);
      }
      if (query.isbn) {
        whereClauses.push('isbn = ?');
        params.push(query.isbn);
      }
      if (query.status) {
        whereClauses.push('status = ?');
        params.push(query.status);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      this.db.get(`SELECT COUNT(*) as total FROM processing_results ${whereSql}`, params, (err: Error | null, countResult: any) => {
        if (err) return reject(err);

        const page = query.page || 1;
        const pageSize = query.pageSize || 50;
        const offset = (page - 1) * pageSize;

        this.db.all(
          `SELECT * FROM processing_results ${whereSql} ORDER BY processed_at DESC LIMIT ? OFFSET ?`,
          [...params, pageSize, offset],
          (err2: Error | null, rows: any[]) => {
            if (err2) return reject(err2);
            resolve({
              records: rows.map(row => ({
                id: row.id,
                batchId: row.batch_id,
                isbn: row.isbn,
                title: row.title,
                status: row.status as ProcessingStatus,
                reason: row.reason,
                operator: row.operator,
                operatorRole: row.operator_role as Role,
                operatedAt: new Date(row.processed_at),
              })),
              total: countResult.total,
            });
          }
        );
      });
    });
  }

  close(): void {
    this.db.close();
  }
}
