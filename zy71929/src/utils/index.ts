import type { TaskStatus } from '@/types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    waiting_artworks: '等待作品',
    pending: '待处理',
    reviewing: '复核中',
    completed: '已完成',
  };
  return labels[status];
}

export function getStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    waiting_artworks: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    reviewing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  return colors[status];
}

export function getStatusIcon(status: TaskStatus): string {
  const icons: Record<TaskStatus, string> = {
    waiting_artworks: 'clock',
    pending: 'alert-triangle',
    reviewing: 'eye',
    completed: 'check-circle',
  };
  return icons[status];
}

export function curatorNoteTemplate(): string {
  return `【策展备注样例】

展览主题：[输入展览主题]
展览时间：YYYY.MM.DD - YYYY.MM.DD
策展人：[姓名]

一、展览理念
[简要描述本次展览的核心概念和策展思路]

二、空间规划
[描述展墙布局、参观动线等空间安排]

三、作品要求
1. 尺寸限制：[最大尺寸要求]
2. 装裱要求：[装裱方式说明]
3. 布光要求：[特殊灯光需求]

四、注意事项
[其他需要画廊助理注意的事项]`;
}
