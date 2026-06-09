import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchLayers, fetchTaskHistory, compareVersions } from '@/lib/api';
import type { VersionDiff } from '@/lib/api';
import type { CadLayer, LayerHistory, LayerStatus } from '@shared/types';
import Empty from '@/components/Empty';

const STATUS_LABELS: Record<LayerStatus, string> = { approved: '通过', needs_modify: '需修改', rejected: '驳回' };
const STATUS_COLORS: Record<LayerStatus, string> = { approved: 'bg-green-500/20 text-green-400', needs_modify: 'bg-orange-500/20 text-orange-400', rejected: 'bg-red-500/20 text-red-400' };
const FIELD_LABELS: Record<string, string> = { status: '复核状态', opinion: '改判意见', note: '补充备注', standardTags: '口径标签', screenshotIds: '绑定截图' };

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function valString(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isChanged(v1: unknown, v2: unknown): boolean {
  if (Array.isArray(v1) && Array.isArray(v2)) {
    return JSON.stringify([...v1].sort()) !== JSON.stringify([...v2].sort());
  }
  return v1 !== v2;
}

function getFieldChange(field: string, diff: VersionDiff) {
  const added = diff.added?.[field as keyof typeof diff.added];
  const removed = diff.removed?.[field as keyof typeof diff.removed];
  const modified = diff.modified?.[field as keyof typeof diff.modified];
  return { added, removed, modified };
}

function renderDiff(field: string, v1Val: unknown, v2Val: unknown, diff: VersionDiff) {
  const { added, removed, modified } = getFieldChange(field, diff);
  const changed = added !== undefined || removed !== undefined || modified !== undefined || isChanged(v1Val, v2Val);
  const before = modified?.from ?? v1Val;
  const after = modified?.to ?? v2Val;

  if (added !== undefined || (v1Val === undefined && after !== undefined)) {
    const val = added ?? after;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-bg-soft p-3"><div className="label mb-1 text-slate-500">旧版本</div><div className="text-sm text-slate-400">—</div></div>
        <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3"><div className="label mb-1 text-green-400">新增 (added)</div><div className="text-sm text-green-300">{valString(val)}</div></div>
      </div>
    );
  }
  if (removed !== undefined || (after === undefined && v1Val !== undefined)) {
    const val = removed ?? before;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3"><div className="label mb-1 text-red-400">删除 (removed)</div><div className="text-sm line-through text-red-300">{valString(val)}</div></div>
        <div className="rounded-md bg-bg-soft p-3"><div className="label mb-1 text-slate-500">新版本</div><div className="text-sm text-slate-400">—</div></div>
      </div>
    );
  }
  if (changed) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-bg-soft p-3"><div className="label mb-1 text-slate-500">旧版本</div><div className="text-sm text-slate-300">{field === 'status' && typeof before === 'string' ? STATUS_LABELS[before as LayerStatus] : valString(before)}</div></div>
        <div className="rounded-md border border-orange-500/40 bg-orange-500/10 p-3"><div className="label mb-1 text-orange-400">修改 (modified)</div><div className="text-sm text-orange-300">{field === 'status' && typeof after === 'string' ? STATUS_LABELS[after as LayerStatus] : valString(after)}</div></div>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-md bg-bg-soft p-3"><div className="label mb-1 text-slate-500">旧版本</div><div className="text-sm text-slate-300">{field === 'status' && typeof v1Val === 'string' ? STATUS_LABELS[v1Val as LayerStatus] : valString(v1Val)}</div></div>
      <div className="rounded-md bg-bg-soft p-3"><div className="label mb-1 text-slate-500">新版本</div><div className="text-sm text-slate-300">{field === 'status' && typeof v2Val === 'string' ? STATUS_LABELS[v2Val as LayerStatus] : valString(v2Val)}</div></div>
    </div>
  );
}

export default function HistoryPage() {
  const { taskId } = useParams();
  const [layers, setLayers] = useState<CadLayer[]>([]);
  const [histories, setHistories] = useState<LayerHistory[]>([]);
  const [layerId, setLayerId] = useState('');
  const [v1, setV1] = useState<number>(0);
  const [v2, setV2] = useState<number>(0);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!taskId) return;
    const [ls, hs] = await Promise.all([fetchLayers(taskId), fetchTaskHistory(taskId)]);
    setLayers(ls); setHistories(hs);
    if (ls.length) setLayerId(ls[0].id);
  }

  useEffect(() => { load(); }, [taskId]);

  const layerVersions = useMemo(() => histories.filter((h) => h.layerId === layerId).sort((a, b) => a.version - b.version), [histories, layerId]);

  useEffect(() => {
    if (layerVersions.length >= 2) {
      setV1(layerVersions[0].version);
      setV2(layerVersions[layerVersions.length - 1].version);
    } else {
      setV1(0); setV2(0); setDiff(null);
    }
  }, [layerId, layerVersions.length]);

  useEffect(() => {
    if (!taskId || !layerId || !v1 || !v2 || v1 === v2) { setDiff(null); return; }
    let alive = true;
    setLoading(true);
    compareVersions(taskId, layerId, v1, v2).then((r) => { if (alive) { setDiff(r.diff); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId, layerId, v1, v2]);

  const h1 = layerVersions.find((h) => h.version === v1);
  const h2 = layerVersions.find((h) => h.version === v2);
  const changedFields = diff
    ? [
        ...new Set([
          ...Object.keys(diff.added || {}),
          ...Object.keys(diff.removed || {}),
          ...Object.keys(diff.modified || {}),
        ]),
      ]
    : [];
  const fieldsToShow = ['status', 'opinion', 'note', 'standardTags'];

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-bg-border bg-bg-soft/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3 text-sm">
          <Link to={`/tasks/${taskId}`} className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition"><ArrowLeft className="h-4 w-4" />返回详情</Link>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-slate-200 font-medium">历史版本对比</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 p-6">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-brand-500" />
            <h2 className="font-display text-lg font-semibold text-white">选择对比版本</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label mb-1.5 block">选择图层</label>
              <select className="input" value={layerId} onChange={(e) => setLayerId(e.target.value)}>
                {layers.map((l) => <option key={l.id} value={l.id}>{l.displayName} ({l.originalName})</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">版本 V1（旧）</label>
              <select className="input" value={v1} onChange={(e) => setV1(Number(e.target.value))}>
                <option value={0}>请选择</option>
                {layerVersions.map((h) => <option key={h.id} value={h.version}>V{h.version} · {fmt(h.reviewedAt)}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">版本 V2（新）</label>
              <select className="input" value={v2} onChange={(e) => setV2(Number(e.target.value))}>
                <option value={0}>请选择</option>
                {layerVersions.map((h) => <option key={h.id} value={h.version}>V{h.version} · {fmt(h.reviewedAt)}</option>)}
              </select>
            </div>
          </div>
          {v1 && v2 && v1 >= v2 && <p className="mt-3 text-xs text-orange-400">提示：V1 应小于 V2，才能正确展示「旧 → 新」的变化</p>}
        </div>

        {h1 && h2 ? (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="card overflow-hidden">
                <div className="border-b border-bg-border bg-bg-soft/80 p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-bold text-white">V{h1.version}</span>
                    <span className={cn('chip', STATUS_COLORS[h1.status])}>{STATUS_LABELS[h1.status]}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">审核时间：{fmt(h1.reviewedAt)}</p>
                  <p className="text-xs text-slate-400">审核人：{h1.reviewer}</p>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  {[['复核状态', STATUS_LABELS[h1.status]], ['改判意见', h1.opinion], ['补充备注', h1.note || '—'], ['口径标签', h1.standardTags.join(', ') || '—']].map(([k, v]) => (
                    <div key={k} className="flex gap-2"><span className="label w-20 shrink-0">{k}</span><span className="text-slate-300">{v}</span></div>
                  ))}
                </div>
              </div>
              <div className="card overflow-hidden">
                <div className="border-b border-bg-border bg-brand-600/10 p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-bold text-white">V{h2.version}</span>
                    <span className={cn('chip', STATUS_COLORS[h2.status])}>{STATUS_LABELS[h2.status]}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">审核时间：{fmt(h2.reviewedAt)}</p>
                  <p className="text-xs text-slate-400">审核人：{h2.reviewer}</p>
                </div>
                <div className="p-4 space-y-2 text-sm">
                  {[['复核状态', STATUS_LABELS[h2.status]], ['改判意见', h2.opinion], ['补充备注', h2.note || '—'], ['口径标签', h2.standardTags.join(', ') || '—']].map(([k, v]) => (
                    <div key={k} className="flex gap-2"><span className="label w-20 shrink-0">{k}</span><span className="text-slate-300">{v}</span></div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-4 font-display text-base font-semibold text-white">字段差异对比</h3>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-md bg-bg-soft" />)}
                </div>
              ) : diff ? (
                <div className="space-y-5">
                  {fieldsToShow.map((f) => (
                    <div key={f}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-medium text-slate-200">{FIELD_LABELS[f] || f}</span>
                        {changedFields.includes(f) && (
                          <span className="chip text-[10px] bg-brand-600/30 text-brand-300">有变化</span>
                        )}
                      </div>
                      {renderDiff(f, h1[f as keyof LayerHistory], h2[f as keyof LayerHistory], diff)}
                    </div>
                  ))}
                </div>
              ) : <Empty title="暂无可对比数据" />}
            </div>

            {changedFields.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 font-display text-base font-semibold text-white">变更字段列表</h3>
                <div className="flex flex-wrap gap-2">
                  {changedFields.map((f) => {
                    const { added, removed } = getFieldChange(f, diff!);
                    let type = '修改';
                    if (added !== undefined) type = '新增';
                    else if (removed !== undefined) type = '删除';
                    return (
                      <span key={f} className="chip bg-bg-elevated text-slate-300 border border-bg-border">
                        {type} · {FIELD_LABELS[f] || f}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : <Empty title="请选择两个不同版本进行对比" description={layerVersions.length < 2 ? '当前图层历史版本不足 2 个' : '请在上方下拉框选择 V1 和 V2'} />}
      </div>
    </div>
  );
}
