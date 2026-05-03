import Papa from 'papaparse';
import { Cue, ChannelValue, ParsingError } from '../types';

export function parseCues(csvString: string): { cues: Cue[]; errors: ParsingError[] } {
  const errors: ParsingError[] = [];
  const cues: Cue[] = [];

  try {
    const result = Papa.parse<Record<string, string>>(csvString, {
      header: true,
      skipEmptyLines: true
    });

    if (result.errors.length > 0) {
      result.errors.forEach((err) => {
        errors.push({
          type: 'csv',
          message: err.message,
          row: err.row
        });
      });
    }

    const allChannelIds = new Set<string>();
    
    result.data.forEach((row, index) => {
      const cueErrors = validateCueRow(row, index + 1);
      errors.push(...cueErrors);

      const channelValues: ChannelValue[] = [];
      Object.entries(row).forEach(([key, value]) => {
        if (key.startsWith('channel_') && value !== undefined && value !== '') {
          const channelId = key.replace('channel_', '');
          const numValue = parseFloat(value);
          
          if (!isNaN(numValue) && numValue >= 0 && numValue <= 255) {
            channelValues.push({
              channelId,
              value: Math.round(numValue)
            });
            allChannelIds.add(channelId);
          } else {
            errors.push({
              type: 'csv',
              message: `通道 ${channelId} 的值 "${value}" 无效，必须在 0-255 之间`,
              row: index + 1,
              field: key
            });
          }
        }
      });

      cues.push({
        id: String(row.id || `cue-${index}`),
        number: String(row.number || `${index + 1}`),
        name: String(row.name || `Cue ${index + 1}`),
        startTime: parseFloat(row.startTime || '0'),
        fadeIn: parseFloat(row.fadeIn || '0'),
        fadeOut: parseFloat(row.fadeOut || '0'),
        duration: parseFloat(row.duration || '0'),
        channelValues,
        notes: row.notes
      });
    });

    cues.sort((a, b) => a.startTime - b.startTime);

  } catch (e) {
    errors.push({
      type: 'csv',
      message: `CSV 解析错误: ${e instanceof Error ? e.message : '未知错误'}`
    });
  }

  return { cues, errors };
}

function validateCueRow(row: Record<string, string>, rowNumber: number): ParsingError[] {
  const errors: ParsingError[] = [];

  if (!row.number) {
    errors.push({
      type: 'csv',
      message: `第 ${rowNumber} 行缺少 cue number`,
      row: rowNumber,
      field: 'number'
    });
  }

  const numericFields = ['startTime', 'fadeIn', 'fadeOut', 'duration'];
  numericFields.forEach((field) => {
    if (row[field]) {
      const value = parseFloat(row[field]);
      if (isNaN(value) || value < 0) {
        errors.push({
          type: 'csv',
          message: `第 ${rowNumber} 行的 ${field} 必须是有效的正数`,
          row: rowNumber,
          field
        });
      }
    }
  });

  return errors;
}

export function generateCuesCSV(cues: Cue[]): string {
  if (cues.length === 0) {
    return '';
  }

  const allChannelIds = new Set<string>();
  cues.forEach((cue) => {
    cue.channelValues.forEach((cv) => allChannelIds.add(cv.channelId));
  });

  const headers = ['id', 'number', 'name', 'startTime', 'fadeIn', 'fadeOut', 'duration', 'notes'];
  allChannelIds.forEach((channelId) => {
    headers.push(`channel_${channelId}`);
  });

  const rows = cues.map((cue) => {
    const row: Record<string, string | number> = {
      id: cue.id,
      number: cue.number,
      name: cue.name,
      startTime: cue.startTime,
      fadeIn: cue.fadeIn,
      fadeOut: cue.fadeOut,
      duration: cue.duration,
      notes: cue.notes || ''
    };

    cue.channelValues.forEach((cv) => {
      row[`channel_${cv.channelId}`] = cv.value;
    });

    return row;
  });

  return Papa.unparse(rows, {
    columns: headers
  });
}