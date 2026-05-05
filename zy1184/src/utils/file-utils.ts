import * as fs from 'fs';
import * as path from 'path';

export function readFile(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf-8');
}

export function writeFile(filePath: string, content: string): void {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(absolutePath, content, 'utf-8');
}

export function readJsonFile<T = any>(filePath: string): T {
  const content = readFile(filePath);
  return JSON.parse(content) as T;
}

export function writeJsonFile(filePath: string, data: any): void {
  const content = JSON.stringify(data, null, 2);
  writeFile(filePath, content);
}

export function readCsvFile(filePath: string, delimiter: string = ','): string[][] {
  const content = readFile(filePath);
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  });
}

export function writeCsvFile(filePath: string, rows: string[][]): void {
  const content = rows.map(row => 
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
  
  writeFile(filePath, content);
}

export function listFiles(dirPath: string, pattern?: string): string[] {
  const absolutePath = path.resolve(dirPath);
  
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    return [];
  }
  
  const files = fs.readdirSync(absolutePath);
  
  if (pattern) {
    const regex = new RegExp(pattern);
    return files.filter(f => regex.test(f));
  }
  
  return files;
}

export function ensureDir(dirPath: string): void {
  const absolutePath = path.resolve(dirPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
}

export function getFileSize(filePath: string): number {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    return 0;
  }
  return fs.statSync(absolutePath).size;
}
