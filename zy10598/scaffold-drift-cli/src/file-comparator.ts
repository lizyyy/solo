import fs from 'fs-extra';
import path from 'path';
import * as diff from 'diff';
import { FileEntry, FileCheckResult, DriftItem, DiffChunk } from './types';
import { minimatch } from 'minimatch';

export class FileComparator {
  async compare(
    repoPath: string,
    templatePath: string,
    fileEntry: FileEntry,
    templateContent: string | null
  ): Promise<FileCheckResult> {
    const repoFilePath = path.join(repoPath, fileEntry.path);
    const exists = await fs.pathExists(repoFilePath);
    
    const result: FileCheckResult = {
      path: fileEntry.path,
      exists,
      required: fileEntry.required,
      drifts: []
    };

    if (!exists) {
      if (fileEntry.required) {
        result.drifts.push({
          id: this.generateId(),
          type: 'file_missing',
          path: fileEntry.path,
          status: 'risk',
          description: `必需文件缺失: ${fileEntry.path}`,
          severity: 'high',
          reason: '模板要求此文件必须存在'
        });
      }
      return result;
    }

    if (fileEntry.checkContent && templateContent) {
      try {
        const repoContent = await fs.readFile(repoFilePath, 'utf-8');
        const contentMatch = this.isContentMatch(repoContent, templateContent, fileEntry.ignorePatterns || []);
        result.contentMatch = contentMatch;
        
        if (!contentMatch) {
          const diffChunks = this.generateDiff(repoContent, templateContent);
          result.drifts.push({
            id: this.generateId(),
            type: 'content_diff',
            path: fileEntry.path,
            status: 'risk',
            description: `文件内容与模板存在差异: ${fileEntry.path}`,
            severity: 'medium',
            reason: '文件内容已偏离模板',
            diff: diffChunks,
            expected: templateContent.substring(0, 500) + (templateContent.length > 500 ? '...' : ''),
            actual: repoContent.substring(0, 500) + (repoContent.length > 500 ? '...' : '')
          });
        }
      } catch (error: any) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
          result.drifts.push({
            id: this.generateId(),
            type: 'permission_denied',
            path: fileEntry.path,
            status: 'unknown',
            description: `无法读取文件: ${fileEntry.path}`,
            severity: 'low',
            reason: '权限不足'
          });
        } else {
          result.drifts.push({
            id: this.generateId(),
            type: 'parse_error',
            path: fileEntry.path,
            status: 'unknown',
            description: `读取文件时出错: ${fileEntry.path}`,
            severity: 'low',
            reason: error.message
          });
        }
      }
    }

    return result;
  }

  private isContentMatch(
    repoContent: string,
    templateContent: string,
    ignorePatterns: string[]
  ): boolean {
    let repoLines = repoContent.split('\n');
    let templateLines = templateContent.split('\n');
    
    for (const pattern of ignorePatterns) {
      repoLines = repoLines.filter(line => !minimatch(line, pattern, { matchBase: true, nocase: true }));
      templateLines = templateLines.filter(line => !minimatch(line, pattern, { matchBase: true, nocase: true }));
    }
    
    return repoLines.join('\n').trim() === templateLines.join('\n').trim();
  }

  private generateDiff(actual: string, expected: string): DiffChunk[] {
    const diffResult = diff.diffLines(expected, actual);
    const chunks: DiffChunk[] = [];
    
    let lineCount = 1;
    for (const part of diffResult) {
      const chunk: DiffChunk = {
        type: part.added ? 'added' : part.removed ? 'removed' : 'unchanged',
        content: part.value,
        lineStart: lineCount
      };
      
      const lines = part.value.split('\n').length - 1;
      lineCount += lines;
      chunk.lineEnd = lineCount - 1;
      
      chunks.push(chunk);
    }
    
    return chunks;
  }

  private generateId(): string {
    return `drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
