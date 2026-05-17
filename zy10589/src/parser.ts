import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { LogTopicInput, InvalidLogTopic } from './types.js';

export function parseInputFile(filePath: string): {
  validInputs: LogTopicInput[];
  invalidInputs: InvalidLogTopic[];
} {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const validInputs: LogTopicInput[] = [];
  const invalidInputs: InvalidLogTopic[] = [];

  const headerLine = lines[0];
  const headers = parseHeader(headerLine);

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const line = lines[i].trim();

    if (!line) {
      continue;
    }

    const result = parseLine(line, headers, lineNumber);
    if (result.type === 'valid') {
      validInputs.push(result.data);
    } else {
      invalidInputs.push(result.data);
    }
  }

  return { validInputs, invalidInputs };
}

function parseHeader(headerLine: string): string[] {
  try {
    const records = parse(headerLine, {
      delimiter: ',',
      trim: true,
      skip_empty_lines: true,
    });
    return records[0] || [];
  } catch {
    return [];
  }
}

function parseLine(
  line: string,
  headers: string[],
  lineNumber: number
): { type: 'valid'; data: LogTopicInput } | { type: 'invalid'; data: InvalidLogTopic } {
  try {
    const records = parse(line, {
      delimiter: ',',
      trim: true,
      skip_empty_lines: true,
    });

    if (records.length === 0) {
      return {
        type: 'invalid',
        data: {
          topic: '',
          dailySizeGB: '',
          retentionDays: '',
          compressionRatio: '',
          costTag: '',
          originalLineNumber: lineNumber,
          errorReason: '空行或解析失败',
        },
      };
    }

    const row = records[0];
    const errors: string[] = [];

    const topic = String(row[0] || '').trim();
    const dailySizeGBStr = String(row[1] || '').trim();
    const retentionDaysStr = String(row[2] || '').trim();
    const compressionRatioStr = String(row[3] || '').trim();
    const costTag = String(row[4] || '').trim();

    if (!topic) {
      errors.push('日志主题为空');
    }

    const dailySizeGB = parseFloat(dailySizeGBStr);
    if (isNaN(dailySizeGB) || dailySizeGB < 0) {
      errors.push(`日均大小无效: "${dailySizeGBStr}"`);
    }

    const retentionDays = parseInt(retentionDaysStr, 10);
    if (isNaN(retentionDays) || retentionDays < 0) {
      errors.push(`保留天数无效: "${retentionDaysStr}"`);
    }

    const compressionRatio = parseFloat(compressionRatioStr);
    if (isNaN(compressionRatio) || compressionRatio <= 0 || compressionRatio > 1) {
      errors.push(`压缩率无效: "${compressionRatioStr}" (应为0-1之间的小数)`);
    }

    if (errors.length > 0) {
      return {
        type: 'invalid',
        data: {
          topic,
          dailySizeGB: dailySizeGBStr,
          retentionDays: retentionDaysStr,
          compressionRatio: compressionRatioStr,
          costTag,
          originalLineNumber: lineNumber,
          errorReason: errors.join('; '),
        },
      };
    }

    return {
      type: 'valid',
      data: {
        topic,
        dailySizeGB,
        retentionDays,
        compressionRatio,
        costTag: costTag || '未分类',
        originalLineNumber: lineNumber,
      },
    };
  } catch (error) {
    return {
      type: 'invalid',
      data: {
        topic: '',
        dailySizeGB: '',
        retentionDays: '',
        compressionRatio: '',
        costTag: '',
        originalLineNumber: lineNumber,
        errorReason: `解析异常: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}