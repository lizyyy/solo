import { ValidationResult } from 'joi';
import crypto from 'crypto';
import { roomStateSchema, cleaningRecordSchema, photoRecordSchema } from '../validation/schemas';
import { runQuery, getOne, getAll } from '../database';
import { RoomState, CleaningRecord, ImportRecord, ImportBatch } from '../types';

export interface ValidationResultWithSuggestions<T> {
  isValid: boolean;
  data: T;
  errors: string[];
  suggestions: string[];
}

const generateBatchId = (): string => {
  return `BATCH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

const generateSuggestions = (errors: string[], rawData: any): string[] => {
  const suggestions: string[] = [];
  
  errors.forEach(error => {
    if (error.includes('房间号')) {
      suggestions.push('房间号建议格式：字母+数字(如A101)或纯数字(如101)');
    }
    if (error.includes('日期')) {
      suggestions.push('日期建议格式：YYYY-MM-DD(如2024-01-15)');
    }
    if (error.includes('手机号')) {
      suggestions.push('手机号建议格式：11位手机号(如13800138000)');
    }
    if (error.includes('状态')) {
      suggestions.push('状态可选值：pending/in_progress/completed/needs_rework/closed');
    }
    if (error.includes('时间')) {
      suggestions.push('时间建议格式：HH:MM(如14:30)');
    }
  });
  
  return suggestions;
};

const validateRoomState = (data: any): ValidationResultWithSuggestions<RoomState> => {
  const result: ValidationResult = roomStateSchema.validate(data, { abortEarly: false });
  const errors = result.error ? result.error.details.map(d => d.message) : [];
  const suggestions = generateSuggestions(errors, data);
  
  if (data.checkInDate && data.checkOutDate && data.checkInDate > data.checkOutDate) {
    errors.push('入住日期不能晚于离店日期');
    suggestions.push('请检查入住和离店日期的先后顺序');
  }
  
  return {
    isValid: errors.length === 0,
    data: result.value as RoomState,
    errors,
    suggestions
  };
};

const validateCleaningRecord = (data: any): ValidationResultWithSuggestions<CleaningRecord> => {
  const result: ValidationResult = cleaningRecordSchema.validate(data, { abortEarly: false });
  const errors = result.error ? result.error.details.map(d => d.message) : [];
  const suggestions = generateSuggestions(errors, data);
  
  if (data.startTime && data.endTime && data.startTime > data.endTime) {
    errors.push('开始时间不能晚于结束时间');
    suggestions.push('请检查开始和结束时间的先后顺序');
  }
  
  return {
    isValid: errors.length === 0,
    data: result.value as CleaningRecord,
    errors,
    suggestions
  };
};

const mapCsvRowToRoomState = (row: any): RoomState => {
  return {
    roomNumber: row.roomNumber || row.room_number || row['房间号'] || '',
    date: row.date || row['日期'] || '',
    status: row.status || row['状态'] || 'vacant',
    guestName: row.guestName || row.guest_name || row['客人姓名'] || '',
    guestPhone: row.guestPhone || row.guest_phone || row['客人电话'] || '',
    checkInDate: row.checkInDate || row.check_in_date || row['入住日期'] || '',
    checkOutDate: row.checkOutDate || row.check_out_date || row['离店日期'] || '',
    source: row.source || row['来源'] || ''
  };
};

const mapCsvRowToCleaningRecord = (row: any): CleaningRecord => {
  return {
    roomNumber: row.roomNumber || row.room_number || row['房间号'] || '',
    cleanerName: row.cleanerName || row.cleaner_name || row['保洁员'] || '',
    cleanerPhone: row.cleanerPhone || row.cleaner_phone || row['保洁员电话'] || '',
    scheduledDate: row.scheduledDate || row.scheduled_date || row['计划日期'] || '',
    startTime: row.startTime || row.start_time || row['开始时间'] || '',
    endTime: row.endTime || row.end_time || row['结束时间'] || '',
    status: (row.status || row['状态'] || 'pending') as any,
    qualityScore: row.qualityScore ? parseInt(row.qualityScore) : undefined,
    remarks: row.remarks || row['备注'] || ''
  };
};

export const importRoomStatesFromCsv = async (
  rows: any[],
  fileName: string
): Promise<{ batchId: string; results: any[] }> => {
  const batchId = generateBatchId();
  const results: any[] = [];
  let validCount = 0;
  let invalidCount = 0;
  
  await runQuery(
    'INSERT INTO import_batches (id, type, file_name, total_records, status) VALUES (?, ?, ?, ?, ?)',
    [batchId, 'room_state', fileName, rows.length, 'processing']
  );
  
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const rawData = mapCsvRowToRoomState(rows[i]);
    const validation = validateRoomState(rawData);
    
    let importedId: number | undefined;
    
    if (validation.isValid) {
      try {
        const existing = await getOne(
          'SELECT id FROM room_states WHERE room_number = ? AND date = ?',
          [validation.data.roomNumber, validation.data.date]
        );
        
        if (existing) {
          await runQuery(
            `UPDATE room_states SET 
              status = ?, guest_name = ?, guest_phone = ?, 
              check_in_date = ?, check_out_date = ?, source = ?, updated_at = CURRENT_TIMESTAMP
             WHERE room_number = ? AND date = ?`,
            [
              validation.data.status,
              validation.data.guestName,
              validation.data.guestPhone,
              validation.data.checkInDate,
              validation.data.checkOutDate,
              validation.data.source,
              validation.data.roomNumber,
              validation.data.date
            ]
          );
          importedId = (existing as any).id;
        } else {
          const result = await runQuery(
            `INSERT INTO room_states 
              (room_number, date, status, guest_name, guest_phone, check_in_date, check_out_date, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              validation.data.roomNumber,
              validation.data.date,
              validation.data.status,
              validation.data.guestName,
              validation.data.guestPhone,
              validation.data.checkInDate,
              validation.data.checkOutDate,
              validation.data.source
            ]
          );
          importedId = result.lastID;
        }
        validCount++;
      } catch (error: any) {
        validation.isValid = false;
        validation.errors.push(`数据库错误: ${error.message}`);
        invalidCount++;
      }
    } else {
      invalidCount++;
    }
    
    await runQuery(
      `INSERT INTO import_records 
        (batch_id, source_type, source_file_name, row_number, raw_data, is_valid, errors, suggestions, imported_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        'csv',
        fileName,
        rowNum,
        JSON.stringify(rows[i]),
        validation.isValid ? 1 : 0,
        JSON.stringify(validation.errors),
        JSON.stringify(validation.suggestions),
        importedId
      ]
    );
    
    results.push({
      rowNumber: rowNum,
      isValid: validation.isValid,
      errors: validation.errors,
      suggestions: validation.suggestions,
      importedId
    });
  }
  
  await runQuery(
    'UPDATE import_batches SET valid_records = ?, invalid_records = ?, status = ? WHERE id = ?',
    [validCount, invalidCount, 'completed', batchId]
  );
  
  return { batchId, results };
};

export const importCleaningRecordsFromJson = async (
  records: any[],
  fileName: string
): Promise<{ batchId: string; results: any[] }> => {
  const batchId = generateBatchId();
  const results: any[] = [];
  let validCount = 0;
  let invalidCount = 0;
  
  await runQuery(
    'INSERT INTO import_batches (id, type, file_name, total_records, status) VALUES (?, ?, ?, ?, ?)',
    [batchId, 'cleaning', fileName, records.length, 'processing']
  );
  
  for (let i = 0; i < records.length; i++) {
    const rowNum = i + 1;
    const rawData = records[i];
    const validation = validateCleaningRecord(rawData);
    
    let importedId: number | undefined;
    
    if (validation.isValid) {
      try {
        const result = await runQuery(
          `INSERT INTO cleaning_records 
            (room_number, cleaner_name, cleaner_phone, scheduled_date, start_time, end_time, 
             status, photos, quality_score, remarks, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            validation.data.roomNumber,
            validation.data.cleanerName,
            validation.data.cleanerPhone,
            validation.data.scheduledDate,
            validation.data.startTime,
            validation.data.endTime,
            validation.data.status,
            validation.data.photos ? JSON.stringify(validation.data.photos) : null,
            validation.data.qualityScore,
            validation.data.remarks,
            validation.data.createdBy
          ]
        );
        importedId = result.lastID;
        validCount++;
      } catch (error: any) {
        validation.isValid = false;
        validation.errors.push(`数据库错误: ${error.message}`);
        invalidCount++;
      }
    } else {
      invalidCount++;
    }
    
    await runQuery(
      `INSERT INTO import_records 
        (batch_id, source_type, source_file_name, row_number, raw_data, is_valid, errors, suggestions, imported_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        'json',
        fileName,
        rowNum,
        JSON.stringify(rawData),
        validation.isValid ? 1 : 0,
        JSON.stringify(validation.errors),
        JSON.stringify(validation.suggestions),
        importedId
      ]
    );
    
    results.push({
      rowNumber: rowNum,
      isValid: validation.isValid,
      errors: validation.errors,
      suggestions: validation.suggestions,
      importedId
    });
  }
  
  await runQuery(
    'UPDATE import_batches SET valid_records = ?, invalid_records = ?, status = ? WHERE id = ?',
    [validCount, invalidCount, 'completed', batchId]
  );
  
  return { batchId, results };
};

export const getImportRecordById = async (id: number) => {
  return getOne('SELECT * FROM import_records WHERE id = ?', [id]);
};

export const getImportRecordsByBatch = async (batchId: string, isValid?: boolean) => {
  let sql = 'SELECT * FROM import_records WHERE batch_id = ?';
  const params: any[] = [batchId];
  
  if (isValid !== undefined) {
    sql += ' AND is_valid = ?';
    params.push(isValid ? 1 : 0);
  }
  
  return getAll(sql, params);
};

export const getBatchInfo = async (batchId: string) => {
  return getOne('SELECT * FROM import_batches WHERE id = ?', [batchId]);
};

export const getAllBatches = async () => {
  return getAll('SELECT * FROM import_batches ORDER BY created_at DESC');
};
