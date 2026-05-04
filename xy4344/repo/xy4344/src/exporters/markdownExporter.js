const fs = require('fs');
const path = require('path');

const subtitleDao = require('../dao/subtitleDao');
const vocabularyDao = require('../dao/vocabularyDao');
const segmentDao = require('../dao/segmentDao');
const feedbackDao = require('../dao/feedbackDao');
const issueDao = require('../dao/issueDao');
const reviewDao = require('../dao/reviewDao');

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSeverityEmoji(severity) {
  switch (severity) {
    case 'critical': return '🔴';
    case 'warning': return '🟡';
    case 'info': return '🔵';
    default: return '⚪';
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'open': return '🟡 待处理';
    case 'resolved': return '🟢 已解决';
    case 'closed': return '✅ 已闭环';
    case 'ignored': return '⚪ 已忽略';
    default: return `⚪ ${status}`;
  }
}

async function generateReviewMarkdown() {
  const [
    subtitles,
    vocabulary,
    segments,
    feedback,
    issues,
    issueStats,
    reviews
  ] = await Promise.all([
    subtitleDao.getAllSubtitles(),
    vocabularyDao.getAllVocabulary(),
    segmentDao.getAllSegments(),
    feedbackDao.getAllFeedback(),
    issueDao.getAllIssues(),
    issueDao.getIssueStats(),
    reviewDao.getAllReviews()
  ]);
  
  let md = `# 手语课复盘报告\n\n`;
  md += `> 生成时间: ${formatDate(new Date())}\n\n`;
  
  md += `---\n\n`;
  md += `## 📊 数据概览\n\n`;
  md += `| 数据类型 | 数量 |\n`;
  md += `|---------|------|\n`;
  md += `| 字幕条目 | ${subtitles.length} |\n`;
  md += `| 手语词汇 | ${vocabulary.length} |\n`;
  md += `| 课堂环节 | ${segments.length} |\n`;
  md += `| 学员反馈 | ${feedback.length} |\n`;
  md += `| 检测问题 | ${issueStats.total} |\n`;
  md += `| 复核记录 | ${reviews.length} |\n\n`;
  
  if (issueStats.total > 0) {
    md += `### 问题统计\n\n`;
    md += `**按严重程度:**\n`;
    for (const item of issueStats.bySeverity) {
      md += `- ${getSeverityEmoji(item.severity)} ${item.severity === 'critical' ? '严重' : item.severity === 'warning' ? '警告' : '信息'}: ${item.count}\n`;
    }
    md += `\n`;
    
    md += `**按类型:**\n`;
    for (const item of issueStats.byType) {
      const typeNames = {
        'time_overlap': '时间重叠',
        'vocabulary_missing': '词汇缺失',
        'segment_order': '环节顺序',
        'feedback_loop': '反馈闭环',
        'subtitle_empty': '字幕为空',
        'subtitle_long': '字幕过长'
      };
      md += `- ${typeNames[item.type] || item.type}: ${item.count}\n`;
    }
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `## ⚠️ 问题清单\n\n`;
  
  if (issues.length === 0) {
    md += `✅ 未发现问题\n\n`;
  } else {
    const typeNames = {
      'time_overlap': '时间重叠',
      'vocabulary_missing': '词汇缺失',
      'segment_order': '环节顺序',
      'feedback_loop': '反馈闭环',
      'subtitle_empty': '字幕为空',
      'subtitle_long': '字幕过长'
    };
    
    const groupedIssues = {};
    for (const issue of issues) {
      const typeName = typeNames[issue.type] || issue.type;
      if (!groupedIssues[typeName]) {
        groupedIssues[typeName] = [];
      }
      groupedIssues[typeName].push(issue);
    }
    
    for (const [typeName, typeIssues] of Object.entries(groupedIssues)) {
      md += `### ${typeName}\n\n`;
      for (const issue of typeIssues) {
        md += `${getSeverityEmoji(issue.severity)} **${issue.title}** (${getStatusBadge(issue.status)})\n\n`;
        md += `> ${issue.description}\n\n`;
        if (issue.comment) {
          md += `**复核意见:** ${issue.comment}\n\n`;
        }
        md += `---\n\n`;
      }
    }
  }
  
  md += `---\n\n`;
  md += `## 📝 字幕列表\n\n`;
  
  md += `| 序号 | 开始时间 | 结束时间 | 内容 | 时长 |\n`;
  md += `|-----|---------|---------|------|------|\n`;
  for (const sub of subtitles) {
    const durationSec = Math.round(sub.duration / 1000);
    md += `| ${sub.index_num} | ${sub.start_time_str} | ${sub.end_time_str} | ${sub.text.replace(/\|/g, '\\|')} | ${durationSec}秒 |\n`;
  }
  md += `\n`;
  
  md += `---\n\n`;
  md += `## 🔤 手语词汇表\n\n`;
  
  if (vocabulary.length === 0) {
    md += `暂无词汇表数据\n\n`;
  } else {
    md += `| 词汇 | 释义 | 分类 | 难度 |\n`;
    md += `|-----|------|------|------|\n`;
    for (const v of vocabulary) {
      md += `| ${v.word} | ${v.meaning || '-'} | ${v.category || '-'} | ${v.difficulty || '-'} |\n`;
    }
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `## 📋 课堂环节\n\n`;
  
  if (segments.length === 0) {
    md += `暂无环节数据\n\n`;
  } else {
    md += `| 顺序 | 环节名称 | 开始时间 | 结束时间 | 讲师 |\n`;
    md += `|-----|---------|---------|---------|------|\n`;
    for (const s of segments) {
      md += `| ${s.order_num} | ${s.name} | ${s.start_time || '-'} | ${s.end_time || '-'} | ${s.teacher || '-'} |\n`;
    }
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `## 💬 学员反馈\n\n`;
  
  if (feedback.length === 0) {
    md += `暂无反馈数据\n\n`;
  } else {
    const statusMap = {
      'pending': '🟡 待处理',
      'closed': '✅ 已闭环',
      'resolved': '✅ 已解决'
    };
    
    for (const f of feedback) {
      md += `### ${f.student || '匿名学员'}\n\n`;
      md += `- **状态:** ${statusMap[f.status] || f.status}\n`;
      md += `- **分类:** ${f.category || '-'}\n`;
      md += `- **问题:** ${f.question || '-'}\n`;
      if (f.response) {
        md += `- **回复:** ${f.response}\n`;
      }
      if (f.submitted_at) {
        md += `- **提交时间:** ${f.submitted_at}\n`;
      }
      md += `\n`;
    }
  }
  
  md += `---\n\n`;
  md += `## ✅ 复核记录\n\n`;
  
  if (reviews.length === 0) {
    md += `暂无复核记录\n\n`;
  } else {
    const statusMap = {
      'pending': '🟡 待复核',
      'approved': '✅ 通过',
      'needs_fix': '❌ 需要修改',
      'deferred': '⏸️ 延期处理'
    };
    
    const typeMap = {
      'subtitle': '字幕',
      'vocabulary': '词汇',
      'segment': '环节',
      'feedback': '反馈',
      'issue': '问题'
    };
    
    for (const r of reviews) {
      md += `- **[${typeMap[r.item_type] || r.item_type}]** ${statusMap[r.status] || r.status}`;
      if (r.reviewer) md += ` - 复核人: ${r.reviewer}`;
      md += `\n`;
      if (r.comment) {
        md += `  > ${r.comment}\n`;
      }
    }
    md += `\n`;
  }
  
  return md;
}

async function exportMarkdown(outputPath) {
  const md = await generateReviewMarkdown();
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, md, 'utf8');
  return outputPath;
}

module.exports = {
  generateReviewMarkdown,
  exportMarkdown
};
