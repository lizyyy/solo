import * as fs from 'fs';
import * as path from 'path';
import { PrecheckResult, ManifestEntry } from '../types';

export class JsonReporter {
  static generateCleanManifest(
    cleanManifest: ManifestEntry[],
    outputDir: string
  ): string {
    const outputPath = path.join(outputDir, 'clean_manifest.json');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const content = JSON.stringify(cleanManifest, null, 2);
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }

  static generateFullResult(
    result: PrecheckResult,
    outputDir: string
  ): string {
    const outputPath = path.join(outputDir, 'precheck_result.json');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const content = JSON.stringify(result, null, 2);
    fs.writeFileSync(outputPath, content, 'utf-8');
    return outputPath;
  }
}
