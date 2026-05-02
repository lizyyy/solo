import { msToReadable, msToTime, Severity, IssueType } from '../types.js';

export function exportMarkdownDelivery(project, options = {}) {
  const {
    includeIssues = true,
    includeDetails = true
  } = options;
  
  const timeline = project.timeline;
  const allIssues = [
    ...(project.issues?.audio || []),
    ...(project.issues?.rules || [])
  ];
  const resolvedIssues = project.issues?.resolved || [];
  
  const lines = [];
  
  lines.push(`# ${project.name} - 交付单`);
  lines.push('');
  lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`> 项目版本: ${project.version}`);
  lines.push('');
  
  lines.push('## 📋 项目概览');
  lines.push('');
  
  if (timeline) {
    lines.push('| 项目 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总时长 | ${msToReadable(timeline.totalDuration)} |`);
    lines.push(`| 片段数 | ${timeline.clips?.length || 0} |`);
    lines.push(`| 章节数 | ${timeline.chapters?.length || 0} |`);
    lines.push(`| 字幕数 | ${timeline.subtitles?.length || 0} |`);
    lines.push(`| 广告数 | ${timeline.ads?.length || 0} |`);
    lines.push('');
  }
  
  if (allIssues.length > 0 || resolvedIssues.length > 0) {
    lines.push('## ⚠️ 问题概览');
    lines.push('');
    
    const bySeverity = {
      [Severity.CRITICAL]: 0,
      [Severity.HIGH]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.LOW]: 0
    };
    
    for (const issue of allIssues) {
      bySeverity[issue.severity]++;
    }
    
    lines.push('| 严重程度 | 数量 |');
    lines.push('|----------|------|');
    lines.push(`| 🔴 致命 | ${bySeverity[Severity.CRITICAL]} |`);
    lines.push(`| 🟠 高 | ${bySeverity[Severity.HIGH]} |`);
    lines.push(`| 🟡 中 | ${bySeverity[Severity.MEDIUM]} |`);
    lines.push(`| 🟢 低 | ${bySeverity[Severity.LOW]} |`);
    lines.push(`| ✅ 已解决 | ${resolvedIssues.length} |`);
    lines.push('');
  }
  
  if (timeline?.chapters && timeline.chapters.length > 0) {
    lines.push('## 📖 章节列表');
    lines.push('');
    
    for (const chapter of timeline.chapters) {
      lines.push(`### ${chapter.name}`);
      lines.push('');
      lines.push(`- **时间**: ${msToReadable(chapter.startTime)} - ${msToReadable(chapter.endTime)}`);
      lines.push(`- **时长**: ${msToReadable(chapter.duration)}`);
      
      if (chapter.clips && chapter.clips.length > 0) {
        lines.push(`- **包含片段**: ${chapter.clips.length} 个`);
      }
      if (chapter.subtitles && chapter.subtitles.length > 0) {
        lines.push(`- **包含字幕**: ${chapter.subtitles.length} 条`);
      }
      
      lines.push('');
      
      if (includeDetails && chapter.clips && chapter.clips.length > 0) {
        lines.push('| 片段 | 开始 | 结束 | 时长 |');
        lines.push('|------|------|------|------|');
        
        for (const clip of chapter.clips) {
          lines.push(`| ${clip.name} | ${msToReadable(clip.startTime)} | ${msToReadable(clip.endTime)} | ${msToReadable(clip.duration)} |`);
        }
        lines.push('');
      }
    }
  }
  
  if (timeline?.ads && timeline.ads.length > 0) {
    lines.push('## 📢 广告列表');
    lines.push('');
    lines.push('| 序号 | 名称 | 开始 | 结束 | 时长 | 位置 |');
    lines.push('|------|------|------|------|------|------|');
    
    for (const ad of timeline.ads) {
      lines.push(`| ${ad.order} | ${ad.name} | ${msToReadable(ad.startTime)} | ${msToReadable(ad.endTime)} | ${msToReadable(ad.duration)} | ${ad.position || '-'} |`);
    }
    lines.push('');
  }
  
  if (includeIssues && allIssues.length > 0) {
    lines.push('## ⚠️ 待处理问题');
    lines.push('');
    
    const sortedIssues = [...allIssues].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] || 99) - (order[b.severity] || 99);
    });
    
    for (const issue of sortedIssues) {
      const severityIcon = issue.severity === Severity.CRITICAL ? '🔴' :
                           issue.severity === Severity.HIGH ? '🟠' :
                           issue.severity === Severity.MEDIUM ? '🟡' : '🟢';
      
      lines.push(`### ${severityIcon} ${getIssueTypeName(issue.type)}`);
      lines.push('');
      lines.push(`- **时间**: ${msToReadable(issue.startTime)} - ${msToReadable(issue.endTime)}`);
      lines.push(`- **描述**: ${issue.message}`);
      lines.push('');
    }
  }
  
  if (resolvedIssues.length > 0) {
    lines.push('## ✅ 已解决问题');
    lines.push('');
    
    for (const issue of resolvedIssues) {
      lines.push(`- [x] **${getIssueTypeName(issue.type)}**: ${issue.message}`);
      if (issue.resolution?.notes) {
        lines.push(`  - 解决说明: ${issue.resolution.notes}`);
      }
    }
    lines.push('');
  }
  
  if (project.corrections && project.corrections.length > 0) {
    lines.push('## ✏️ 人工修正记录');
    lines.push('');
    
    for (const corr of project.corrections) {
      lines.push(`- **${corr.type || '修正'}**: ${corr.description || corr.name || '-'} (${new Date(corr.createdAt).toLocaleString('zh-CN')})`);
    }
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push('*此交付单由「口播时间轴缝合台」自动生成*');
  
  return lines.join('\n');
}

function getIssueTypeName(type) {
  const names = {
    [IssueType.OVERLAP]: '片段重叠',
    [IssueType.GAP]: '时间空洞',
    [IssueType.SILENCE_NOT_CUT]: '静音未裁剪',
    [IssueType.LOUDNESS_PEAK]: '响度峰值',
    [IssueType.AD_OVERLAPS_CONTENT]: '广告重叠',
    [IssueType.SUBTITLE_DRIFT]: '字幕漂移',
    [IssueType.OUT_OF_ORDER]: '顺序错误'
  };
  return names[type] || type;
}

export function exportChaptersJSON(timeline, options = {}) {
  if (!timeline || !timeline.chapters) {
    return JSON.stringify({ chapters: [] }, null, 2);
  }
  
  const chapters = timeline.chapters.map(chapter => ({
    id: chapter.id,
    title: chapter.name,
    startTime: chapter.startTime,
    endTime: chapter.endTime,
    startTimeFormatted: msToTime(chapter.startTime),
    endTimeFormatted: msToTime(chapter.endTime),
    duration: chapter.duration,
    clips: (chapter.clips || []).map(clip => ({
      id: clip.id,
      name: clip.name,
      startTime: clip.startTime,
      endTime: clip.endTime,
      duration: clip.duration,
      type: clip.clipType
    })),
    subtitleCount: (chapter.subtitles || []).length
  }));
  
  const output = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalDuration: timeline.totalDuration,
    totalChapters: chapters.length,
    chapters
  };
  
  return JSON.stringify(output, null, 2);
}

export function exportIssuesCSV(project, options = {}) {
  const {
    includeResolved = false,
    delimiter = ','
  } = options;
  
  const allIssues = [
    ...(project.issues?.audio || []),
    ...(project.issues?.rules || [])
  ];
  
  if (includeResolved) {
    allIssues.push(...(project.issues?.resolved || []));
  }
  
  const headers = [
    'ID',
    '类型',
    '严重程度',
    '开始时间',
    '结束时间',
    '持续时间(ms)',
    '开始时间(格式化)',
    '结束时间(格式化)',
    '消息',
    '已解决',
    '解决时间'
  ];
  
  const rows = [headers.join(delimiter)];
  
  for (const issue of allIssues) {
    const row = [
      issue.id,
      getIssueTypeName(issue.type),
      getSeverityName(issue.severity),
      issue.startTime,
      issue.endTime,
      issue.duration,
      msToTime(issue.startTime),
      msToTime(issue.endTime),
      `"${issue.message.replace(/"/g, '""')}"`,
      issue.resolved ? '是' : '否',
      issue.resolvedAt || ''
    ];
    rows.push(row.join(delimiter));
  }
  
  return rows.join('\n');
}

function getSeverityName(severity) {
  const names = {
    [Severity.CRITICAL]: '致命',
    [Severity.HIGH]: '高',
    [Severity.MEDIUM]: '中',
    [Severity.LOW]: '低'
  };
  return names[severity] || severity;
}

export function exportFullProjectJSON(project) {
  return JSON.stringify(project, null, 2);
}
