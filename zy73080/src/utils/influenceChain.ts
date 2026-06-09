import type {
  InfluenceNode,
  MaterialItem,
  Remark,
  Anomaly,
  ReviewConclusion,
  Component,
} from '@/types';

const STATUS_MAP: Record<string, InfluenceNode['status']> = {
  true: 'warning',
  严重: 'danger',
  一般: 'warning',
  轻微: 'info',
};

export function buildInfluenceChain(
  conclusion: ReviewConclusion | undefined,
  materials: MaterialItem[],
  remarks: Remark[],
  anomalies: Anomaly[],
  components: Component[],
): InfluenceNode[] {
  if (!conclusion) {
    return [];
  }

  const statusNode: InfluenceNode['status'] =
    conclusion.status === '通过'
      ? 'ok'
      : conclusion.status === '不通过'
        ? 'danger'
        : 'warning';

  const materialChildren: InfluenceNode[] = conclusion.affectedMaterialIds
    .map((mid) => materials.find((m) => m.id === mid || (mid.endsWith('n') && m.id === mid.slice(0, -1))))
    .filter(Boolean)
    .map((m: MaterialItem, i) => {
      const cmp = components.find((c) => c.id === m.componentId);
      return {
        id: `mat-${m.id}`,
        kind: 'material' as const,
        title: m.materialName,
        subtitle: `${cmp?.name ?? '未关联构件'} · 送审 ${m.submissionSpec} ⇄ 施工 ${m.constructionSpec}`,
        weight: 0.6 + i * 0.05,
        status: m.isMismatch ? 'warning' : 'ok',
      } as InfluenceNode;
    });

  const remarkChildren: InfluenceNode[] = conclusion.affectedRemarkIds
    .map((rid) => remarks.find((r) => r.id === rid))
    .filter(Boolean)
    .map((r: Remark, i) => ({
      id: `rmk-${r.id}`,
      kind: 'remark' as const,
      title: `[${r.type}] ${r.author}`,
      subtitle: r.content.length > 40 ? r.content.slice(0, 40) + '…' : r.content,
      weight: 0.7 - i * 0.08,
      status: r.type === '口头' ? 'info' : r.type === '后补' ? 'warning' : 'ok',
    } as InfluenceNode));

  const anomalyChildren: InfluenceNode[] = conclusion.affectedAnomalyIds
    .map((aid) => anomalies.find((a) => a.id === aid))
    .filter(Boolean)
    .map((a: Anomaly) => {
      const cmp = components.find((c) => c.id === a.componentId);
      const offsetParts = [
        a.offsetX ? `X${a.offsetX > 0 ? '+' : ''}${a.offsetX}mm` : '',
        a.offsetY ? `Y${a.offsetY > 0 ? '+' : ''}${a.offsetY}mm` : '',
        a.offsetZ ? `Z${a.offsetZ > 0 ? '+' : ''}${a.offsetZ}mm` : '',
      ].filter(Boolean);
      return {
        id: `anom-${a.id}`,
        kind: 'anomaly' as const,
        title: `${a.type} · ${cmp?.name ?? '未知构件'}`,
        subtitle: `${offsetParts.join(' ')} · ${a.severity}`,
        weight: 0.9,
        status: STATUS_MAP[a.severity] ?? 'warning',
      } as InfluenceNode;
    });

  const root: InfluenceNode = {
    id: conclusion.id,
    kind: 'conclusion',
    title: `复核结论：${conclusion.status}`,
    subtitle: `生成时间 ${new Date(conclusion.generatedAt).toLocaleString('zh-CN')}`,
    weight: 1,
    status: statusNode,
    children: [
      materialChildren.length > 0 && {
        id: 'grp-mat',
        kind: 'material',
        title: `材料口径差异 (${materialChildren.length})`,
        weight: 0.5,
        status: materialChildren.some((c) => c.status === 'warning') ? 'warning' : 'ok',
        children: materialChildren,
      } as InfluenceNode,
      remarkChildren.length > 0 && {
        id: 'grp-rmk',
        kind: 'remark',
        title: `备注修正 (${remarkChildren.length})`,
        weight: 0.4,
        status: remarkChildren.some((c) => c.status !== 'ok') ? 'info' : 'ok',
        children: remarkChildren,
      } as InfluenceNode,
      anomalyChildren.length > 0 && {
        id: 'grp-anom',
        kind: 'anomaly',
        title: `异常项 (${anomalyChildren.length})`,
        weight: 0.85,
        status: anomalyChildren.some((c) => c.status === 'danger') ? 'danger' : 'warning',
        children: anomalyChildren,
      } as InfluenceNode,
    ].filter(Boolean) as InfluenceNode[],
  };

  return [root];
}
