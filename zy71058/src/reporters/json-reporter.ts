import * as fs from 'fs';
import * as path from 'path';
import { ScanResult } from '../types';

export function writeJsonReport(result: ScanResult, outputDir: string): string {
  const fileName = `scan-result-${result.metadata.environment}-${Date.now()}.json`;
  const filePath = path.join(outputDir, fileName);
  
  const jsonContent = JSON.stringify(result, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
  
  return filePath;
}

export function writeLatestJsonReport(result: ScanResult, outputDir: string): string {
  const fileName = 'latest-result.json';
  const filePath = path.join(outputDir, fileName);
  
  const jsonContent = JSON.stringify(result, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
  
  return filePath;
}
