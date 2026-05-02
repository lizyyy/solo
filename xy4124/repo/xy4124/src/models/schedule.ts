import { BaseEntity, TimestampRange } from './common';

export interface Schedule extends BaseEntity {
  scheduleId: string;
  filmId: string;
  versionId: string;
  auditoriumId: string;
  showTime: TimestampRange;
  preShowMinutes: number;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  actualEndTime: string;
  notes?: string;
  isCancelled: boolean;
  cancelReason?: string;
}

export interface ScheduleCreateInput {
  scheduleId?: string;
  filmId: string;
  versionId: string;
  auditoriumId: string;
  showTime: TimestampRange;
  preShowMinutes: number;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  notes?: string;
}

export interface ScheduleCSVImportRow {
  scheduleId?: string;
  filmId: string;
  filmTitle: string;
  versionId: string;
  versionName: string;
  auditoriumId: string;
  auditoriumName: string;
  startTime: string;
  endTime: string;
  preShowMinutes?: string;
  bufferMinutesBefore?: string;
  bufferMinutesAfter?: string;
  notes?: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}
