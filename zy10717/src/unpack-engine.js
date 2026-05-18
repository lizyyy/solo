const fs = require('fs');
const path = require('path');

class UnpackEngine {
  constructor(options = {}) {
    this.options = options;
    this.stats = {
      totalTasks: 0,
      reworkTasks: 0,
      duplicateRemoved: 0,
      leftAnnotatorRemoved: 0,
      overlapMerged: 0,
      inspectionFailed: 0
    };
    this.seenTaskIds = new Set();
    this.packageMap = new Map();
    this.activeAnnotators = new Set();
  }

  process(filePaths, inputDir) {
    if (this.options.annotatorFile) {
      this.loadActiveAnnotators(this.options.annotatorFile);
    }

    const allTasks = [];
    const allPackages = [];

    filePaths.forEach(filePath => {
      const data = this.parseFile(filePath);
      const tasks = this.extractTasks(data, filePath);
      allTasks.push(...tasks);
      
      const pkg = this.extractPackageInfo(data, filePath);
      if (pkg) {
        allPackages.push(pkg);
      }
    });

    this.stats.totalTasks = allTasks.length;

    const reworkTasks = this.filterReworkTasks(allTasks);
    const dedupedTasks = this.options.dedup ? this.deduplicateTasks(reworkTasks) : reworkTasks;
    const filteredTasks = this.filterLeftAnnotators(dedupedTasks);
    const mergedTasks = this.mergeOverlappingPackages(filteredTasks);
    const finalTasks = this.markInspectionFailures(mergedTasks);

    const packages = this.groupByPackage(finalTasks);
    const reviewerReport = this.generateReviewerReport(finalTasks);
    const auditLog = this.generateAuditLog(allTasks, finalTasks);

    return {
      tasks: finalTasks,
      packages,
      reviewerReport,
      auditLog,
      stats: { ...this.stats },
      metadata: {
        processedAt: new Date().toISOString(),
        inputFiles: filePaths,
        options: this.options
      }
    };
  }

  parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    } else if (filePath.endsWith('.csv')) {
      return this.parseCsv(content);
    }
    throw new Error(`不支持的文件格式: ${filePath}`);
  }

  parseCsv(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return { tasks: [] };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const tasks = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const task = {};
      headers.forEach((h, idx) => {
        task[h] = values[idx] || '';
      });
      tasks.push(task);
    }
    
    return { tasks };
  }

  extractTasks(data, filePath) {
    const fileName = path.basename(filePath);
    
    if (Array.isArray(data)) {
      return data.map((t, i) => this.normalizeTask(t, fileName, i));
    }
    
    if (data.tasks && Array.isArray(data.tasks)) {
      return data.tasks.map((t, i) => this.normalizeTask(t, fileName, i));
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((t, i) => this.normalizeTask(t, fileName, i));
    }

    return [this.normalizeTask(data, fileName, 0)];
  }

  normalizeTask(task, sourceFile, index) {
    return {
      taskId: task.taskId || task.id || task.task_id || `${sourceFile}-${index}`,
      packageId: task.packageId || task.package_id || task.batchId || task.batch || 'unknown',
      annotator: task.annotator || task.annotatorName || task.worker || task.user || 'unknown',
      status: task.status || task.taskStatus || 'unknown',
      quality: task.quality || task.qualityLevel || task.score || null,
      needRework: task.needRework === true || task.rework === true || 
                   task.status === 'NEED_REWORK' || task.status === 'rejected',
      inspectionFailed: task.inspectionFailed === true || task.failed === true,
      sourceFile,
      sourceIndex: index,
      originalData: { ...task }
    };
  }

  extractPackageInfo(data, filePath) {
    if (data.packageId || data.batchId) {
      return {
        packageId: data.packageId || data.batchId,
        sourceFile: path.basename(filePath),
        totalTasks: data.totalCount || data.taskCount || null
      };
    }
    return null;
  }

  loadActiveAnnotators(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const annotators = data.activeAnnotators || data.annotators || data;
    
    if (Array.isArray(annotators)) {
      annotators.forEach(a => {
        const name = typeof a === 'string' ? a : (a.name || a.id);
        if (name) this.activeAnnotators.add(name);
      });
    }
  }

  filterReworkTasks(tasks) {
    const reworkTasks = tasks.filter(t => t.needRework);
    this.stats.reworkTasks = reworkTasks.length;
    return reworkTasks;
  }

  deduplicateTasks(tasks) {
    const result = [];
    tasks.forEach(task => {
      if (this.seenTaskIds.has(task.taskId)) {
        this.stats.duplicateRemoved++;
      } else {
        this.seenTaskIds.add(task.taskId);
        result.push(task);
      }
    });
    return result;
  }

  filterLeftAnnotators(tasks) {
    if (this.activeAnnotators.size === 0) return tasks;
    
    return tasks.filter(task => {
      const isActive = this.activeAnnotators.has(task.annotator);
      if (!isActive) {
        this.stats.leftAnnotatorRemoved++;
      }
      return isActive;
    });
  }

  mergeOverlappingPackages(tasks) {
    const packageTasks = new Map();
    
    tasks.forEach(task => {
      if (!packageTasks.has(task.packageId)) {
        packageTasks.set(task.packageId, []);
      }
      packageTasks.get(task.packageId).push(task);
    });

    const result = [];
    packageTasks.forEach((pkgTasks, packageId) => {
      const sourceFiles = new Set(pkgTasks.map(t => t.sourceFile));
      if (sourceFiles.size > 1) {
        this.stats.overlapMerged++;
        pkgTasks.forEach(t => {
          t.mergedFromSources = Array.from(sourceFiles);
          t.packageOverlap = true;
        });
      }
      result.push(...pkgTasks);
    });

    return result;
  }

  markInspectionFailures(tasks) {
    return tasks.map(task => {
      if (task.inspectionFailed) {
        this.stats.inspectionFailed++;
      }
      return task;
    });
  }

  groupByPackage(tasks) {
    const packages = new Map();
    
    tasks.forEach(task => {
      if (!packages.has(task.packageId)) {
        packages.set(task.packageId, {
          packageId: task.packageId,
          tasks: [],
          annotators: new Set(),
          taskCount: 0,
          reworkCount: 0,
          inspectionFailCount: 0
        });
      }
      
      const pkg = packages.get(task.packageId);
      pkg.tasks.push(task);
      pkg.annotators.add(task.annotator);
      pkg.taskCount++;
      pkg.reworkCount++;
      if (task.inspectionFailed) pkg.inspectionFailCount++;
    });

    return Array.from(packages.values()).map(pkg => ({
      ...pkg,
      annotators: Array.from(pkg.annotators)
    }));
  }

  generateReviewerReport(tasks) {
    const byAnnotator = new Map();
    
    tasks.forEach(task => {
      if (!byAnnotator.has(task.annotator)) {
        byAnnotator.set(task.annotator, {
          annotator: task.annotator,
          tasks: [],
          totalRework: 0,
          inspectionFails: 0,
          packages: new Set()
        });
      }
      
      const record = byAnnotator.get(task.annotator);
      record.tasks.push(task);
      record.totalRework++;
      record.packages.add(task.packageId);
      if (task.inspectionFailed) record.inspectionFails++;
    });

    return Array.from(byAnnotator.values()).map(record => ({
      ...record,
      packages: Array.from(record.packages),
      riskLevel: this.calculateRiskLevel(record)
    }));
  }

  calculateRiskLevel(record) {
    if (record.inspectionFails > 0) return 'HIGH';
    if (record.totalRework > 5) return 'MEDIUM';
    return 'LOW';
  }

  generateAuditLog(allTasks, finalTasks) {
    const log = [];
    
    allTasks.forEach(task => {
      const inFinal = finalTasks.find(t => t.taskId === task.taskId);
      
      if (!inFinal) {
        let reason = 'unknown';
        if (!task.needRework) reason = 'not_rework';
        else if (this.seenTaskIds.has(task.taskId) && !inFinal) reason = 'duplicate';
        else if (this.activeAnnotators.size > 0 && !this.activeAnnotators.has(task.annotator)) {
          reason = 'annotator_left';
        }
        
        log.push({
          taskId: task.taskId,
          action: 'EXCLUDED',
          reason,
          annotator: task.annotator,
          packageId: task.packageId,
          sourceFile: task.sourceFile
        });
      } else if (inFinal.packageOverlap) {
        log.push({
          taskId: task.taskId,
          action: 'MERGED',
          reason: 'package_overlap',
          annotator: task.annotator,
          packageId: task.packageId,
          mergedFromSources: inFinal.mergedFromSources
        });
      }
    });

    return log;
  }

  validateFile(filePath) {
    const issues = [];
    
    try {
      const data = this.parseFile(filePath);
      const tasks = this.extractTasks(data, filePath);
      
      if (tasks.length === 0) {
        issues.push({ level: 'warning', message: '文件中没有任务数据' });
      }
      
      tasks.forEach((task, idx) => {
        if (!task.taskId || task.taskId === 'unknown') {
          issues.push({ level: 'warning', message: `任务 ${idx}: 缺少 taskId` });
        }
        if (!task.annotator || task.annotator === 'unknown') {
          issues.push({ level: 'warning', message: `任务 ${idx}: 缺少标注员信息` });
        }
      });
      
    } catch (error) {
      issues.push({ level: 'error', message: `解析失败: ${error.message}` });
    }
    
    return issues;
  }
}

module.exports = { UnpackEngine };
