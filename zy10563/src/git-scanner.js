const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitScanner {
  constructor(options = {}) {
    this.repoPath = options.repoPath || process.cwd();
    this.since = options.since || '';
    this.until = options.until || '';
    this.minSize = options.minSize || 1024 * 1024;
    this.errors = [];
  }

  validateRepo() {
    const gitDir = path.join(this.repoPath, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error(`不是有效的Git仓库: ${this.repoPath}`);
    }
    return true;
  }

  runGitCommand(command) {
    try {
      return execSync(command, {
        cwd: this.repoPath,
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024
      });
    } catch (error) {
      this.errors.push({
        type: 'git_command_error',
        command,
        message: error.message,
        stderr: error.stderr?.toString() || ''
      });
      throw error;
    }
  }

  getCommitRange() {
    let range = '';
    if (this.since && this.until) {
      range = `${this.since}..${this.until}`;
    } else if (this.since) {
      range = `${this.since}..HEAD`;
    } else if (this.until) {
      range = this.until;
    }
    return range;
  }

  scanHistory() {
    this.validateRepo();
    const range = this.getCommitRange();
    const files = new Map();
    const authors = new Map();
    const commits = [];

    const format = `"--pretty=format:%H|%an|%ae|%ad|%s"`;
    const command = `git log ${range} --numstat --date=iso ${format}`;
    
    const output = this.runGitCommand(command);
    const lines = output.split('\n');
    
    let currentCommit = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      if (line.includes('|') && !line.includes('\t')) {
        if (currentCommit) {
          commits.push(currentCommit);
        }
        
        const parts = line.split('|');
        if (parts.length >= 5) {
          currentCommit = {
            hash: parts[0],
            authorName: parts[1],
            authorEmail: parts[2],
            date: parts[3],
            message: parts.slice(4).join('|'),
            files: []
          };
        } else {
          this.errors.push({
            type: 'parse_error',
            line: i + 1,
            content: line,
            reason: '提交行格式不正确'
          });
          currentCommit = null;
        }
      } else if (currentCommit && line.includes('\t')) {
        const parts = line.split('\t');
        if (parts.length === 3) {
          const [added, deleted, filePath] = parts;
          
          const addedLines = parseInt(added, 10) || 0;
          const deletedLines = parseInt(deleted, 10) || 0;
          
          const fileEntry = {
            path: filePath,
            addedLines,
            deletedLines,
            commit: currentCommit.hash,
            author: currentCommit.authorEmail,
            date: currentCommit.date,
            estimatedSize: Math.max(addedLines, deletedLines) * 50
          };

          currentCommit.files.push(fileEntry);

          if (!files.has(filePath)) {
            files.set(filePath, {
              path: filePath,
              totalAdded: 0,
              totalDeleted: 0,
              commits: 0,
              authors: new Set(),
              firstSeen: currentCommit.date,
              lastSeen: currentCommit.date,
              maxEstimatedSize: 0,
              history: []
            });
          }

          const fileStats = files.get(filePath);
          fileStats.totalAdded += addedLines;
          fileStats.totalDeleted += deletedLines;
          fileStats.commits++;
          fileStats.authors.add(currentCommit.authorEmail);
          fileStats.lastSeen = currentCommit.date;
          fileStats.maxEstimatedSize = Math.max(fileStats.maxEstimatedSize, fileEntry.estimatedSize);
          fileStats.history.push({
            commit: currentCommit.hash,
            date: currentCommit.date,
            author: currentCommit.authorEmail,
            addedLines,
            deletedLines
          });

          if (!authors.has(currentCommit.authorEmail)) {
            authors.set(currentCommit.authorEmail, {
              name: currentCommit.authorName,
              email: currentCommit.authorEmail,
              commits: 0,
              filesModified: new Set(),
              totalAdded: 0,
              totalDeleted: 0
            });
          }

          const authorStats = authors.get(currentCommit.authorEmail);
          authorStats.commits++;
          authorStats.filesModified.add(filePath);
          authorStats.totalAdded += addedLines;
          authorStats.totalDeleted += deletedLines;
        } else {
          this.errors.push({
            type: 'parse_error',
            line: i + 1,
            content: line,
            reason: '文件统计行格式不正确',
            commit: currentCommit?.hash
          });
        }
      } else if (line && !currentCommit) {
        this.errors.push({
          type: 'orphan_line',
          line: i + 1,
          content: line,
          reason: '没有关联提交的孤立行'
        });
      }
    }

    if (currentCommit) {
      commits.push(currentCommit);
    }

    return {
      commits,
      files: Array.from(files.values())
        .map(f => ({
          ...f,
          authors: Array.from(f.authors),
          totalSize: f.maxEstimatedSize
        }))
        .sort((a, b) => b.totalSize - a.totalSize),
      authors: Array.from(authors.values())
        .map(a => ({
          ...a,
          filesModified: Array.from(a.filesModified)
        }))
        .sort((a, b) => b.commits - a.commits),
      errors: this.errors
    };
  }

  scanWithBlobSizes() {
    this.validateRepo();
    const files = new Map();
    
    const command = `git rev-list --objects --all`;
    const output = this.runGitCommand(command);
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(' ');
      if (parts.length >= 2) {
        const hash = parts[0];
        const filePath = parts.slice(1).join(' ');

        try {
          const sizeOutput = this.runGitCommand(`git cat-file -s ${hash}`);
          const size = parseInt(sizeOutput.trim(), 10);

          if (size >= this.minSize) {
            if (!files.has(filePath)) {
              files.set(filePath, {
                path: filePath,
                blobs: [],
                maxSize: 0,
                totalSize: 0
              });
            }

            const fileInfo = files.get(filePath);
            fileInfo.blobs.push({ hash, size });
            fileInfo.maxSize = Math.max(fileInfo.maxSize, size);
            fileInfo.totalSize += size;
          }
        } catch (error) {
          this.errors.push({
            type: 'blob_size_error',
            line: i + 1,
            hash,
            path: filePath,
            reason: error.message
          });
        }
      }
    }

    return {
      files: Array.from(files.values())
        .sort((a, b) => b.maxSize - a.maxSize),
      errors: this.errors
    };
  }

  getDetailedHistory() {
    const historyScan = this.scanHistory();
    const blobScan = this.scanWithBlobSizes();

    const fileMap = new Map();
    
    for (const file of historyScan.files) {
      fileMap.set(file.path, { ...file, blobInfo: null });
    }

    for (const blobFile of blobScan.files) {
      if (fileMap.has(blobFile.path)) {
        fileMap.get(blobFile.path).blobInfo = blobFile;
      } else {
        fileMap.set(blobFile.path, {
          path: blobFile.path,
          blobInfo: blobFile,
          totalAdded: 0,
          totalDeleted: 0,
          commits: 0,
          authors: [],
          history: []
        });
      }
    }

    return {
      summary: {
        totalCommits: historyScan.commits.length,
        totalFiles: fileMap.size,
        totalAuthors: historyScan.authors.length,
        scanDate: new Date().toISOString(),
        repoPath: this.repoPath
      },
      files: Array.from(fileMap.values())
        .sort((a, b) => (b.blobInfo?.maxSize || b.totalSize) - (a.blobInfo?.maxSize || a.totalSize)),
      authors: historyScan.authors,
      errors: [...historyScan.errors, ...blobScan.errors],
      rawCommits: historyScan.commits
    };
  }
}

module.exports = GitScanner;
