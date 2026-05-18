const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};

export function summarizeTasks(validatedData, originalTasks) {
  const retryTasks = [];
  const skippedTasks = [];
  const taskMap = new Map(originalTasks.map(t => [t.taskId, t]));
  
  for (const result of validatedData.validationResults) {
    const originalTask = taskMap.get(result.taskId);
    
    if (result.canRetry) {
      retryTasks.push({
        ...originalTask,
        ...result,
        sortScore: calculateSortScore(originalTask)
      });
    } else {
      skippedTasks.push({
        ...originalTask,
        ...result
      });
    }
  }
  
  retryTasks.sort((a, b) => b.sortScore - a.sortScore);
  
  const retryOrder = retryTasks.map((task, index) => ({
    order: index + 1,
    taskId: task.taskId,
    taskName: task.taskName,
    courseId: task.courseId,
    teacherName: task.teacherName,
    priority: task.priority,
    failReason: task.failReason,
    retryCount: task.retryCount,
    sourceFile: task.sourceFile
  }));
  
  const statistics = {
    totalTasks: originalTasks.length,
    retryableTasks: retryTasks.length,
    skippedTasks: skippedTasks.length,
    skipByReason: groupByReason(skippedTasks)
  };
  
  return {
    batchId: validatedData.batchId,
    batchName: validatedData.batchName,
    parseTime: validatedData.parseTime,
    validateTime: validatedData.validateTime,
    summarizeTime: new Date().toISOString(),
    retryOrder,
    skippedTasks: skippedTasks.map(task => ({
      taskId: task.taskId,
      taskName: task.taskName,
      courseId: task.courseId,
      teacherName: task.teacherName,
      sourceFile: task.sourceFile,
      skipReasons: task.skipReasons,
      issues: task.issues
    })),
    statistics
  };
}

function calculateSortScore(task) {
  const priorityScore = PRIORITY_WEIGHT[task.priority] || PRIORITY_WEIGHT.medium;
  const retryScore = 10 - Math.min(task.retryCount, 5);
  const timeScore = 0;
  
  return priorityScore * 100 + retryScore * 10 + timeScore;
}

function groupByReason(skippedTasks) {
  const reasonCounts = {};
  
  for (const task of skippedTasks) {
    for (const reason of task.skipReasons) {
      const key = reason.type;
      if (!reasonCounts[key]) {
        reasonCounts[key] = {
          description: reason.description,
          count: 0,
          taskIds: []
        };
      }
      reasonCounts[key].count++;
      reasonCounts[key].taskIds.push(task.taskId);
    }
  }
  
  return reasonCounts;
}
