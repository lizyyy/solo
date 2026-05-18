export function generateReport(summary) {
  const lines = [];
  
  lines.push('='.repeat(80));
  lines.push('           🎬 转码任务失败重试规划报告');
  lines.push('='.repeat(80));
  lines.push('');
  
  lines.push(`📋 批次信息`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`  批次ID:    ${summary.batchId}`);
  lines.push(`  批次名称:  ${summary.batchName}`);
  lines.push(`  生成时间:  ${formatDateTime(summary.summarizeTime)}`);
  lines.push('');
  
  lines.push(`📊 统计概览`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`  总任务数:    ${summary.statistics.totalTasks} 个`);
  lines.push(`  可重试任务:  ${summary.statistics.retryableTasks} 个  ✅`);
  lines.push(`  需跳过任务:  ${summary.statistics.skippedTasks} 个  ⚠️`);
  lines.push(`  重试成功率:  ${calculateSuccessRate(summary.statistics)}%`);
  lines.push('');
  
  if (summary.statistics.skippedTasks > 0) {
    lines.push(`❌ 跳过原因分类统计`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    for (const [reasonType, reasonData] of Object.entries(summary.statistics.skipByReason)) {
      lines.push(`  ${reasonData.description}: ${reasonData.count} 个`);
      lines.push(`    涉及任务: ${reasonData.taskIds.join(', ')}`);
      lines.push('');
    }
  }
  
  if (summary.retryOrder.length > 0) {
    lines.push(``);
    lines.push(`🔄 推荐重试顺序 (按优先级排序)`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push('');
    
    for (const item of summary.retryOrder) {
      const priorityLabel = getPriorityLabel(item.priority);
      lines.push(`  【第${item.order}位】 ${priorityLabel} 优先级`);
      lines.push(`       任务ID:   ${item.taskId}`);
      lines.push(`       任务名称: ${item.taskName}`);
      lines.push(`       课程ID:   ${item.courseId}`);
      lines.push(`       讲师:     ${item.teacherName}`);
      lines.push(`       失败原因: ${translateFailReason(item.failReason)}`);
      lines.push(`       已重试:   ${item.retryCount} 次`);
      lines.push(`       源文件:   ${item.sourceFile}`);
      lines.push('');
    }
  }
  
  if (summary.skippedTasks.length > 0) {
    lines.push(``);
    lines.push(`⚠️  跳过任务详细清单 (需人工处理)`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push('');
    
    for (const task of summary.skippedTasks) {
      lines.push(`  任务ID:   ${task.taskId}`);
      lines.push(`  任务名称: ${task.taskName}`);
      lines.push(`  课程ID:   ${task.courseId}`);
      lines.push(`  讲师:     ${task.teacherName}`);
      lines.push(`  源文件:   ${task.sourceFile}`);
      lines.push(`  🚫 跳过原因:`);
      for (const reason of task.skipReasons) {
        lines.push(`     • ${reason.description}`);
        lines.push(`       ${reason.detail}`);
      }
      lines.push(`  💡 处理建议:`);
      for (const issue of task.issues) {
        lines.push(`     • ${issue}`);
      }
      lines.push('');
      lines.push('  ──────────────────────────────────────');
      lines.push('');
    }
  }
  
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('           📝 报告生成完毕');
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function calculateSuccessRate(stats) {
  if (stats.totalTasks === 0) return 0;
  return Math.round((stats.retryableTasks / stats.totalTasks) * 100);
}

function getPriorityLabel(priority) {
  const labels = {
    high: '🔴 高',
    medium: '🟡 中',
    low: '🟢 低'
  };
  return labels[priority] || '🟡 中';
}

function translateFailReason(reason) {
  const translations = {
    network_timeout: '网络超时 - 建议检查网络连接后重试',
    server_error: '服务器内部错误 - 系统自动重试',
    disk_full: '磁盘空间不足 - 已清理空间，可重试',
    memory_limit: '内存不足 - 调整资源分配后重试',
    transcode_error: '转码过程异常 - 重新尝试转码',
    format_not_supported: '格式不支持',
    codec_not_supported: '编码不支持'
  };
  return translations[reason] || reason;
}
