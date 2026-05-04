function exportSRT(subtitles) {
  const sortedSubs = [...subtitles].sort((a, b) => a.sequence - b.sequence);
  
  let srtContent = '';
  
  sortedSubs.forEach((sub, index) => {
    const sequence = sub.sequence || (index + 1);
    const startTime = sub.start_time || '00:00:00,000';
    const endTime = sub.end_time || '00:00:00,000';
    const text = sub.current_text || sub.original_text || '';
    
    srtContent += `${sequence}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    if (sub.speaker) {
      srtContent += `${sub.speaker}: ${text}\n\n`;
    } else {
      srtContent += `${text}\n\n`;
    }
  });
  
  return srtContent.trim() + '\n';
}

function exportMarkdown(subtitles, detectionResults, project) {
  const sortedSubs = [...subtitles].sort((a, b) => a.sequence - b.sequence);
  const sortedResults = [...detectionResults].sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
  });
  
  const reviewedCount = subtitles.filter(s => s.is_reviewed === 1 || s.is_reviewed === true).length;
  const totalCount = subtitles.length;
  const progressPercent = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;
  
  const errorCount = detectionResults.filter(r => r.severity === 'error' && !r.is_resolved).length;
  const warningCount = detectionResults.filter(r => r.severity === 'warning' && !r.is_resolved).length;
  const infoCount = detectionResults.filter(r => r.severity === 'info' && !r.is_resolved).length;
  const resolvedCount = detectionResults.filter(r => r.is_resolved).length;
  
  let markdown = `# 字幕校对问题报告\n\n`;
  
  markdown += `## 项目信息\n\n`;
  markdown += `- **项目名称**: ${project?.name || '未命名项目'}\n`;
  markdown += `- **创建时间**: ${project?.created_at || '-'}\n`;
  markdown += `- **最后更新**: ${project?.updated_at || '-'}\n`;
  markdown += `- **报告生成时间**: ${new Date().toISOString()}\n\n`;
  
  markdown += `## 校对进度\n\n`;
  markdown += `- **总字幕数**: ${totalCount}\n`;
  markdown += `- **已复核**: ${reviewedCount}\n`;
  markdown += `- **进度**: ${progressPercent}%\n\n`;
  
  markdown += `## 检测结果统计\n\n`;
  markdown += `| 严重程度 | 数量 |\n`;
  markdown += `|---------|------|\n`;
  markdown += `| 错误 (Error) | ${errorCount} |\n`;
  markdown += `| 警告 (Warning) | ${warningCount} |\n`;
  markdown += `| 信息 (Info) | ${infoCount} |\n`;
  markdown += `| 已解决 | ${resolvedCount} |\n\n`;
  
  markdown += `---\n\n`;
  
  markdown += `## 详细问题列表\n\n`;
  
  if (sortedResults.length === 0) {
    markdown += `暂无检测问题。\n\n`;
  } else {
    const groupedResults = {};
    sortedResults.forEach(result => {
      const type = result.issue_type || 'other';
      if (!groupedResults[type]) {
        groupedResults[type] = [];
      }
      groupedResults[type].push(result);
    });
    
    const typeNames = {
      time_overlap: '时间轴重叠',
      sensitive_name: '敏感姓名',
      sensitive_speaker: '敏感说话人',
      term_inconsistency: '术语不一致',
      empty_subtitle: '空字幕',
      incomplete_sentence: '语句不完整',
      short_subtitle: '字幕过短',
      fast_reading: '阅读速度过快',
      other: '其他问题'
    };
    
    Object.keys(groupedResults).forEach(type => {
      const results = groupedResults[type];
      const unresolvedResults = results.filter(r => !r.is_resolved);
      
      if (unresolvedResults.length > 0) {
        markdown += `### ${typeNames[type] || type} (${unresolvedResults.length} 个)\n\n`;
        
        unresolvedResults.forEach(result => {
          const statusIcon = result.is_resolved ? '✅' : (result.severity === 'error' ? '🔴' : result.severity === 'warning' ? '🟡' : '🔵');
          
          markdown += `${statusIcon} **问题 ID: ${result.id}**\n\n`;
          markdown += `- 严重程度: ${result.severity.toUpperCase()}\n`;
          
          if (result.sequence) {
            markdown += `- 字幕序号: 第 ${result.sequence} 段\n`;
          }
          
          if (result.subtitle_text) {
            markdown += `- 字幕内容: ${result.subtitle_text}\n`;
          }
          
          markdown += `- 描述: ${result.message}\n`;
          
          if (result.details) {
            try {
              const details = typeof result.details === 'string' ? JSON.parse(result.details) : result.details;
              
              if (details.suggestion) {
                markdown += `- 建议: ${details.suggestion}\n`;
              }
              
              if (details.overlapSeconds) {
                markdown += `- 重叠时长: ${details.overlapSeconds} 秒\n`;
              }
              
              if (details.found && details.expected) {
                markdown += `- 发现: "${details.found}"\n`;
                markdown += `- 应为: "${details.expected}"\n`;
                if (details.replacement) {
                  markdown += `- 建议替换: "${details.replacement}"\n`;
                }
              }
            } catch (e) {
              // 解析失败，忽略
            }
          }
          
          markdown += `\n`;
        });
      }
    });
    
    const resolvedResults = sortedResults.filter(r => r.is_resolved);
    if (resolvedResults.length > 0) {
      markdown += `### 已解决的问题 (${resolvedResults.length} 个)\n\n`;
      markdown += `以下问题已被标记为已解决：\n\n`;
      
      resolvedResults.forEach(result => {
        markdown += `- ✅ ${result.message}`;
        if (result.sequence) {
          markdown += ` (第 ${result.sequence} 段)`;
        }
        markdown += `\n`;
      });
      
      markdown += `\n`;
    }
  }
  
  markdown += `---\n\n`;
  
  markdown += `## 字幕对照表\n\n`;
  markdown += `以下是原始字幕与当前编辑字幕的对照表（仅显示有修改的项）：\n\n`;
  
  const modifiedSubs = sortedSubs.filter(sub => 
    (sub.current_text || '') !== (sub.original_text || '')
  );
  
  if (modifiedSubs.length === 0) {
    markdown += `暂无修改的字幕。\n\n`;
  } else {
    modifiedSubs.forEach(sub => {
      markdown += `### 第 ${sub.sequence} 段\n\n`;
      markdown += `- **时间**: ${sub.start_time} --> ${sub.end_time}\n`;
      if (sub.speaker) {
        markdown += `- **说话人**: ${sub.speaker}\n`;
      }
      markdown += `- **原始内容**: ${sub.original_text || '(空)'}\n`;
      markdown += `- **当前内容**: ${sub.current_text || '(空)'}\n`;
      if (sub.is_reviewed) {
        markdown += `- **状态**: ✅ 已复核\n`;
      } else {
        markdown += `- **状态**: ⏳ 待复核\n`;
      }
      markdown += `\n`;
    });
  }
  
  markdown += `---\n\n`;
  markdown += `*报告由无障碍字幕校对台自动生成*\n`;
  markdown += `*生成时间: ${new Date().toLocaleString()}*\n`;
  
  return markdown;
}

function exportJSON(data) {
  const exportData = {
    version: '1.0',
    exportTime: data.exportTime || new Date().toISOString(),
    project: {
      id: data.project?.id,
      name: data.project?.name,
      description: data.project?.description,
      createdAt: data.project?.created_at,
      updatedAt: data.project?.updated_at
    },
    statistics: {
      totalSubtitles: data.subtitles?.length || 0,
      reviewedCount: data.subtitles?.filter(s => s.is_reviewed === 1 || s.is_reviewed === true).length || 0,
      totalTerms: data.terms?.length || 0,
      totalSpeakers: data.speakers?.length || 0,
      totalIssues: data.detectionResults?.length || 0,
      resolvedIssues: data.detectionResults?.filter(r => r.is_resolved).length || 0,
      totalEdits: data.proofreadRecords?.length || 0
    },
    subtitles: (data.subtitles || []).map(sub => ({
      id: sub.id,
      sequence: sub.sequence,
      startTime: sub.start_time,
      endTime: sub.end_time,
      startSeconds: sub.start_seconds,
      endSeconds: sub.end_seconds,
      originalText: sub.original_text,
      currentText: sub.current_text,
      speaker: sub.speaker,
      isReviewed: sub.is_reviewed === 1 || sub.is_reviewed === true,
      hasChanges: (sub.current_text || '') !== (sub.original_text || ''),
      createdAt: sub.created_at,
      updatedAt: sub.updated_at
    })),
    terms: (data.terms || []).map(term => ({
      id: term.id,
      term: term.term,
      replacement: term.replacement,
      category: term.category,
      isSensitive: term.is_sensitive === 1 || term.is_sensitive === true
    })),
    speakers: (data.speakers || []).map(speaker => ({
      id: speaker.id,
      name: speaker.name,
      alias: speaker.alias,
      isSensitive: speaker.is_sensitive === 1 || speaker.is_sensitive === true
    })),
    detectionResults: (data.detectionResults || []).map(result => ({
      id: result.id,
      subtitleId: result.subtitle_id,
      sequence: result.sequence,
      issueType: result.issue_type,
      severity: result.severity,
      message: result.message,
      details: result.details ? (typeof result.details === 'string' ? JSON.parse(result.details) : result.details) : null,
      isResolved: result.is_resolved === 1 || result.is_resolved === true,
      createdAt: result.created_at
    })),
    proofreadRecords: (data.proofreadRecords || []).map(record => ({
      id: record.id,
      subtitleId: record.subtitle_id,
      sequence: record.sequence,
      action: record.action,
      oldValue: record.old_value,
      newValue: record.new_value,
      comment: record.comment,
      createdAt: record.created_at
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
}

module.exports = {
  exportSRT,
  exportMarkdown,
  exportJSON
};