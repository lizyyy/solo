import { Task, HistoryRecord } from '../types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function exportEvaluation(task: Task, history: HistoryRecord[]): string {
  const createdAt = format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm:ss');
  const updatedAt = format(new Date(task.updatedAt), 'yyyy-MM-dd HH:mm:ss');
  
  const historySummary = history
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(record => {
      const time = format(new Date(record.createdAt), 'yyyy-MM-dd HH:mm');
      return `- ${time} - ${record.modifiedBy} 修改了 ${record.fieldName}：${record.changeReason || '无说明'}`;
    })
    .join('\n');

  return `# 训练任务评估报告

## 任务基本信息

- **任务ID**: ${task.id}
- **任务标题**: ${task.title}
- **来源类型**: ${task.source}
- **来源详情**: ${task.sourceDetail || '无'}
- **负责人**: ${task.assignee}
- **当前状态**: ${task.status}
- **创建时间**: ${createdAt}
- **更新时间**: ${updatedAt}

## 任务描述

${task.description || '无描述'}

## 待处理原因

${task.pendingReason || '无'}

## 修改历史

${historySummary || '无修改记录'}

## 训练日志

\`\`\`
${task.trainingLog || '无训练日志'}
\`\`\`

## 评估说明

${task.evaluation || '无评估说明'}

---
*导出时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}*
`;
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
