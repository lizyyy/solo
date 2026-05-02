import csvParser from 'csv-parser';
import { Parser } from 'json2csv';
import { Readable } from 'stream';
import {
  ScheduleCSVImportRow,
  ImportResult,
  ImportError,
  ImportWarning,
  ScheduleCreateInput,
  TimestampRange,
  Schedule,
  FilmVersion,
  AuditoriumDevice,
  KDM,
  CheckStatus,
  RuleCheckResult,
} from '../models';

function parseIntOr(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseDateTime(value: string): Date {
  let date = new Date(value);
  if (isNaN(date.getTime())) {
    date = new Date(parseInt(value, 10));
  }
  return date;
}

function isValidDateTime(value: string): boolean {
  const date = parseDateTime(value);
  return !isNaN(date.getTime());
}

export interface CSVImportValidator {
  validateRow(row: ScheduleCSVImportRow, rowNumber: number): {
    errors: ImportError[];
    warnings: ImportWarning[];
    scheduleInput?: ScheduleCreateInput;
  };
}

export class BasicCSVValidator implements CSVImportValidator {
  validateRow(row: ScheduleCSVImportRow, rowNumber: number): {
    errors: ImportError[];
    warnings: ImportWarning[];
    scheduleInput?: ScheduleCreateInput;
  } {
    const errors: ImportError[] = [];
    const warnings: ImportWarning[] = [];
    
    if (!row.filmId || row.filmId.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'filmId',
        message: '影片ID不能为空',
      });
    }
    
    if (!row.filmTitle || row.filmTitle.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'filmTitle',
        message: '影片名称不能为空',
      });
    }
    
    if (!row.versionId || row.versionId.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'versionId',
        message: '版本ID不能为空',
      });
    }
    
    if (!row.auditoriumId || row.auditoriumId.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'auditoriumId',
        message: '影厅ID不能为空',
      });
    }
    
    if (!row.startTime || row.startTime.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'startTime',
        message: '开始时间不能为空',
      });
    } else if (!isValidDateTime(row.startTime)) {
      errors.push({
        row: rowNumber,
        field: 'startTime',
        message: `开始时间格式无效: ${row.startTime}`,
      });
    }
    
    if (!row.endTime || row.endTime.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'endTime',
        message: '结束时间不能为空',
      });
    } else if (!isValidDateTime(row.endTime)) {
      errors.push({
        row: rowNumber,
        field: 'endTime',
        message: `结束时间格式无效: ${row.endTime}`,
      });
    }
    
    if (isValidDateTime(row.startTime) && isValidDateTime(row.endTime)) {
      const start = parseDateTime(row.startTime);
      const end = parseDateTime(row.endTime);
      
      if (end <= start) {
        errors.push({
          row: rowNumber,
          field: 'endTime',
          message: '结束时间必须晚于开始时间',
        });
      }
      
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      if (durationMinutes < 5) {
        warnings.push({
          row: rowNumber,
          field: 'startTime/endTime',
          message: `排片时长较短 (${Math.round(durationMinutes)}分钟)`,
        });
      }
    }
    
    if (errors.length > 0) {
      return { errors, warnings };
    }
    
    const preShowMinutes = parseIntOr(row.preShowMinutes, 0);
    const bufferMinutesBefore = parseIntOr(row.bufferMinutesBefore, 0);
    const bufferMinutesAfter = parseIntOr(row.bufferMinutesAfter, 0);
    
    if (preShowMinutes < 0) {
      warnings.push({
        row: rowNumber,
        field: 'preShowMinutes',
        message: '预告时长为负数，已重置为0',
      });
    }
    
    if (bufferMinutesBefore < 0) {
      warnings.push({
        row: rowNumber,
        field: 'bufferMinutesBefore',
        message: '前置缓冲时长为负数，已重置为0',
      });
    }
    
    if (bufferMinutesAfter < 0) {
      warnings.push({
        row: rowNumber,
        field: 'bufferMinutesAfter',
        message: '后置缓冲时长为负数，已重置为0',
      });
    }
    
    const showTime: TimestampRange = {
      start: parseDateTime(row.startTime).toISOString(),
      end: parseDateTime(row.endTime).toISOString(),
    };
    
    const scheduleInput: ScheduleCreateInput = {
      scheduleId: row.scheduleId || undefined,
      filmId: row.filmId.trim(),
      versionId: row.versionId.trim(),
      auditoriumId: row.auditoriumId.trim(),
      showTime,
      preShowMinutes: Math.max(0, preShowMinutes),
      bufferMinutesBefore: Math.max(0, bufferMinutesBefore),
      bufferMinutesAfter: Math.max(0, bufferMinutesAfter),
      notes: row.notes,
    };
    
    return { errors, warnings, scheduleInput };
  }
}

export async function parseSchedulesCSV(csvContent: string): Promise<{
  rows: ScheduleCSVImportRow[];
  errors: ImportError[];
}> {
  const rows: ScheduleCSVImportRow[] = [];
  const errors: ImportError[] = [];
  let rowNumber = 0;
  
  return new Promise((resolve) => {
    const stream = Readable.from(csvContent);
    
    stream
      .pipe(csvParser({
        mapHeaders: ({ header }) => {
          const normalized = header.trim().toLowerCase();
          const headerMap: Record<string, string> = {
            'scheduleid': 'scheduleId',
            'schedule_id': 'scheduleId',
            'filmid': 'filmId',
            'film_id': 'filmId',
            'filmtitle': 'filmTitle',
            'film_title': 'filmTitle',
            'versionid': 'versionId',
            'version_id': 'versionId',
            'versionname': 'versionName',
            'version_name': 'versionName',
            'auditoriumid': 'auditoriumId',
            'auditorium_id': 'auditoriumId',
            'auditoriumname': 'auditoriumName',
            'auditorium_name': 'auditoriumName',
            'starttime': 'startTime',
            'start_time': 'startTime',
            'endtime': 'endTime',
            'end_time': 'endTime',
            'preshowminutes': 'preShowMinutes',
            'pre_show_minutes': 'preShowMinutes',
            'bufferminutesbefore': 'bufferMinutesBefore',
            'buffer_minutes_before': 'bufferMinutesBefore',
            'bufferminutesafter': 'bufferMinutesAfter',
            'buffer_minutes_after': 'bufferMinutesAfter',
          };
          return headerMap[normalized] || header;
        },
      }))
      .on('data', (data: any) => {
        rowNumber++;
        const row: ScheduleCSVImportRow = {
          scheduleId: data.scheduleId,
          filmId: data.filmId,
          filmTitle: data.filmTitle,
          versionId: data.versionId,
          versionName: data.versionName,
          auditoriumId: data.auditoriumId,
          auditoriumName: data.auditoriumName,
          startTime: data.startTime,
          endTime: data.endTime,
          preShowMinutes: data.preShowMinutes,
          bufferMinutesBefore: data.bufferMinutesBefore,
          bufferMinutesAfter: data.bufferMinutesAfter,
          notes: data.notes,
        };
        rows.push(row);
      })
      .on('error', (err: Error) => {
        errors.push({
          row: rowNumber,
          field: 'csv',
          message: `CSV解析错误: ${err.message}`,
        });
      })
      .on('end', () => {
        resolve({ rows, errors });
      });
  });
}

export interface RiskItem {
  scheduleId: string;
  filmTitle: string;
  filmId: string;
  versionId: string;
  auditoriumName: string;
  auditoriumId: string;
  showTimeStart: string;
  showTimeEnd: string;
  riskLevel: string;
  riskType: string;
  riskMessage: string;
  ruleId: string;
}

export function generateRiskCSV(
  schedules: Schedule[],
  filmVersions: Map<string, FilmVersion>,
  auditoriums: Map<string, AuditoriumDevice>,
  checkResults: Map<string, { status: CheckStatus; checks: RuleCheckResult[] }>
): string {
  const riskItems: RiskItem[] = [];
  
  for (const schedule of schedules) {
    const filmVersion = filmVersions.get(`${schedule.filmId}-${schedule.versionId}`);
    const auditorium = auditoriums.get(schedule.auditoriumId);
    const checkResult = checkResults.get(schedule.scheduleId);
    
    if (!checkResult) continue;
    
    for (const check of checkResult.checks) {
      if (check.status === CheckStatus.PASS) continue;
      
      riskItems.push({
        scheduleId: schedule.scheduleId,
        filmTitle: filmVersion?.filmTitle || schedule.filmId,
        filmId: schedule.filmId,
        versionId: schedule.versionId,
        auditoriumName: auditorium?.auditoriumName || schedule.auditoriumId,
        auditoriumId: schedule.auditoriumId,
        showTimeStart: schedule.showTime.start,
        showTimeEnd: schedule.showTime.end,
        riskLevel: check.status === CheckStatus.BLOCK ? 'BLOCK' : 'WARN',
        riskType: check.ruleName,
        riskMessage: check.message,
        ruleId: check.ruleId,
      });
    }
  }
  
  if (riskItems.length === 0) {
    return '';
  }
  
  const fields = [
    'scheduleId',
    'filmTitle',
    'filmId',
    'versionId',
    'auditoriumName',
    'auditoriumId',
    'showTimeStart',
    'showTimeEnd',
    'riskLevel',
    'riskType',
    'riskMessage',
    'ruleId',
  ];
  
  const parser = new Parser({ fields });
  return parser.parse(riskItems);
}

export function generateSchedulesCSV(schedules: Schedule[]): string {
  if (schedules.length === 0) {
    return '';
  }
  
  const fields = [
    'scheduleId',
    'filmId',
    'filmTitle',
    'versionId',
    'versionName',
    'auditoriumId',
    'auditoriumName',
    'startTime',
    'endTime',
    'preShowMinutes',
    'bufferMinutesBefore',
    'bufferMinutesAfter',
    'isCancelled',
    'notes',
  ];
  
  const data = schedules.map(s => ({
    scheduleId: s.scheduleId,
    filmId: s.filmId,
    filmTitle: '',
    versionId: s.versionId,
    versionName: '',
    auditoriumId: s.auditoriumId,
    auditoriumName: '',
    startTime: s.showTime.start,
    endTime: s.showTime.end,
    preShowMinutes: s.preShowMinutes,
    bufferMinutesBefore: s.bufferMinutesBefore,
    bufferMinutesAfter: s.bufferMinutesAfter,
    isCancelled: s.isCancelled ? '是' : '否',
    notes: s.notes || '',
  }));
  
  const parser = new Parser({ fields });
  return parser.parse(data);
}
