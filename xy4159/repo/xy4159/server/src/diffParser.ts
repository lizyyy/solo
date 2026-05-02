import { DiffFile, DiffHunk, DiffLine } from '../../src/types';

export class DiffParser {
  parse(diffContent: string): DiffFile[] {
    const files: DiffFile[] = [];
    const lines = diffContent.split('\n');
    
    let currentFile: DiffFile | null = null;
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          if (currentHunk) {
            currentFile.hunks.push(currentHunk);
          }
          files.push(currentFile);
        }
        
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (match) {
          currentFile = {
            filePath: match[2],
            oldFilePath: match[1] !== match[2] ? match[1] : undefined,
            isNew: false,
            isDeleted: false,
            isRename: match[1] !== match[2],
            hunks: []
          };
        }
        currentHunk = null;
        continue;
      }

      if (!currentFile) continue;

      if (line.startsWith('new file mode')) {
        currentFile.isNew = true;
        continue;
      }

      if (line.startsWith('deleted file mode')) {
        currentFile.isDeleted = true;
        continue;
      }

      if (line.startsWith('--- ')) {
        if (line === '--- /dev/null') {
          currentFile.isNew = true;
        }
        continue;
      }

      if (line.startsWith('+++ ')) {
        if (line === '+++ /dev/null') {
          currentFile.isDeleted = true;
        }
        continue;
      }

      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
      if (hunkMatch) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }
        
        oldLineNum = parseInt(hunkMatch[1]);
        const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
        newLineNum = parseInt(hunkMatch[3]);
        const newLines = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;
        const header = hunkMatch[5] || '';

        currentHunk = {
          oldStart: oldLineNum,
          oldLines,
          newStart: newLineNum,
          newLines,
          header,
          lines: []
        };
        continue;
      }

      if (currentHunk) {
        if (line.startsWith('+')) {
          currentHunk.lines.push({
            type: 'add',
            content: line.substring(1),
            lineNumber: newLineNum++
          });
        } else if (line.startsWith('-')) {
          currentHunk.lines.push({
            type: 'remove',
            content: line.substring(1),
            lineNumber: oldLineNum++
          });
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({
            type: 'context',
            content: line.substring(1),
            lineNumber: newLineNum
          });
          oldLineNum++;
          newLineNum++;
        } else if (line === '\\ No newline at end of file') {
          continue;
        }
      }
    }

    if (currentFile) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }
      files.push(currentFile);
    }

    return files;
  }

  getAddedLines(files: DiffFile[]): Array<{ filePath: string; lineNumber: number; content: string }> {
    const result: Array<{ filePath: string; lineNumber: number; content: string }> = [];
    
    for (const file of files) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') {
            result.push({
              filePath: file.filePath,
              lineNumber: line.lineNumber,
              content: line.content
            });
          }
        }
      }
    }
    
    return result;
  }

  getChangedFiles(files: DiffFile[]): string[] {
    return files.map(f => f.filePath);
  }
}

export const diffParser = new DiffParser();
