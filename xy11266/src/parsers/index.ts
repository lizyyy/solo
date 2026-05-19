import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { db } from '../database';
import { CallRecord, ErrorRecord, SensitiveWord } from '../types';

export interface ParseResult<T> {
  success: boolean;
  data?: T[];
  errors: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolvedAt'>[];
}

export class TranscriptParser {
  async parseFile(filePath: string): Promise<ParseResult<Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>>> {
    const results: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolvedAt'>[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const fileName = path.basename(filePath);

      let currentCall: Partial<CallRecord> = {};
      let transcriptLines: string[] = [];
      let lineNumber = 0;

      for (const line of lines) {
        lineNumber++;
        const trimmedLine = line.trim();

        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('通话ID:')) {
          if (currentCall.callId && transcriptLines.length > 0) {
            this.addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber);
          }
          currentCall = { callId: trimmedLine.replace('通话ID:', '').trim() };
          transcriptLines = [];
        } else if (trimmedLine.startsWith('坐席姓名:')) {
          currentCall.agentName = trimmedLine.replace('坐席姓名:', '').trim();
        } else if (trimmedLine.startsWith('坐席工号:')) {
          currentCall.agentId = trimmedLine.replace('坐席工号:', '').trim();
        } else if (trimmedLine.startsWith('通话日期:')) {
          currentCall.callDate = trimmedLine.replace('通话日期:', '').trim();
        } else if (trimmedLine.startsWith('通话时长:')) {
          const durationStr = trimmedLine.replace('通话时长:', '').trim();
          currentCall.callDuration = this.parseDuration(durationStr);
        } else if (trimmedLine.match(/^\[\d{2}:\d{2}:\d{2}\]/)) {
          transcriptLines.push(trimmedLine);
        } else if (trimmedLine.match(/^客服:|^用户:/)) {
          transcriptLines.push(trimmedLine);
        } else if (trimmedLine.includes('---') || trimmedLine.includes('===')) {
          if (currentCall.callId && transcriptLines.length > 0) {
            this.addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber);
            currentCall = {};
            transcriptLines = [];
          }
        }
      }

      if (currentCall.callId && transcriptLines.length > 0) {
        this.addValidCall(results, currentCall, transcriptLines, errors, fileName, lineNumber);
      }

      return { success: true, data: results, errors };
    } catch (error) {
      errors.push({
        sourceFile: path.basename(filePath),
        originalPosition: 'file_read_error',
        rawContent: '',
        errorType: 'FILE_READ_ERROR',
        errorMessage: (error as Error).message,
        suggestion: '检查文件路径是否正确，文件是否有读取权限',
        status: 'unresolved'
      });
      return { success: false, errors };
    }
  }

  private addValidCall(
    results: Omit<CallRecord, 'id' | 'createdAt' | 'updatedAt'>[],
    currentCall: Partial<CallRecord>,
    transcriptLines: string[],
    errors: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolvedAt'>[],
    fileName: string,
    lineNumber: number
  ) {
    const requiredFields = ['callId', 'agentName', 'agentId', 'callDate', 'callDuration'];
    const missingFields = requiredFields.filter(field => !currentCall[field as keyof CallRecord]);

    if (missingFields.length > 0) {
      errors.push({
        sourceFile: fileName,
        originalPosition: `line_${lineNumber}`,
        rawContent: JSON.stringify(currentCall),
        errorType: 'MISSING_FIELDS',
        errorMessage: `缺少必填字段: ${missingFields.join(', ')}`,
        suggestion: '请补充通话ID、坐席姓名、坐席工号、通话日期和通话时长',
        status: 'unresolved'
      });
      return;
    }

    if (transcriptLines.length === 0) {
      errors.push({
        sourceFile: fileName,
        originalPosition: `line_${lineNumber}`,
        rawContent: JSON.stringify(currentCall),
        errorType: 'EMPTY_TRANSCRIPT',
        errorMessage: '通话转写内容为空',
        suggestion: '请检查通话记录格式，确保包含对话内容',
        status: 'unresolved'
      });
      return;
    }

    results.push({
      callId: currentCall.callId!,
      agentName: currentCall.agentName!,
      agentId: currentCall.agentId!,
      callDate: currentCall.callDate!,
      callDuration: currentCall.callDuration!,
      transcript: transcriptLines.join('\n'),
      status: 'pending'
    });
  }

  private parseDuration(durationStr: string): number {
    const match = durationStr.match(/(\d+):(\d+):(\d+)/) || durationStr.match(/(\d+)分(\d+)秒/);
    if (match) {
      const hours = parseInt(match[1]) || 0;
      const minutes = parseInt(match[2]) || 0;
      const seconds = parseInt(match[3]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
    const seconds = parseInt(durationStr);
    return isNaN(seconds) ? 0 : seconds;
  }
}

export class MetadataParser {
  async parseFile(filePath: string): Promise<ParseResult<Record<string, string>>> {
    const results: Record<string, string>[] = [];
    const errors: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolvedAt'>[] = [];
    const fileName = path.basename(filePath);
    let lineNumber = 0;

    try {
      await new Promise((resolve) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            lineNumber++;
            results.push(data);
          })
          .on('end', resolve);
      });

      return { success: true, data: results, errors };
    } catch (error) {
      errors.push({
        sourceFile: fileName,
        originalPosition: `line_${lineNumber}`,
        rawContent: '',
        errorType: 'CSV_PARSE_ERROR',
        errorMessage: (error as Error).message,
        suggestion: '检查CSV文件格式是否正确，分隔符是否为逗号',
        status: 'unresolved'
      });
      return { success: false, errors };
    }
  }
}

export class SensitiveWordsParser {
  async parseFile(filePath: string): Promise<ParseResult<Omit<SensitiveWord, 'id' | 'createdAt'>>> {
    const results: Omit<SensitiveWord, 'id' | 'createdAt'>[] = [];
    const errors: Omit<ErrorRecord, 'id' | 'createdAt' | 'resolvedAt'>[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const fileName = path.basename(filePath);
      let lineNumber = 0;

      for (const line of lines) {
        lineNumber++;
        const trimmedLine = line.trim();

        if (!trimmedLine || trimmedLine.startsWith('#')) continue;

        const parts = trimmedLine.split(/[,，\t]/);
        const word = parts[0]?.trim();

        if (!word) {
          errors.push({
            sourceFile: fileName,
            originalPosition: `line_${lineNumber}`,
            rawContent: trimmedLine,
            errorType: 'EMPTY_WORD',
            errorMessage: '敏感词为空',
            suggestion: '请输入有效的敏感词',
            status: 'unresolved'
          });
          continue;
        }

        results.push({
          word,
          category: parts[1]?.trim() || '其他',
          severity: (parts[2]?.trim()?.toLowerCase() as any) || 'medium'
        });
      }

      return { success: true, data: results, errors };
    } catch (error) {
      errors.push({
        sourceFile: path.basename(filePath),
        originalPosition: 'file_read_error',
        rawContent: '',
        errorType: 'FILE_READ_ERROR',
        errorMessage: (error as Error).message,
        suggestion: '检查敏感词文件路径是否正确',
        status: 'unresolved'
      });
      return { success: false, errors };
    }
  }
}

export const transcriptParser = new TranscriptParser();
export const metadataParser = new MetadataParser();
export const sensitiveWordsParser = new SensitiveWordsParser();
