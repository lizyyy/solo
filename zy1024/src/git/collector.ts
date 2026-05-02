import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { GitChange } from '../types';

interface DiffFileInfo {
  file: string;
  insertions: number;
  deletions: number;
}

export interface GitCollectorOptions {
  projectDir: string;
  fromRef?: string;
  toRef?: string;
  includeUncommitted?: boolean;
}

export class GitCollector {
  private git: SimpleGit;
  private options: GitCollectorOptions;

  constructor(options: GitCollectorOptions) {
    this.options = options;
    this.git = simpleGit(options.projectDir);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  async getChanges(): Promise<GitChange[]> {
    if (!(await this.isGitRepo())) {
      throw new Error(`Not a git repository: ${this.options.projectDir}`);
    }

    if (this.options.fromRef && this.options.toRef) {
      return this.getChangesFromRange(this.options.fromRef, this.options.toRef);
    } else if (this.options.fromRef) {
      return this.getChangesFromCommit(this.options.fromRef);
    } else {
      return this.getChangesFromWorkingDir();
    }
  }

  private async getChangesFromRange(fromRef: string, toRef: string): Promise<GitChange[]> {
    const changes: GitChange[] = [];
    
    try {
      const diffSummary = await this.git.diffSummary([
        `${fromRef}..${toRef}`
      ]);
      
      const fullDiff = await this.git.diff([
        `${fromRef}..${toRef}`,
      ]);

      for (const file of diffSummary.files) {
        const fileInfo = file as unknown as DiffFileInfo;
        const changeType = this.parseChangeType(fileInfo.file);
        const isBinary = this.isBinaryFile(fileInfo.file);
        
        const { filePath, oldFilePath } = this.parseRenamedPath(fileInfo.file);
        
        changes.push({
          filePath,
          oldFilePath,
          changeType,
          isBinary,
          insertions: fileInfo.insertions || 0,
          deletions: fileInfo.deletions || 0,
          diffContent: isBinary ? undefined : this.extractFileDiff(fullDiff, filePath, oldFilePath),
        });
      }
    } catch (error) {
      console.error('Error getting diff range:', error);
    }

    return changes;
  }

  private async getChangesFromCommit(commitRef: string): Promise<GitChange[]> {
    const changes: GitChange[] = [];
    
    try {
      const diffSummary = await this.git.diffSummary([
        `${commitRef}~1..${commitRef}`
      ]);
      
      const fullDiff = await this.git.diff([
        `${commitRef}~1..${commitRef}`,
      ]);

      for (const file of diffSummary.files) {
        const fileInfo = file as unknown as DiffFileInfo;
        const changeType = this.parseChangeType(fileInfo.file);
        const isBinary = this.isBinaryFile(fileInfo.file);
        
        const { filePath, oldFilePath } = this.parseRenamedPath(fileInfo.file);
        
        changes.push({
          filePath,
          oldFilePath,
          changeType,
          isBinary,
          insertions: fileInfo.insertions || 0,
          deletions: fileInfo.deletions || 0,
          diffContent: isBinary ? undefined : this.extractFileDiff(fullDiff, filePath, oldFilePath),
        });
      }
    } catch (error) {
      console.error('Error getting diff from commit:', error);
    }

    return changes;
  }

  private async getChangesFromWorkingDir(): Promise<GitChange[]> {
    const changes: GitChange[] = [];
    const seenPaths = new Set<string>();
    
    try {
      const status = await this.git.status();
      
      for (const fileItem of status.staged) {
        let filePath: string;
        let statusChar: string;
        
        if (typeof fileItem === 'string') {
          filePath = fileItem;
          statusChar = 'M';
        } else {
          const item = fileItem as { path: string; index: string };
          filePath = item.path;
          statusChar = item.index;
        }
        
        if (seenPaths.has(filePath)) continue;
        seenPaths.add(filePath);
        
        const changeType = this.statusToChangeType(statusChar);
        const isBinary = this.isBinaryFile(filePath);
        
        let diff = '';
        if (!isBinary && changeType !== 'deleted') {
          diff = await this.git.diff(['--cached', filePath]);
        }
        
        changes.push({
          filePath,
          changeType,
          isBinary,
          insertions: 0,
          deletions: 0,
          diffContent: isBinary ? undefined : diff,
        });
      }

      for (const file of status.modified) {
        if (seenPaths.has(file)) continue;
        seenPaths.add(file);
        
        const isBinary = this.isBinaryFile(file);
        let diff = '';
        if (!isBinary) {
          diff = await this.git.diff([file]);
        }
        
        changes.push({
          filePath: file,
          changeType: 'modified',
          isBinary,
          insertions: 0,
          deletions: 0,
          diffContent: isBinary ? undefined : diff,
        });
      }

      for (const file of status.not_added) {
        if (seenPaths.has(file)) continue;
        seenPaths.add(file);
        
        changes.push({
          filePath: file,
          changeType: 'added',
          isBinary: this.isBinaryFile(file),
          insertions: 0,
          deletions: 0,
        });
      }

      for (const file of status.deleted) {
        if (seenPaths.has(file)) continue;
        seenPaths.add(file);
        
        changes.push({
          filePath: file,
          changeType: 'deleted',
          isBinary: false,
          insertions: 0,
          deletions: 0,
        });
      }

      for (const file of status.renamed) {
        if (seenPaths.has(file.to)) continue;
        seenPaths.add(file.to);
        
        changes.push({
          filePath: file.to,
          oldFilePath: file.from,
          changeType: 'renamed',
          isBinary: this.isBinaryFile(file.to),
          insertions: 0,
          deletions: 0,
        });
      }
    } catch (error) {
      console.error('Error getting working dir changes:', error);
    }

    return changes;
  }

  private parseRenamedPath(path: string): { filePath: string; oldFilePath?: string } {
    if (path.includes('=>')) {
      const match = path.match(/^(.*?)\{(.+?)\s*=>\s*(.+?)\}(.*)$|^(.+?)\s*=>\s*(.+)$/);
      if (match) {
        if (match[1] && match[2] && match[3] && match[4]) {
          return {
            filePath: match[1] + match[3] + match[4],
            oldFilePath: match[1] + match[2] + match[4],
          };
        } else if (match[5] && match[6]) {
          return {
            filePath: match[6],
            oldFilePath: match[5],
          };
        }
      }
    }
    return { filePath: path };
  }

  private parseChangeType(filePath: string): GitChange['changeType'] {
    if (filePath.includes('=>')) {
      return 'renamed';
    }
    return 'modified';
  }

  private statusToChangeType(status: string): GitChange['changeType'] {
    const statusMap: Record<string, GitChange['changeType']> = {
      'A': 'added',
      'M': 'modified',
      'D': 'deleted',
      'R': 'renamed',
      'C': 'copied',
    };
    return statusMap[status] || 'modified';
  }

  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
      '.pdf', '.zip', '.tar', '.gz', '.rar',
      '.exe', '.dll', '.so', '.dylib',
      '.ogg', '.mp3', '.wav', '.mp4', '.avi', '.mov',
      '.ttf', '.otf', '.woff', '.woff2', '.eot',
    ];
    
    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return binaryExtensions.includes(ext);
  }

  private extractFileDiff(fullDiff: string, filePath: string, oldFilePath?: string): string | undefined {
    const lines = fullDiff.split('\n');
    let inFile = false;
    let fileDiff: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith(`diff --git `)) {
        if (inFile) break;
        
        const matches = line.match(/^diff --git ["']?a\/(.+?)["']?\s+["']?b\/(.+?)["']?$/);
        if (matches) {
          const [, fromPath, toPath] = matches;
          if (toPath === filePath || fromPath === filePath || fromPath === oldFilePath) {
            inFile = true;
            fileDiff = [line];
          }
        }
      } else if (inFile) {
        fileDiff.push(line);
      }
    }
    
    return fileDiff.length > 0 ? fileDiff.join('\n') : undefined;
  }
}
