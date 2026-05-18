const UNSUPPORTED_FORMATS = ['wmv', 'mpg', 'mpeg', 'avi', 'mov'];

export function validateTasks(parsedData) {
  const tasks = parsedData.tasks;
  const validationResults = [];
  const seenFileSignatures = new Map();
  
  for (const task of tasks) {
    const taskResult = {
      taskId: task.taskId,
      taskName: task.taskName,
      canRetry: true,
      skipReasons: [],
      issues: []
    };
    
    checkSourceFileReplaced(task, taskResult);
    checkFormatNotSupported(task, taskResult);
    checkDuplicateTask(task, seenFileSignatures, taskResult);
    checkRetryLimit(task, taskResult);
    
    if (taskResult.skipReasons.length > 0) {
      taskResult.canRetry = false;
    }
    
    validationResults.push(taskResult);
  }
  
  return {
    batchId: parsedData.batchId,
    batchName: parsedData.batchName,
    parseTime: parsedData.parseTime,
    validationResults,
    validateTime: new Date().toISOString()
  };
}

function checkSourceFileReplaced(task, result) {
  if (task.sourceFileMd5 && task.currentSourceFileMd5 && 
      task.sourceFileMd5 !== task.currentSourceFileMd5) {
    result.skipReasons.push({
      type: 'source_file_replaced',
      description: '源文件已被替换',
      detail: `原始MD5: ${task.sourceFileMd5.substring(0, 8)}..., 当前MD5: ${task.currentSourceFileMd5.substring(0, 8)}...`
    });
    result.issues.push('源文件内容发生变化，需确认后重新提交任务');
  }
}

function checkFormatNotSupported(task, result) {
  const fileExt = getFileExtension(task.sourceFile).toLowerCase();
  
  if (UNSUPPORTED_FORMATS.includes(fileExt)) {
    result.skipReasons.push({
      type: 'format_not_supported',
      description: '文件格式不支持转码',
      detail: `文件格式: .${fileExt}`
    });
    result.issues.push(`该文件格式(.${fileExt})不在当前支持的转码格式列表中`);
  }
  
  if (task.failReason === 'format_not_supported' || task.failReason === 'codec_not_supported') {
    result.skipReasons.push({
      type: 'codec_not_supported',
      description: '编码格式不支持',
      detail: `失败原因: ${task.failReason}`
    });
    result.issues.push('视频编码格式不被支持，需要转换源文件格式');
  }
}

function checkDuplicateTask(task, seenSignatures, result) {
  const fileSignature = `${task.sourceFile}|${task.sourceFileMd5}|${task.targetFormat}|${task.targetResolution}`;
  
  if (seenSignatures.has(fileSignature)) {
    const existingTaskId = seenSignatures.get(fileSignature);
    result.skipReasons.push({
      type: 'duplicate_task',
      description: '重复转码任务',
      detail: `与任务 ${existingTaskId} 重复`
    });
    result.issues.push(`相同源文件、相同输出参数的任务已存在（任务ID: ${existingTaskId}）`);
  } else {
    seenSignatures.set(fileSignature, task.taskId);
  }
}

function checkRetryLimit(task, result) {
  const MAX_RETRIES = 3;
  if (task.retryCount >= MAX_RETRIES) {
    result.skipReasons.push({
      type: 'retry_limit_exceeded',
      description: '重试次数超限',
      detail: `已重试 ${task.retryCount} 次，最大允许 ${MAX_RETRIES} 次`
    });
    result.issues.push(`任务已累计重试 ${task.retryCount} 次，达到系统上限，需要人工排查原因`);
  }
}

function getFileExtension(filePath) {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}
