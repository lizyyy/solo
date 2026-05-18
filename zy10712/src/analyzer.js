class ExportQueueAnalyzer {
  constructor(options = {}) {
    this.options = {
      largeFileThreshold: options.largeFileThreshold || 100 * 1024 * 1024,
      duplicateTimeWindow: options.duplicateTimeWindow || 5 * 60 * 1000,
      ...options
    };
  }

  analyze(records) {
    const validatedRecords = this.validateRecords(records);
    const sortedRecords = this.sortRecords(validatedRecords);
    
    return {
      summary: this.generateSummary(sortedRecords),
      largeFileTasks: this.analyzeLargeFileTasks(sortedRecords),
      duplicateTasks: this.detectDuplicateTasks(sortedRecords),
      queueDuration: this.calculateQueueDuration(sortedRecords),
      taskStatusBreakdown: this.getStatusBreakdown(sortedRecords),
      userRetryPatterns: this.analyzeUserRetryPatterns(sortedRecords),
      compressionFailures: this.analyzeCompressionFailures(sortedRecords),
      cancelledTasks: this.analyzeCancelledTasks(sortedRecords)
    };
  }

  validateRecords(records) {
    return records.filter(record => {
      const required = ['taskId', 'userId', 'fileName', 'fileSize', 'status', 'createdAt'];
      const hasRequired = required.every(field => record[field] !== undefined);
      if (!hasRequired) return false;
      
      if (typeof record.fileSize !== 'number' || record.fileSize < 0) return false;
      
      return true;
    });
  }

  sortRecords(records) {
    return [...records].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      
      if (timeA !== timeB) return timeA - timeB;
      
      if (a.userId !== b.userId) {
        return (a.userId || '').localeCompare(b.userId || '');
      }
      
      return (a.taskId || '').localeCompare(b.taskId || '');
    });
  }

  generateSummary(records) {
    const largeFileCount = records.filter(r => r.fileSize >= this.options.largeFileThreshold).length;
    const successCount = records.filter(r => r.status === 'success').length;
    const failedCount = records.filter(r => r.status === 'failed').length;
    const cancelledCount = records.filter(r => r.status === 'cancelled').length;
    const queuedCount = records.filter(r => r.status === 'queued').length;
    const processingCount = records.filter(r => r.status === 'processing').length;

    return {
      totalTasks: records.length,
      largeFileTasks: largeFileCount,
      largeFileRatio: records.length > 0 ? (largeFileCount / records.length).toFixed(4) : '0.0000',
      successCount,
      failedCount,
      cancelledCount,
      queuedCount,
      processingCount,
      analysisTime: new Date().toISOString(),
      largeFileThreshold: this.options.largeFileThreshold
    };
  }

  analyzeLargeFileTasks(records) {
    const largeFiles = records.filter(r => r.fileSize >= this.options.largeFileThreshold);
    
    return largeFiles.map(record => {
      const queueStart = new Date(record.createdAt).getTime();
      const processStart = record.startedAt ? new Date(record.startedAt).getTime() : null;
      const completedAt = record.completedAt ? new Date(record.completedAt).getTime() : null;
      
      const waitTime = processStart ? processStart - queueStart : null;
      const processTime = processStart && completedAt ? completedAt - processStart : null;
      const totalTime = completedAt ? completedAt - queueStart : null;

      return {
        taskId: record.taskId,
        userId: record.userId,
        userName: record.userName || '未知用户',
        fileName: record.fileName,
        fileSize: record.fileSize,
        fileSizeFormatted: this.formatFileSize(record.fileSize),
        exportType: record.exportType || '未知类型',
        status: record.status,
        statusReason: record.statusReason || '',
        createdAt: record.createdAt,
        startedAt: record.startedAt || null,
        completedAt: record.completedAt || null,
        waitTimeMs: waitTime,
        waitTimeFormatted: waitTime !== null ? this.formatDuration(waitTime) : null,
        processTimeMs: processTime,
        processTimeFormatted: processTime !== null ? this.formatDuration(processTime) : null,
        totalTimeMs: totalTime,
        totalTimeFormatted: totalTime !== null ? this.formatDuration(totalTime) : null,
        retryCount: record.retryCount || 0,
        isCompression: record.isCompression || false
      };
    }).sort((a, b) => {
      if (b.fileSize !== a.fileSize) return b.fileSize - a.fileSize;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  detectDuplicateTasks(records) {
    const duplicates = [];
    const userTaskGroups = new Map();

    records.forEach(record => {
      const key = `${record.userId}-${record.fileName}-${record.exportType || 'default'}`;
      if (!userTaskGroups.has(key)) {
        userTaskGroups.set(key, []);
      }
      userTaskGroups.get(key).push(record);
    });

    userTaskGroups.forEach((group, key) => {
      if (group.length > 1) {
        group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const timeDiff = new Date(group[j].createdAt).getTime() - new Date(group[i].createdAt).getTime();
            if (timeDiff <= this.options.duplicateTimeWindow) {
              duplicates.push({
                groupKey: key,
                userId: group[i].userId,
                userName: group[i].userName || '未知用户',
                fileName: group[i].fileName,
                exportType: group[i].exportType || '未知类型',
                originalTask: {
                  taskId: group[i].taskId,
                  createdAt: group[i].createdAt,
                  status: group[i].status
                },
                duplicateTask: {
                  taskId: group[j].taskId,
                  createdAt: group[j].createdAt,
                  status: group[j].status
                },
                timeDiffMs: timeDiff,
                timeDiffFormatted: this.formatDuration(timeDiff),
                isUserDoubleClick: timeDiff < 3000,
                statusRelation: this.getStatusRelation(group[i], group[j])
              });
            }
          }
        }
      }
    });

    return duplicates.sort((a, b) => {
      if (a.isUserDoubleClick !== b.isUserDoubleClick) {
        return a.isUserDoubleClick ? -1 : 1;
      }
      return a.timeDiffMs - b.timeDiffMs;
    });
  }

  getStatusRelation(task1, task2) {
    if (task1.status === 'cancelled' && task2.status !== 'cancelled') {
      return '用户取消后重试';
    }
    if (task1.status === 'failed' && task2.status !== 'failed') {
      return '失败后重试';
    }
    if (task1.status === 'queued' && task2.status === 'queued') {
      return '同时排队';
    }
    if (task1.status === 'processing' && task2.status === 'processing') {
      return '同时处理';
    }
    return '状态未知';
  }

  calculateQueueDuration(records) {
    const queuedRecords = records.filter(r => r.startedAt && r.createdAt);
    
    const waitTimes = queuedRecords.map(r => {
      const wait = new Date(r.startedAt).getTime() - new Date(r.createdAt).getTime();
      return {
        taskId: r.taskId,
        fileName: r.fileName,
        waitTimeMs: wait,
        isLargeFile: r.fileSize >= this.options.largeFileThreshold
      };
    }).filter(w => w.waitTimeMs >= 0);

    const largeFileWaits = waitTimes.filter(w => w.isLargeFile);
    const normalFileWaits = waitTimes.filter(w => !w.isLargeFile);

    return {
      allTasks: this.calculateStats(waitTimes.map(w => w.waitTimeMs)),
      largeFileTasks: this.calculateStats(largeFileWaits.map(w => w.waitTimeMs)),
      normalFileTasks: this.calculateStats(normalFileWaits.map(w => w.waitTimeMs)),
      longestWaits: waitTimes
        .sort((a, b) => b.waitTimeMs - a.waitTimeMs)
        .slice(0, 10)
        .map(w => ({
          ...w,
          waitTimeFormatted: this.formatDuration(w.waitTimeMs)
        }))
    };
  }

  calculateStats(numbers) {
    if (numbers.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p95: 0
      };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      minFormatted: this.formatDuration(sorted[0]),
      max: sorted[sorted.length - 1],
      maxFormatted: this.formatDuration(sorted[sorted.length - 1]),
      avg: Math.round(sum / sorted.length),
      avgFormatted: this.formatDuration(Math.round(sum / sorted.length)),
      median: sorted[Math.floor(sorted.length / 2)],
      medianFormatted: this.formatDuration(sorted[Math.floor(sorted.length / 2)]),
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p95Formatted: this.formatDuration(sorted[Math.floor(sorted.length * 0.95)])
    };
  }

  getStatusBreakdown(records) {
    const breakdown = {};
    
    records.forEach(record => {
      const status = record.status || 'unknown';
      if (!breakdown[status]) {
        breakdown[status] = {
          count: 0,
          largeFileCount: 0,
          totalFileSize: 0,
          examples: []
        };
      }
      breakdown[status].count++;
      if (record.fileSize >= this.options.largeFileThreshold) {
        breakdown[status].largeFileCount++;
      }
      breakdown[status].totalFileSize += record.fileSize;
      if (breakdown[status].examples.length < 5) {
        breakdown[status].examples.push({
          taskId: record.taskId,
          fileName: record.fileName,
          fileSizeFormatted: this.formatFileSize(record.fileSize),
          userId: record.userId
        });
      }
    });

    Object.keys(breakdown).forEach(status => {
      const b = breakdown[status];
      b.avgFileSize = b.count > 0 ? Math.round(b.totalFileSize / b.count) : 0;
      b.avgFileSizeFormatted = this.formatFileSize(b.avgFileSize);
      delete b.totalFileSize;
    });

    return breakdown;
  }

  analyzeUserRetryPatterns(records) {
    const userRetries = new Map();
    
    records.forEach(record => {
      if (!userRetries.has(record.userId)) {
        userRetries.set(record.userId, {
          userId: record.userId,
          userName: record.userName || '未知用户',
          totalTasks: 0,
          retryTasks: 0,
          cancelledTasks: 0,
          taskTimes: []
        });
      }
      
      const userData = userRetries.get(record.userId);
      userData.totalTasks++;
      if (record.retryCount > 0) {
        userData.retryTasks++;
      }
      if (record.status === 'cancelled') {
        userData.cancelledTasks++;
      }
      userData.taskTimes.push(new Date(record.createdAt).getTime());
    });

    const result = [];
    userRetries.forEach((data, userId) => {
      data.taskTimes.sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < data.taskTimes.length; i++) {
        intervals.push(data.taskTimes[i] - data.taskTimes[i - 1]);
      }
      
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        data.avgIntervalMs = Math.round(avgInterval);
        data.avgIntervalFormatted = this.formatDuration(Math.round(avgInterval));
        data.minIntervalMs = Math.min(...intervals);
        data.minIntervalFormatted = this.formatDuration(Math.min(...intervals));
      }
      
      data.hasRapidRetries = intervals.some(i => i < 3000);
      data.rapidRetryCount = intervals.filter(i => i < 3000).length;
      
      delete data.taskTimes;
      if (data.totalTasks >= 2) {
        result.push(data);
      }
    });

    return result.sort((a, b) => {
      if (b.hasRapidRetries !== a.hasRapidRetries) {
        return b.hasRapidRetries ? -1 : 1;
      }
      return b.totalTasks - a.totalTasks;
    });
  }

  analyzeCompressionFailures(records) {
    const failures = records.filter(r => 
      r.isCompression === true && r.status === 'failed'
    );

    return failures.map(record => ({
      taskId: record.taskId,
      userId: record.userId,
      userName: record.userName || '未知用户',
      fileName: record.fileName,
      fileSize: record.fileSize,
      fileSizeFormatted: this.formatFileSize(record.fileSize),
      status: record.status,
      isCompression: record.isCompression,
      errorMessage: record.errorMessage || '未知错误',
      createdAt: record.createdAt,
      failedAt: record.completedAt || record.failedAt || null,
      retryCount: record.retryCount || 0
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  analyzeCancelledTasks(records) {
    const cancelled = records.filter(r => r.status === 'cancelled');
    
    return cancelled.map(record => {
      const queueStart = new Date(record.createdAt).getTime();
      const cancelledAt = record.cancelledAt ? new Date(record.cancelledAt).getTime() : null;
      const timeInQueue = cancelledAt ? cancelledAt - queueStart : null;

      return {
        taskId: record.taskId,
        userId: record.userId,
        userName: record.userName || '未知用户',
        fileName: record.fileName,
        fileSize: record.fileSize,
        fileSizeFormatted: this.formatFileSize(record.fileSize),
        status: record.status,
        createdAt: record.createdAt,
        cancelledAt: record.cancelledAt || null,
        timeInQueueMs: timeInQueue,
        timeInQueueFormatted: timeInQueue !== null ? this.formatDuration(timeInQueue) : null,
        cancelledBy: record.cancelledBy || 'system',
        reason: record.cancelReason || record.statusReason || '未说明原因'
      };
    }).sort((a, b) => {
      if (a.timeInQueueMs !== null && b.timeInQueueMs !== null) {
        return b.timeInQueueMs - a.timeInQueueMs;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}毫秒`;
    if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)}秒`;
    if (ms < 60 * 60 * 1000) return `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`;
    return `${Math.floor(ms / 3600000)}时${Math.floor((ms % 3600000) / 60000)}分`;
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }

  formatOutput(result, format = 'text') {
    if (format === 'json') {
      return JSON.stringify(result, null, 2);
    }

    return this.formatTextOutput(result);
  }

  formatTextOutput(result) {
    const lines = [];
    
    lines.push('='.repeat(80));
    lines.push('           导出任务记录大文件排队分析报告');
    lines.push('='.repeat(80));
    lines.push('');
    
    lines.push('【概览统计】');
    lines.push('-'.repeat(60));
    const s = result.summary;
    lines.push(`  总任务数: ${s.totalTasks}`);
    lines.push(`  大文件任务: ${s.largeFileTasks} (${(s.largeFileRatio * 100).toFixed(2)}%)`);
    lines.push(`  大文件阈值: ${this.formatFileSize(s.largeFileThreshold)}`);
    lines.push('');
    lines.push(`  成功: ${s.successCount} | 失败: ${s.failedCount} | 已取消: ${s.cancelledCount}`);
    lines.push(`  排队中: ${s.queuedCount} | 处理中: ${s.processingCount}`);
    lines.push(`  分析时间: ${s.analysisTime}`);
    lines.push('');

    lines.push('【排队时长统计】');
    lines.push('-'.repeat(60));
    const q = result.queueDuration;
    lines.push(`  所有任务 (${q.allTasks.count}个):`);
    lines.push(`    平均: ${q.allTasks.avgFormatted} | 中位数: ${q.allTasks.medianFormatted} | P95: ${q.allTasks.p95Formatted}`);
    lines.push(`  大文件任务 (${q.largeFileTasks.count}个):`);
    lines.push(`    平均: ${q.largeFileTasks.avgFormatted} | 中位数: ${q.largeFileTasks.medianFormatted} | P95: ${q.largeFileTasks.p95Formatted}`);
    lines.push('');
    
    if (q.longestWaits.length > 0) {
      lines.push('  最长等待TOP 5:');
      q.longestWaits.slice(0, 5).forEach((w, i) => {
        lines.push(`    ${i + 1}. [${w.waitTimeFormatted}] ${w.fileName} (${w.taskId})`);
      });
      lines.push('');
    }

    lines.push('【大文件任务详情】');
    lines.push('-'.repeat(60));
    if (result.largeFileTasks.length > 0) {
      result.largeFileTasks.slice(0, 10).forEach((task, i) => {
        lines.push(`  ${i + 1}. ${task.fileName}`);
        lines.push(`     文件大小: ${task.fileSizeFormatted} | 类型: ${task.exportType}`);
        lines.push(`     用户: ${task.userName} (${task.userId})`);
        lines.push(`     状态: ${task.status}${task.statusReason ? ` - ${task.statusReason}` : ''}`);
        if (task.waitTimeFormatted) lines.push(`     等待时长: ${task.waitTimeFormatted}`);
        if (task.processTimeFormatted) lines.push(`     处理时长: ${task.processTimeFormatted}`);
        if (task.retryCount > 0) lines.push(`     重试次数: ${task.retryCount}`);
        lines.push('');
      });
      if (result.largeFileTasks.length > 10) {
        lines.push(`  ... 还有 ${result.largeFileTasks.length - 10} 个大文件任务`);
        lines.push('');
      }
    } else {
      lines.push('  暂无大文件任务');
      lines.push('');
    }

    lines.push('【重复任务检测】');
    lines.push('-'.repeat(60));
    if (result.duplicateTasks.length > 0) {
      lines.push(`  发现 ${result.duplicateTasks.length} 组重复任务:`);
      lines.push('');
      result.duplicateTasks.slice(0, 8).forEach((dup, i) => {
        lines.push(`  ${i + 1}. ${dup.fileName} (${dup.exportType})`);
        lines.push(`     用户: ${dup.userName} (${dup.userId})`);
        lines.push(`     时间间隔: ${dup.timeDiffFormatted}`);
        lines.push(`     连点特征: ${dup.isUserDoubleClick ? '是 (疑似快速点击)' : '否'}`);
        lines.push(`     状态关系: ${dup.statusRelation}`);
        lines.push(`     原始任务: ${dup.originalTask.taskId} [${dup.originalTask.status}] @ ${dup.originalTask.createdAt}`);
        lines.push(`     重复任务: ${dup.duplicateTask.taskId} [${dup.duplicateTask.status}] @ ${dup.duplicateTask.createdAt}`);
        lines.push('');
      });
      if (result.duplicateTasks.length > 8) {
        lines.push(`  ... 还有 ${result.duplicateTasks.length - 8} 组重复任务`);
        lines.push('');
      }
    } else {
      lines.push('  未检测到重复任务');
      lines.push('');
    }

    lines.push('【用户重试模式分析】');
    lines.push('-'.repeat(60));
    if (result.userRetryPatterns.length > 0) {
      result.userRetryPatterns.slice(0, 5).forEach(user => {
        lines.push(`  用户: ${user.userName} (${user.userId})`);
        lines.push(`    总任务: ${user.totalTasks} | 重试: ${user.retryTasks} | 取消: ${user.cancelledTasks}`);
        if (user.avgIntervalFormatted) {
          lines.push(`    平均间隔: ${user.avgIntervalFormatted} | 最小间隔: ${user.minIntervalFormatted}`);
        }
        lines.push(`    快速重试: ${user.hasRapidRetries ? '是' : '否'} (${user.rapidRetryCount}次)`);
        lines.push('');
      });
    } else {
      lines.push('  暂无可分析的用户重试模式');
      lines.push('');
    }

    lines.push('【压缩失败分析】');
    lines.push('-'.repeat(60));
    if (result.compressionFailures.length > 0) {
      lines.push(`  发现 ${result.compressionFailures.length} 个压缩失败任务:`);
      lines.push('');
      result.compressionFailures.slice(0, 5).forEach((fail, i) => {
        lines.push(`  ${i + 1}. ${fail.fileName}`);
        lines.push(`     文件大小: ${fail.fileSizeFormatted}`);
        lines.push(`     用户: ${fail.userName} (${fail.userId})`);
        lines.push(`     错误信息: ${fail.errorMessage}`);
        if (fail.retryCount > 0) lines.push(`     重试次数: ${fail.retryCount}`);
        lines.push('');
      });
    } else {
      lines.push('  暂无压缩失败任务');
      lines.push('');
    }

    lines.push('【取消任务分析】');
    lines.push('-'.repeat(60));
    if (result.cancelledTasks.length > 0) {
      lines.push(`  发现 ${result.cancelledTasks.length} 个已取消任务:`);
      lines.push('');
      result.cancelledTasks.slice(0, 5).forEach((task, i) => {
        lines.push(`  ${i + 1}. ${task.fileName}`);
        lines.push(`     文件大小: ${task.fileSizeFormatted}`);
        lines.push(`     用户: ${task.userName} (${task.userId})`);
        lines.push(`     排队时长: ${task.timeInQueueFormatted || '未知'}`);
        lines.push(`     取消方: ${task.cancelledBy} | 原因: ${task.reason}`);
        lines.push('');
      });
    } else {
      lines.push('  暂无已取消任务');
      lines.push('');
    }

    lines.push('='.repeat(80));
    lines.push('                      分析报告结束');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}

module.exports = ExportQueueAnalyzer;
