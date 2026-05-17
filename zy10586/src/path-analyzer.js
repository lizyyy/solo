class PathAnalyzer {
  constructor() {
    this.errors = [];
  }

  analyzeFiles(files) {
    if (!Array.isArray(files)) {
      this.errors.push({
        type: 'invalid_files_input',
        reason: 'files参数不是数组'
      });
      return {
        byDirectory: {},
        byExtension: {},
        byStatus: {},
        summary: {
          total: 0,
          modified: 0,
          added: 0,
          deleted: 0,
          renamed: 0
        }
      };
    }

    const byDirectory = {};
    const byExtension = {};
    const byStatus = { M: [], A: [], D: [], R: [], '?': [] };

    let total = 0, modified = 0, added = 0, deleted = 0, renamed = 0;

    for (const file of files) {
      if (!file || !file.path) {
        this.errors.push({
          type: 'invalid_file_entry',
          file: file,
          reason: '文件对象为空或缺少path字段'
        });
        continue;
      }

      total++;
      const path = file.path;
      const status = file.status || '?';

      if (status === 'M') modified++;
      else if (status === 'A') added++;
      else if (status === 'D') deleted++;
      else if (status === 'R') renamed++;

      if (byStatus[status]) {
        byStatus[status].push(path);
      }

      const dirs = path.split('/');
      if (dirs.length > 1) {
        const topDir = dirs[0];
        if (!byDirectory[topDir]) {
          byDirectory[topDir] = { count: 0, files: [] };
        }
        byDirectory[topDir].count++;
        byDirectory[topDir].files.push(path);
      } else {
        if (!byDirectory['.']) {
          byDirectory['.'] = { count: 0, files: [] };
        }
        byDirectory['.'].count++;
        byDirectory['.'].files.push(path);
      }

      const lastDot = path.lastIndexOf('.');
      if (lastDot > 0 && lastDot < path.length - 1) {
        const ext = path.substring(lastDot).toLowerCase();
        if (!byExtension[ext]) {
          byExtension[ext] = { count: 0, files: [] };
        }
        byExtension[ext].count++;
        byExtension[ext].files.push(path);
      } else {
        if (!byExtension['no-ext']) {
          byExtension['no-ext'] = { count: 0, files: [] };
        }
        byExtension['no-ext'].count++;
        byExtension['no-ext'].files.push(path);
      }
    }

    return {
      byDirectory,
      byExtension,
      byStatus,
      summary: {
        total,
        modified,
        added,
        deleted,
        renamed
      }
    };
  }

  analyzeCommitsByPath(commits) {
    const pathCommitMap = {};
    const topPathChanges = [];

    for (const commit of commits) {
      if (!commit.files) continue;

      for (const file of commit.files) {
        if (!file.path) continue;

        if (!pathCommitMap[file.path]) {
          pathCommitMap[file.path] = {
            path: file.path,
            commitCount: 0,
            commits: [],
            statuses: {}
          };
        }

        pathCommitMap[file.path].commitCount++;
        pathCommitMap[file.path].commits.push({
          hash: commit.shortHash,
          subject: commit.subject,
          author: commit.authorName,
          date: commit.date
        });

        const status = file.status || '?';
        pathCommitMap[file.path].statuses[status] = (pathCommitMap[file.path].statuses[status] || 0) + 1;
      }
    }

    for (const path in pathCommitMap) {
      topPathChanges.push(pathCommitMap[path]);
    }

    topPathChanges.sort((a, b) => b.commitCount - a.commitCount);

    return {
      pathCommitMap,
      topPathChanges: topPathChanges.slice(0, 20)
    };
  }

  getModuleChanges(commits, moduleRules = []) {
    const defaultRules = [
      { name: '前端', patterns: [/^src\//, /^client\//, /^web\//, /\.vue$/, /\.jsx$/, /\.tsx$/] },
      { name: '后端', patterns: [/^server\//, /^api\//, /^backend\//, /\.py$/, /\.java$/] },
      { name: '配置', patterns: [/\.json$/, /\.yaml$/, /\.yml$/, /\.env/, /\.config\./] },
      { name: '文档', patterns: [/\.md$/, /\.txt$/, /^docs?\//] },
      { name: '测试', patterns: [/\.test\./, /\.spec\./, /^tests?\//] }
    ];

    const rules = moduleRules.length > 0 ? moduleRules : defaultRules;
    const moduleStats = {};

    for (const rule of rules) {
      moduleStats[rule.name] = {
        name: rule.name,
        commitCount: 0,
        fileCount: 0,
        commits: []
      };
    }

    for (const commit of commits) {
      if (!commit.files) continue;

      const matchedModules = new Set();

      for (const file of commit.files) {
        if (!file.path) continue;

        for (const rule of rules) {
          for (const pattern of rule.patterns) {
            if (pattern.test(file.path)) {
              matchedModules.add(rule.name);
              moduleStats[rule.name].fileCount++;
            }
          }
        }
      }

      for (const moduleName of matchedModules) {
        moduleStats[moduleName].commitCount++;
        moduleStats[moduleName].commits.push({
          hash: commit.shortHash,
          subject: commit.subject,
          author: commit.authorName
        });
      }
    }

    return Object.values(moduleStats).filter(m => m.commitCount > 0);
  }

  getErrors() {
    return this.errors;
  }
}

module.exports = PathAnalyzer;