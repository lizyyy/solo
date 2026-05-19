import fs from 'fs';
import csv from 'csv-parser';
import { bookRepo, sessionRepo, errorRepo, Book } from '../database';
import { validateBookData, normalizeBookData, RawBookData } from '../validation';

export interface CsvImportResult {
  sessionId: number;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    type: string;
    message: string;
  }>;
}

export const importCsv = async (
  filePath: string,
  volunteer: string
): Promise<CsvImportResult> => {
  const sessionId = sessionRepo.insert({
    source_type: 'csv',
    source_file: filePath,
    volunteer,
    total_records: 0,
    success_count: 0,
    error_count: 0
  });

  let successCount = 0;
  let errorCount = 0;
  let totalRecords = 0;
  const errors: Array<{ row: number; type: string; message: string }> = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        totalRecords++;
        const rowNumber = totalRecords + 1;

        try {
          const normalizedData = normalizeBookData(row);
          const validation = validateBookData(normalizedData);

          if (!validation.valid) {
            errorCount++;
            errors.push({
              row: rowNumber,
              type: validation.error!.type,
              message: validation.error!.message
            });

            errorRepo.insert({
              session_id: sessionId,
              source_file: filePath,
              row_number: rowNumber,
              raw_data: JSON.stringify(row),
              error_type: validation.error!.type,
              error_message: validation.error!.message,
              suggestion: validation.error!.suggestion,
              volunteer
            });
            return;
          }

          if (bookRepo.existsByIsbn(validation.data!.isbn)) {
            errorCount++;
            errors.push({
              row: rowNumber,
              type: 'duplicate_isbn',
              message: `ISBN 已存在: ${validation.data!.isbn}`
            });

            errorRepo.insert({
              session_id: sessionId,
              source_file: filePath,
              row_number: rowNumber,
              raw_data: JSON.stringify(row),
              error_type: 'duplicate_isbn',
              error_message: `ISBN 已存在: ${validation.data!.isbn}`,
              suggestion: '请检查是否重复扫码，或确认该书是否已入库',
              volunteer
            });
            return;
          }

          const bookData: Omit<Book, 'id' | 'created_at' | 'updated_at'> = {
            session_id: sessionId,
            isbn: validation.data!.isbn,
            title: validation.data!.title,
            condition: validation.data!.condition,
            grade: validation.data!.grade,
            donor: validation.data!.donor,
            volunteer,
            scanned_at: validation.data!.scanned_at,
            status: 'pending',
            notes: ''
          };

          bookRepo.insert(bookData);
          successCount++;
        } catch (err) {
          errorCount++;
          const errorMessage = err instanceof Error ? err.message : '未知错误';
          errors.push({
            row: rowNumber,
            type: 'parse_error',
            message: errorMessage
          });

          errorRepo.insert({
            session_id: sessionId,
            source_file: filePath,
            row_number: rowNumber,
            raw_data: JSON.stringify(row),
            error_type: 'parse_error',
            error_message: errorMessage,
            suggestion: '请检查 CSV 文件格式是否正确',
            volunteer
          });
        }
      })
      .on('end', () => {
        sessionRepo.updateCounts(sessionId, successCount, errorCount);
        resolve({
          sessionId,
          totalRecords,
          successCount,
          errorCount,
          errors
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};
