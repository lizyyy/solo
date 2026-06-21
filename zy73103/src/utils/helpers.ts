import type {
  AnomalyType,
  BimNote,
  DrainageScheme,
  SchemeId,
  TimelineEventType,
} from '../types';

export const LAYER_NAME_REGEX = /^[A-Z]{2,3}-\d{3}-[A-Za-z]{1,2}$/;

export function validateLayerName(name: string): boolean {
  return LAYER_NAME_REGEX.test(name);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function schemeStatusLabel(s: DrainageScheme['status']): string {
  const map: Record<DrainageScheme['status'], string> = {
    draft: '草稿',
    reviewing: '评审中',
    approved: '已通过',
    rejected: '已驳回',
    pending_material: '待补齐材料',
    construction_ready: '可施工',
  };
  return map[s];
}

export function anomalyTypeLabel(t: AnomalyType): string {
  const map: Record<AnomalyType, string> = {
    layer_name: '图层命名异常',
    attachment_late: '附件晚到',
    conflict: '数据冲突',
    missing_data: '数据缺失',
  };
  return map[t];
}

export function eventTypeLabel(t: TimelineEventType): string {
  const map: Record<TimelineEventType, string> = {
    scheme_created: '方案创建',
    note_imported: '备注录入',
    anomaly_detected: '检测到异常',
    anomaly_resolved: '异常已处理',
    material_arrived: '材料到齐',
    material_late: '材料未到',
    status_changed: '状态变更',
    comparison_rerun: '重跑比选',
    scheme_updated: '方案更新',
  };
  return map[t];
}

export function materialStatusLabel(s: BimNote['materialStatus']): string {
  const map: Record<BimNote['materialStatus'], string> = {
    complete: '已到齐',
    pending: '收集中',
    late: '晚到/待补齐',
  };
  return map[s];
}

export function buildCanonicalTexts(params: {
  scheme: DrainageScheme;
  note?: BimNote;
  eventKind: 'scene' | 'side' | 'timeline_note' | 'timeline_anomaly';
}): string {
  const { scheme, note, eventKind } = params;
  const base = `方案${scheme.id}「${scheme.name}」`;
  if (eventKind === 'scene') {
    return `${base}：${scheme.sceneAnnotation}（责任口径：${scheme.responsible}）`;
  }
  if (eventKind === 'side') {
    const lines = [
      `${base}，当前状态「${schemeStatusLabel(scheme.status)}」，推荐等级「${scheme.recommLevel}」。`,
      `施工口径：${scheme.constructionSpec}`,
      `责任口径：${scheme.responsible}`,
      `场景标注原文：${scheme.sceneAnnotation}`,
    ];
    if (note) {
      lines.push(
        `关联备注 [${note.layerName}] ${note.author} @ ${formatDate(note.createdAt)}：${note.content}`,
      );
      if (!note.isLayerValid && note.layerIssue) {
        lines.push(`图层问题：${note.layerIssue}`);
      }
      if (note.materialStatus === 'late') {
        lines.push(
          `附件状态：晚到（${note.attachmentName ?? '材料送审附件'}，预计 ${note.estimatedArrival ?? '待定'} 到齐）`,
        );
      }
    }
    return lines.join('\n');
  }
  if (eventKind === 'timeline_note' && note) {
    const parts = [
      `${base}录入 BIM 备注 [${note.layerName}]`,
      `作者：${note.author}`,
      `内容：${note.content}`,
      `材料状态：${materialStatusLabel(note.materialStatus)}`,
    ];
    if (!note.isLayerValid) parts.push(`图层合规：否（${note.layerIssue ?? ''}）`);
    return parts.join('｜');
  }
  if (eventKind === 'timeline_anomaly') {
    return `${base}产生异常：${note?.layerName ?? '未知图层'}`;
  }
  return base;
}

export function getSchemeColor(id: SchemeId, alpha = 0.35): string {
  const map: Record<SchemeId, string> = {
    A: `rgba(59, 130, 246, ${alpha})`,
    B: `rgba(16, 185, 129, ${alpha})`,
    C: `rgba(245, 158, 11, ${alpha})`,
  };
  return map[id];
}

export function getSchemeStroke(id: SchemeId): string {
  const map: Record<SchemeId, string> = {
    A: '#3B82F6',
    B: '#10B981',
    C: '#F59E0B',
  };
  return map[id];
}
