import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { 
  Notification, 
  Version, 
  Source, 
  Comment,
  statusLabels,
  sourceTypeLabels,
  commentTypeLabels
} from '../types';

interface ExportData {
  notification: Notification;
  versions: Version[];
  sources: Source[];
  comments: Comment[];
}

export function exportToMarkdown(data: ExportData): string {
  const { notification, versions, comments } = data;
  
  const seenSources = new Set<string>();
  const sources = data.sources.filter(s => {
    const key = `${s.type}-${s.name}-${s.reference}`;
    if (seenSources.has(key)) return false;
    seenSources.add(key);
    return true;
  });
  const createdAt = format(new Date(notification.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
  const updatedAt = format(new Date(notification.updatedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

  let md = `# 乐团替补排练通知 - ${notification.title}\n\n`;
  
  md += `## 基本信息\n\n`;
  md += `| 字段 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 标题 | ${notification.title} |\n`;
  md += `| 状态 | ${statusLabels[notification.status]} |\n`;
  md += `| 学生姓名 | ${notification.studentName} |\n`;
  md += `| 乐器 | ${notification.instrument} |\n`;
  md += `| 曲目 | ${notification.piece} |\n`;
  md += `| 排练时间 | ${notification.rehearsalTime || '-'} |\n`;
  md += `| 替补原因 | ${notification.reason} |\n`;
  md += `| 当前版本 | v${notification.currentVersion} |\n`;
  md += `| 创建时间 | ${createdAt} |\n`;
  md += `| 更新时间 | ${updatedAt} |\n\n`;

  md += `## 替补原因说明\n\n`;
  md += `> ${notification.reason}\n\n`;

  md += `## 版本历史\n\n`;
  versions.slice().reverse().forEach((v) => {
    const versionTime = format(new Date(v.modifiedAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
    md += `### v${v.versionNumber} - ${versionTime}\n\n`;
    md += `- 修改人：${v.modifiedBy}\n`;
    md += `- 修改原因：${v.changeReason}\n`;
    if (v.diff && v.diff.length > 0) {
      md += `- 变更内容：\n`;
      v.diff.forEach(d => {
        const action = d.action === 'add' ? '新增' : d.action === 'remove' ? '删除' : '修改';
        md += `  - [${action}] ${d.field}: "${d.oldValue ?? '-'}" → "${d.newValue ?? '-'}"\n`;
      });
    }
    md += `\n`;
  });

  md += `## 来源材料\n\n`;
  if (sources.length === 0) {
    md += `暂无来源材料\n\n`;
  } else {
    sources.forEach(s => {
      const uploadTime = format(new Date(s.uploadTime), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
      md += `### [${sourceTypeLabels[s.type]}] ${s.name}\n\n`;
      md += `- 上传时间：${uploadTime}\n`;
      md += `- 上传人：${s.uploadedBy}\n`;
      md += `- 描述：${s.description || '-'}\n`;
      md += `- 引用：${s.reference || '-'}\n\n`;
    });
  }

  md += `## 批注记录\n\n`;
  if (comments.length === 0) {
    md += `暂无批注记录\n\n`;
  } else {
    comments.forEach(c => {
      const commentTime = format(new Date(c.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
      md += `### [${commentTypeLabels[c.type]}] - ${commentTime}\n\n`;
      md += `- 作者：${c.author}\n`;
      md += `- 内容：${c.content}\n\n`;
    });
  }

  md += `---\n\n`;
  md += `*本文件由乐团替补排练通知管理系统自动生成*\n`;
  md += `*生成时间：${format(new Date(), 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })}*\n`;

  return md;
}

export function exportToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function downloadFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
