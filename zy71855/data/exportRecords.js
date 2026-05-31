const { getTeachingSessions, getMaterialBatches, getSteps } = require('./teachingSession');

function formatDate(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function calculateDuration(startTime, endTime) {
  if (!endTime) return '进行中';
  const diff = new Date(endTime) - new Date(startTime);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${remainingMinutes}分钟`;
  }
  return `${minutes}分钟`;
}

function exportSessionToText(sessionId) {
  const sessions = getTeachingSessions();
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) {
    return { success: false, message: '找不到这节课的记录' };
  }
  
  const materials = getMaterialBatches();
  const material = materials.find(m => m.batchNumber === session.batchNumber);
  const allSteps = getSteps();
  
  let content = '';
  content += '========================================\n';
  content += '       工业机械臂示教 - 课堂记录\n';
  content += '========================================\n\n';
  
  content += `【基本信息】\n`;
  content += `材料批次：${session.batchNumber}\n`;
  content += `材料名称：${material ? material.materialName : '未知'}\n`;
  content += `授课老师：${session.teacherName}\n`;
  content += `班级名称：${session.className}\n`;
  content += `开始时间：${formatDate(session.startTime)}\n`;
  content += `结束时间：${session.endTime ? formatDate(session.endTime) : '未结束'}\n`;
  content += `课程时长：${calculateDuration(session.startTime, session.endTime)}\n`;
  content += `课程状态：${session.status === 'completed' ? '已完成' : '进行中'}\n\n`;
  
  content += `【步骤完成情况】\n`;
  content += `总共 ${allSteps.length} 步，已完成 ${session.completedSteps.length} 步\n\n`;
  
  allSteps.forEach((step, index) => {
    const order = index + 1;
    const completed = session.completedSteps.find(cs => cs.stepId === step.id);
    
    if (completed) {
      content += `✓ 第${order}步：${step.name}\n`;
      content += `   完成时间：${formatDate(completed.completedAt)}\n`;
      if (completed.notes) {
        content += `   备注：${completed.notes}\n`;
      }
      if (completed.revisited) {
        content += `   ⚠️  此步骤曾重复查看\n`;
      }
      content += `\n`;
    } else {
      content += `  第${order}步：${step.name} - 未完成\n\n`;
    }
  });
  
  if (session.errors.length > 0) {
    content += `【遇到的问题】\n`;
    session.errors.forEach((error, index) => {
      content += `${index + 1}. ${error.message}\n`;
      content += `   建议：${error.suggestion}\n`;
      content += `   时间：${formatDate(error.timestamp)}\n\n`;
    });
  }
  
  if (session.notes.length > 0) {
    content += `【课堂笔记】\n`;
    session.notes.forEach((note, index) => {
      content += `${index + 1}. ${note.content}\n`;
      content += `   时间：${formatDate(note.createdAt)}\n\n`;
    });
  }
  
  content += '========================================\n';
  content += `记录导出时间：${formatDate(new Date().toISOString())}\n`;
  content += '========================================\n';
  
  return {
    success: true,
    content,
    filename: `课堂记录_${session.batchNumber}_${session.teacherName}_${new Date().toISOString().split('T')[0]}.txt`
  };
}

function exportBatchHistoryToText(batchNumber) {
  const sessions = getTeachingSessions()
    .filter(s => s.batchNumber === batchNumber)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  
  if (sessions.length === 0) {
    return { success: false, message: '找不到这个批次的记录' };
  }
  
  const materials = getMaterialBatches();
  const material = materials.find(m => m.batchNumber === batchNumber);
  
  let content = '';
  content += '========================================\n';
  content += '   工业机械臂示教 - 批次历史记录\n';
  content += '========================================\n\n';
  
  content += `材料批次：${batchNumber}\n`;
  content += `材料名称：${material ? material.materialName : '未知'}\n`;
  content += `开课次数：${sessions.length} 次\n\n`;
  
  sessions.forEach((session, sessionIndex) => {
    content += `----------------------------------------\n`;
    content += `第 ${sessionIndex + 1} 次课程\n`;
    content += `----------------------------------------\n`;
    content += `授课老师：${session.teacherName}\n`;
    content += `班级：${session.className}\n`;
    content += `时间：${formatDate(session.startTime)} ~ ${session.endTime ? formatDate(session.endTime) : '未结束'}\n`;
    content += `完成步骤：${session.completedSteps.length} 步\n`;
    
    if (session.completedSteps.length > 0) {
      content += `完成的步骤：\n`;
      session.completedSteps.forEach(step => {
        content += `  - 第${step.stepOrder}步：${step.stepName}`;
        if (step.revisited) content += ' (曾重复)';
        content += `\n`;
      });
    }
    
    if (session.errors.length > 0) {
      content += `遇到问题：${session.errors.length} 个\n`;
    }
    
    content += `\n`;
  });
  
  content += '========================================\n';
  content += `记录导出时间：${formatDate(new Date().toISOString())}\n`;
  content += '========================================\n';
  
  return {
    success: true,
    content,
    filename: `批次历史_${batchNumber}_${new Date().toISOString().split('T')[0]}.txt`
  };
}

function exportSimpleChecklist(sessionId) {
  const sessions = getTeachingSessions();
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) {
    return { success: false, message: '找不到这节课的记录' };
  }
  
  const allSteps = getSteps();
  
  let content = '';
  content += `# 课堂清单 - ${session.batchNumber}\n`;
  content += `老师：${session.teacherName} | 班级：${session.className}\n\n`;
  
  allSteps.forEach((step, index) => {
    const order = index + 1;
    const completed = session.completedSteps.find(cs => cs.stepId === step.id);
    const checkbox = completed ? '[x]' : '[ ]';
    content += `${checkbox} ${order}. ${step.name}\n`;
  });
  
  content += `\n---\n`;
  content += `备注：\n`;
  session.notes.forEach(note => {
    content += `- ${note.content}\n`;
  });
  
  return {
    success: true,
    content,
    filename: `课堂清单_${session.batchNumber}.txt`
  };
}

module.exports = {
  exportSessionToText,
  exportBatchHistoryToText,
  exportSimpleChecklist
};
