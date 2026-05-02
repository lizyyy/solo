import * as path from 'path';
import { ManifestEntry, ImageExif, Issue } from '../types';
import { ImageParser } from '../parsers';
import { randomUUID } from 'crypto';

export class FileChecker {
  static checkDuplicateFiles(
    manifest: ManifestEntry[],
    inputDir: string
  ): { issues: Issue[]; duplicateFiles: string[] } {
    const issues: Issue[] = [];
    const duplicateFiles: string[] = [];
    
    const filenameCount = new Map<string, number>();
    const hashMap = new Map<string, string[]>();
    
    for (const entry of manifest) {
      filenameCount.set(entry.filename, (filenameCount.get(entry.filename) || 0) + 1);
      
      if (entry.hash) {
        const existing = hashMap.get(entry.hash) || [];
        existing.push(entry.filename);
        hashMap.set(entry.hash, existing);
      }
    }
    
    for (const [filename, count] of filenameCount.entries()) {
      if (count > 1) {
        duplicateFiles.push(filename);
        
        issues.push({
          id: randomUUID(),
          category: 'duplicate_file',
          severity: 'major',
          message: `文件名 ${filename} 在清单中出现 ${count} 次`,
          details: {
            filename,
            count,
          },
          relatedFiles: [filename],
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    for (const [hash, filenames] of hashMap.entries()) {
      if (filenames.length > 1) {
        const uniqueFilenames = [...new Set(filenames)];
        if (uniqueFilenames.length > 1) {
          issues.push({
            id: randomUUID(),
            category: 'duplicate_file',
            severity: 'minor',
            message: `多个文件具有相同的 hash 值`,
            details: {
              hash,
              filenames: uniqueFilenames,
            },
            relatedFiles: uniqueFilenames,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    
    return { issues, duplicateFiles: [...new Set(duplicateFiles)] };
  }

  static checkMissingFiles(
    manifest: ManifestEntry[],
    inputDir: string
  ): { issues: Issue[]; missingFiles: string[] } {
    const issues: Issue[] = [];
    const missingFiles: string[] = [];
    const imagesDir = path.join(inputDir, 'images');
    
    const uniqueFilenames = [...new Set(manifest.map(e => e.filename))];
    
    for (const filename of uniqueFilenames) {
      const filePath = path.join(imagesDir, filename);
      
      if (!ImageParser.fileExists(filePath)) {
        missingFiles.push(filename);
        
        issues.push({
          id: randomUUID(),
          category: 'missing_file',
          severity: 'critical',
          message: `图片文件 ${filename} 不存在`,
          details: {
            filename,
            expectedPath: filePath,
          },
          relatedFiles: [filename],
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    return { issues, missingFiles };
  }

  static checkFileSizeConsistency(
    manifest: ManifestEntry[],
    inputDir: string,
    exifMap: Map<string, ImageExif>
  ): Issue[] {
    const issues: Issue[] = [];
    const imagesDir = path.join(inputDir, 'images');
    
    for (const entry of manifest) {
      const filePath = path.join(imagesDir, entry.filename);
      
      if (ImageParser.fileExists(filePath)) {
        const actualSize = ImageParser.getFileSize(filePath);
        
        if (entry.fileSize > 0 && actualSize !== entry.fileSize) {
          issues.push({
            id: randomUUID(),
            category: 'file_corruption',
            severity: 'warning' as never,
            message: `文件 ${entry.filename} 大小不一致`,
            details: {
              filename: entry.filename,
              manifestSize: entry.fileSize,
              actualSize,
              diff: actualSize - entry.fileSize,
            },
            relatedFiles: [entry.filename],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    
    return issues;
  }

  static getCleanManifest(
    manifest: ManifestEntry[],
    duplicateFiles: string[],
    missingFiles: string[]
  ): ManifestEntry[] {
    const seen = new Set<string>();
    const toRemove = new Set([...duplicateFiles, ...missingFiles]);
    
    return manifest.filter(entry => {
      if (toRemove.has(entry.filename)) {
        return false;
      }
      
      const key = entry.filename;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
