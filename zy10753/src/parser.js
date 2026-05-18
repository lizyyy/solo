import fs from 'fs';
import path from 'path';

export function parseTaskFile(filePath) {
  const absolutePath = path.resolve(filePath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }
  
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const data = JSON.parse(content);
  
  validateBasicStructure(data);
  
  return {
    batchId: data.batchId,
    batchName: data.batchName,
    tasks: data.tasks.map(task => normalizeTask(task)),
    parseTime: new Date().toISOString()
  };
}

function validateBasicStructure(data) {
  const errors = [];
  
  if (!data.batchId) {
    errors.push('缺少批次ID (batchId)');
  }
  
  if (!data.batchName) {
    errors.push('缺少批次名称 (batchName)');
  }
  
  if (!Array.isArray(data.tasks)) {
    errors.push('任务列表 (tasks) 必须是数组');
  } else if (data.tasks.length === 0) {
    errors.push('任务列表为空');
  }
  
  if (errors.length > 0) {
    throw new Error(`数据结构校验失败: ${errors.join('; ')}`);
  }
}

function normalizeTask(task) {
  return {
    taskId: task.taskId || '',
    taskName: task.taskName || '',
    sourceFile: task.sourceFile || '',
    sourceFileSize: task.sourceFileSize || 0,
    sourceFileMd5: task.sourceFileMd5 || '',
    currentSourceFileMd5: task.currentSourceFileMd5 || task.sourceFileMd5,
    targetFormat: task.targetFormat || '',
    targetResolution: task.targetResolution || '',
    priority: task.priority || 'medium',
    status: task.status || '',
    failReason: task.failReason || '',
    retryCount: task.retryCount || 0,
    createTime: task.createTime || '',
    courseId: task.courseId || '',
    teacherName: task.teacherName || ''
  };
}
