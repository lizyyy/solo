import * as fs from 'fs';
import csvParser from 'csv-parser';
import { CaseInfo } from '../types';

interface CsvRow {
  [key: string]: string | undefined;
}

export async function parseCasesCsv(filePath: string): Promise<CaseInfo[]> {
  const cases: CaseInfo[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath, 'utf-8')
      .pipe(csvParser())
      .on('data', (row: CsvRow) => {
        const secretLevel = parseSecretLevel(row['密级'] || row['secretLevel']);
        const requiredDocs = parseRequiredDocuments(row['必备文书'] || row['requiredDocuments'] || '');
        
        const caseInfo: CaseInfo = {
          caseNumber: row['案号'] || row['caseNumber'] || '',
          caseType: row['案件类型'] || row['caseType'] || '',
          parties: row['当事人'] || row['parties'] || '',
          judge: row['承办法官'] || row['judge'] || '',
          filingDate: row['立案日期'] || row['filingDate'] || '',
          secretLevel,
          requiredDocuments: requiredDocs,
          batchNumber: row['批次号'] || row['batchNumber'] || 'B001'
        };
        
        if (caseInfo.caseNumber) {
          cases.push(caseInfo);
        }
      })
      .on('end', () => {
        resolve(cases);
      })
      .on('error', (error: Error) => {
        reject(new Error(`解析 cases.csv 失败: ${error.message}`));
      });
  });
}

function parseSecretLevel(level: string | undefined): CaseInfo['secretLevel'] {
  if (!level) return '公开';
  
  const levelMap: Record<string, CaseInfo['secretLevel']> = {
    '公开': '公开',
    'public': '公开',
    '内部': '内部',
    'internal': '内部',
    '秘密': '秘密',
    'secret': '秘密',
    '机密': '机密',
    'confidential': '机密'
  };
  
  return levelMap[level.trim()] || '公开';
}

function parseRequiredDocuments(docsStr: string): string[] {
  if (!docsStr) return [];
  
  return docsStr
    .split(/[,，;；]/)
    .map(doc => doc.trim())
    .filter(doc => doc.length > 0);
}
