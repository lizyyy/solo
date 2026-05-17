const { execSync } = require('child_process');

class GitReader {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
  }

  isGitRepo() {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.repoPath,
        stdio: 'ignore'
      });
      return true;
    } catch {
      return false;
    }
  }

  getCommits(options = {}) {
    const {
      since = null,
      until = null,
      maxCount = null,
      author = null,
      branch = null
    } = options;

    let gitLogCmd = 'git log --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso';
    
    if (since) gitLogCmd += ` --since="${since}"`;
    if (until) gitLogCmd += ` --until="${until}"`;
    if (maxCount) gitLogCmd += ` -n ${maxCount}`;
    if (author) gitLogCmd += ` --author="${author}"`;
    if (branch) gitLogCmd += ` ${branch}`;
    
    gitLogCmd += ' --name-status';

    try {
      const output = execSync(gitLogCmd, {
        cwd: this.repoPath,
        encoding: 'utf8'
      });
      
      return this.parseGitLog(output);
    } catch (error) {
      throw new Error(`读取Git日志失败: ${error.message}`);
    }
  }

  parseGitLog(output) {
    const commits = [];
    const errors = [];
    const lines = output.split('\n');
    let currentCommit = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        if (currentCommit) {
          commits.push(currentCommit);
          currentCommit = null;
        }
        continue;
      }

      if (trimmedLine.includes('|') && !trimmedLine.match(/^[MADR]\t/)) {
        const parts = trimmedLine.split('|');
        
        if (parts.length >= 6) {
          currentCommit = {
            hash: parts[0],
            shortHash: parts[1],
            authorName: parts[2],
            authorEmail: parts[3],
            date: parts[4],
            subject: parts.slice(5).join('|'),
            files: [],
            rawLine: trimmedLine,
            lineNumber
          };
        } else {
          errors.push({
            type: 'malformed_commit_line',
            lineNumber,
            content: trimmedLine,
            reason: `提交行格式错误，预期至少6个字段，实际${parts.length}个`
          });
        }
      } else if (currentCommit && trimmedLine.match(/^[MADR]\t/)) {
        const fileMatch = trimmedLine.match(/^([MADR])\t(.+)$/);
        if (fileMatch) {
          currentCommit.files.push({
            status: fileMatch[1],
            path: fileMatch[2]
          });
        } else {
          errors.push({
            type: 'malformed_file_line',
            lineNumber,
            content: trimmedLine,
            commitHash: currentCommit.hash,
            reason: '文件状态行格式错误'
          });
        }
      } else if (currentCommit) {
        currentCommit.files.push({
          status: '?',
          path: trimmedLine,
          suspicious: true
        });
      }
    }

    if (currentCommit) {
      commits.push(currentCommit);
    }

    return { commits, errors };
  }

  getCommitByHash(hash) {
    try {
      const output = execSync(`git show --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso ${hash} --name-status`, {
        cwd: this.repoPath,
        encoding: 'utf8'
      });
      const result = this.parseGitLog(output);
      return result.commits[0] || null;
    } catch {
      return null;
    }
  }
}

module.exports = GitReader;// 测试修复
