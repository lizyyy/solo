import { parse as csvParse } from 'csv-parse/sync';
import { CalibrationRecord } from '../types';

interface RawCalibrationRecord {
  station_id: string;
  calibration_date: string;
  expire_date: string;
  calibrated_by: string;
  certificate_number: string;
}

export function parseCalibrationRecords(csvContent: string): CalibrationRecord[] {
  try {
    const records: RawCalibrationRecord[] = csvParse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    return records.map((record, index) => {
      validateCalibrationRecord(record, index);
      return {
        stationId: record.station_id,
        calibrationDate: parseDate(record.calibration_date),
        expireDate: parseDate(record.expire_date),
        calibratedBy: record.calibrated_by,
        certificateNumber: record.certificate_number,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse calibration.csv: ${message}`);
  }
}

function validateCalibrationRecord(record: RawCalibrationRecord, index: number): void {
  const requiredFields = [
    'station_id', 'calibration_date', 'expire_date', 
    'calibrated_by', 'certificate_number'
  ];

  for (const field of requiredFields) {
    if (!(field in record) || !record[field as keyof RawCalibrationRecord]?.toString().trim()) {
      throw new Error(`Calibration record at index ${index} is missing required field: ${field}`);
    }
  }

  const calibrationDate = parseDate(record.calibration_date);
  const expireDate = parseDate(record.expire_date);

  if (expireDate < calibrationDate) {
    throw new Error(`Calibration record at index ${index}: expire_date (${record.expire_date}) is before calibration_date (${record.calibration_date})`);
  }
}

function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return date;
}
