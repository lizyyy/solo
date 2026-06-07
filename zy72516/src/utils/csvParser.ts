import Papa from 'papaparse';
import { AnnotationRecord, RecordStatus, AbnormalType } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export interface ParsedCsvRow {
  annotatorMessage: string;
  referenceUrl: string;
  urlStatus: boolean;
  robotJudgment: string;
  [key: string]: unknown;
}

export function parseCsvFile(file: File): Promise<AnnotationRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        try {
          const records = results.data.map((row, index) => {
            const annotatorMessage = row['标注员留言'] || row['message'] || row['annotator_message'] || '';
            const referenceUrl = row['引用链接'] || row['url'] || row['reference_url'] || '';
            const urlStatusRaw = row['链接状态'] || row['url_status'] || '有效';
            const robotJudgment = row['机器人判断'] || row['judgment'] || row['robot_judgment'] || '';

            const urlStatus = !['无效', 'false', 'no', '404', '失效'].includes(
              String(urlStatusRaw).toLowerCase().trim()
            );

            return {
              id: generateId(),
              originalLineNumber: index + 2,
              annotatorMessage: String(annotatorMessage),
              referenceUrl: String(referenceUrl),
              urlStatus,
              robotJudgment: String(robotJudgment),
              currentStatus: RecordStatus.PENDING,
              abnormalType: AbnormalType.NONE,
              judgmentLogs: [],
              rawData: row as Record<string, unknown>,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as AnnotationRecord;
          });

          resolve(records);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export function parseCsvString(content: string): AnnotationRecord[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true
  });

  return result.data.map((row, index) => {
    const annotatorMessage = row['标注员留言'] || row['message'] || '';
    const referenceUrl = row['引用链接'] || row['url'] || '';
    const urlStatusRaw = row['链接状态'] || row['url_status'] || '有效';
    const robotJudgment = row['机器人判断'] || row['judgment'] || '';

    const urlStatus = !['无效', 'false', 'no', '404', '失效'].includes(
      String(urlStatusRaw).toLowerCase().trim()
    );

    return {
      id: generateId(),
      originalLineNumber: index + 2,
      annotatorMessage: String(annotatorMessage),
      referenceUrl: String(referenceUrl),
      urlStatus,
      robotJudgment: String(robotJudgment),
      currentStatus: RecordStatus.PENDING,
      abnormalType: AbnormalType.NONE,
      judgmentLogs: [],
      rawData: row as Record<string, unknown>,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as AnnotationRecord;
  });
}
