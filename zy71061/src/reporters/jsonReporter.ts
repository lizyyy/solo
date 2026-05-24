import * as path from 'path';
import { DiffReport } from '../types';
import { writeFile } from '../readers/fileReader';

export function writeJsonReport(report: DiffReport, outputDir: string, name: string): string {
  const filePath = path.join(outputDir, `${name}.json`);
  const content = JSON.stringify(report, null, 2);
  writeFile(filePath, content);
  return filePath;
}
