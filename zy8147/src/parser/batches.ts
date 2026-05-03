import { parse as csvParse } from 'csv-parse/sync';
import { BatchRecord } from '../types';

interface RawBatchRecord {
  batch_id: string;
  start_time: string;
  end_time: string;
  product_id: string;
  product_name: string;
  target_weight: string;
  tolerance_min: string;
  tolerance_max: string;
  station_id: string;
}

export function parseBatchRecords(csvContent: string): BatchRecord[] {
  try {
    const records: RawBatchRecord[] = csvParse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((record, index) => {
      validateBatchRecord(record, index);
      return {
        batchId: record.batch_id,
        startTime: parseDateTime(record.start_time),
        endTime: parseDateTime(record.end_time),
        productId: record.product_id,
        productName: record.product_name,
        targetWeight: parseFloat(record.target_weight),
        toleranceMin: parseFloat(record.tolerance_min),
        toleranceMax: parseFloat(record.tolerance_max),
        stationId: record.station_id,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse batches.csv: ${message}`);
  }
}

function validateBatchRecord(record: RawBatchRecord, index: number): void {
  const requiredFields = [
    'batch_id', 'start_time', 'end_time', 'product_id',
    'product_name', 'target_weight', 'tolerance_min', 
    'tolerance_max', 'station_id'
  ];

  for (const field of requiredFields) {
    if (!(field in record) || !record[field as keyof RawBatchRecord]?.toString().trim()) {
      throw new Error(`Batch record at index ${index} is missing required field: ${field}`);
    }
  }

  const startTime = parseDateTime(record.start_time);
  const endTime = parseDateTime(record.end_time);

  if (endTime < startTime) {
    throw new Error(`Batch record at index ${index}: end_time (${record.end_time}) is before start_time (${record.start_time})`);
  }

  const targetWeight = parseFloat(record.target_weight);
  const toleranceMin = parseFloat(record.tolerance_min);
  const toleranceMax = parseFloat(record.tolerance_max);

  if (isNaN(targetWeight) || targetWeight < 0) {
    throw new Error(`Batch record at index ${index}: invalid target_weight: ${record.target_weight}`);
  }

  if (isNaN(toleranceMin)) {
    throw new Error(`Batch record at index ${index}: invalid tolerance_min: ${record.tolerance_min}`);
  }

  if (isNaN(toleranceMax)) {
    throw new Error(`Batch record at index ${index}: invalid tolerance_max: ${record.tolerance_max}`);
  }
}

function parseDateTime(dateTimeStr: string): Date {
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid datetime format: ${dateTimeStr}`);
  }
  return date;
}
