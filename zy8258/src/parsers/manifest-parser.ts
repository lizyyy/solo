import * as fs from 'fs';
import * as readline from 'readline';
import { ManifestEntry } from '../types';

export async function parseManifestJsonl(filePath: string): Promise<ManifestEntry[]> {
  const entries: ManifestEntry[] = [];
  
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity
    });
    
    let lineNumber = 0;
    
    rl.on('line', (line) => {
      lineNumber++;
      line = line.trim();
      
      if (!line || line.startsWith('#')) {
        return;
      }
      
      try {
        const obj = JSON.parse(line);
        const entry: ManifestEntry = {
          caseNumber: obj.caseNumber || obj['案号'] || '',
          filePath: obj.filePath || obj['文件路径'] || '',
          fileName: obj.fileName || obj['文件名'] || '',
          fileSize: typeof obj.fileSize === 'number' ? obj.fileSize : 
                    typeof obj['文件大小'] === 'number' ? obj['文件大小'] : 0,
          lastModified: obj.lastModified || obj['修改时间'] || '',
          diskLabel: obj.diskLabel || obj['光盘标签'] || '',
          batchNumber: obj.batchNumber || obj['批次号'] || 'B001'
        };
        
        if (entry.caseNumber && entry.filePath) {
          entries.push(entry);
        }
      } catch (error) {
        console.warn(`警告: 第 ${lineNumber} 行 JSON 解析失败: ${line.substring(0, 50)}...`);
      }
    });
    
    rl.on('close', () => {
      resolve(entries);
    });
    
    rl.on('error', (error) => {
      reject(new Error(`解析 manifest.jsonl 失败: ${(error as Error).message}`));
    });
  });
}

export function groupManifestByCase(entries: ManifestEntry[]): Map<string, ManifestEntry[]> {
  const map = new Map<string, ManifestEntry[]>();
  
  for (const entry of entries) {
    const existing = map.get(entry.caseNumber) || [];
    existing.push(entry);
    map.set(entry.caseNumber, existing);
  }
  
  return map;
}

export function groupManifestByBatch(entries: ManifestEntry[]): Map<string, ManifestEntry[]> {
  const map = new Map<string, ManifestEntry[]>();
  
  for (const entry of entries) {
    const existing = map.get(entry.batchNumber) || [];
    existing.push(entry);
    map.set(entry.batchNumber, existing);
  }
  
  return map;
}
