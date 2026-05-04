import * as fs from 'fs';
import * as readline from 'readline';
import { HashEntry } from '../types';

export async function parseHashesTxt(filePath: string): Promise<HashEntry[]> {
  const entries: HashEntry[] = [];
  
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity
    });
    
    let lineNumber = 0;
    
    rl.on('line', (line) => {
      lineNumber++;
      line = line.trim();
      
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        return;
      }
      
      const entry = parseHashLine(line, lineNumber);
      if (entry) {
        entries.push(entry);
      }
    });
    
    rl.on('close', () => {
      resolve(entries);
    });
    
    rl.on('error', (error) => {
      reject(new Error(`解析 hashes.txt 失败: ${(error as Error).message}`));
    });
  });
}

function parseHashLine(line: string, lineNumber: number): HashEntry | null {
  const patterns = [
    { regex: /^([a-fA-F0-9]+)\s+\*?(.+)$/, algorithm: 'SHA256' },
    { regex: /^([a-fA-F0-9]{32})\s+\*?(.+)$/, algorithm: 'MD5' },
    { regex: /^([a-fA-F0-9]{40})\s+\*?(.+)$/, algorithm: 'SHA1' },
    { regex: /^([a-fA-F0-9]{64})\s+\*?(.+)$/, algorithm: 'SHA256' },
    { regex: /^(.+?)\s*[:=]\s*([a-fA-F0-9]+)$/, algorithm: 'SHA256' },
    { regex: /^(.+?)\s+([a-fA-F0-9]+)$/, algorithm: 'SHA256' }
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    if (match) {
      let filePath: string;
      let hash: string;
      
      if (pattern.regex.source.includes('[:=]')) {
        filePath = match[1].trim();
        hash = match[2].toLowerCase();
      } else if (pattern.regex.source.startsWith('^([a-fA-F0-9]')) {
        hash = match[1].toLowerCase();
        filePath = match[2].trim();
      } else {
        filePath = match[1].trim();
        hash = match[2].toLowerCase();
      }
      
      let algorithm = pattern.algorithm;
      if (hash.length === 32) algorithm = 'MD5';
      else if (hash.length === 40) algorithm = 'SHA1';
      else if (hash.length === 64) algorithm = 'SHA256';
      else if (hash.length === 128) algorithm = 'SHA512';
      
      return {
        filePath,
        hash,
        algorithm
      };
    }
  }
  
  console.warn(`警告: 第 ${lineNumber} 行哈希格式无法识别: ${line.substring(0, 50)}...`);
  return null;
}

export function createHashMap(entries: HashEntry[]): Map<string, { hash: string; algorithm: string }> {
  const map = new Map<string, { hash: string; algorithm: string }>();
  
  for (const entry of entries) {
    const normalizedPath = normalizePath(entry.filePath);
    map.set(normalizedPath, {
      hash: entry.hash,
      algorithm: entry.algorithm
    });
    map.set(entry.filePath, {
      hash: entry.hash,
      algorithm: entry.algorithm
    });
  }
  
  return map;
}

function normalizePath(path: string): string {
  return path
    .replace(/[\\/]+/g, '/')
    .replace(/^[.\\/]+/, '')
    .toLowerCase();
}
