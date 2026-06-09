import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Lock, Clock, Tag, Upload, Check, X, AlertTriangle, XCircle, FileDown,
  History as HistoryIcon, ChevronRight, Plus as PlusIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchTask, fetchLayers, fetchTaskHistory, fetchScreenshots, submitReview, uploadScreenshot } from '@/lib/api';
import type { ReviewTask, CadLayer, LayerHistory, Screenshot, LayerCategory, LayerStatus } from '@shared/types';
import Empty from '@/components/Empty';

const STATUS_LABELS: Record<LayerStatus, string> = { approved: '通过', needs_modify: '需修改', rejected: '驳回' };
const LAYER_CATS: (LayerCategory | 'all')[] = ['all', '给水', '排水', '暖通', '电气', '消防'];
const SUGGESTED_TAGS = ['2026.06 最新规范', '地下二层净空要求', '喷淋避让风管'];

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function setToast(msg: string) {
  const el = document.createElement('div');
  el.className = 'fixed top-5 right-5 z-[100] animate-fade-in-up card px-4 py-3 text-sm text-brand-200 border-brand-500/40';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export default function TaskDetail() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<ReviewTask | null>(null);
  const [layers, setLayers] = useState<CadLayer[]>([]);
  const [histories, setHistories] = useState<LayerHistory[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selLayerId, setSelLayerId] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<LayerCategory | 'all'>('all');
  const [status, setStatus] = useState<LayerStatus>('approved');
  const [opinion, setOpinion] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedShots, setSelectedShots] = useState<string[]>([]);
  const [showUpModal, setShowUpModal] = useState(false);
  const [upForm, setUpForm] = useState({ layerId: '', caption: '', standardTags: '' });
  const [upFile, setUpFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    if (!taskId) return;
    const [t, ls, hs, ss] = await Promise.all([fetchTask(taskId), fetchLayers(taskId), fetchTaskHistory(taskId), fetchScreenshots(taskId)]);
    setTask(t); setLayers(ls); setHistories(hs); setScreenshots(ss);
    if (!selLayerId && ls.length) setSelLayerId(ls[0].id);
  }

  useEffect(() => { loadAll(); }, [taskId]);

  const currentLayer = useMemo(() => layers.find((l) => l.id === selLayerId) || null, [layers, selLayerId]);
  const layerHistories = useMemo(() => histories.filter((h) => h.layerId === selLayerId).sort((a, b) => b.version - a.version), [histories, selLayerId]);
  const layerShots = useMemo(() => screenshots.filter((s) => s.layerId === selLayerId || !s.layerId), [screenshots, selLayerId]);
  const filteredLayers = useMemo(() => catFilter === 'all' ? layers : layers.filter((l) => l.category === catFilter), [layers, catFilter]);

  useEffect(() => {
    if (currentLayer) {
      setStatus(currentLayer.currentStatus);
      setOpinion(currentLayer.latestOpinion || '');
      setTags([]);
      setSelectedShots([]);
    }
  }, [selLayerId]);

  function addTag(t: string) {
    const v = t.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  }

  function removeTag(i: number) { setTags(tags.filter((_, idx) => idx !== i)); }

  async function handleSubmit() {
    if (!currentLayer) return;
    setSubmitting(true);
    try {
      await submitReview(currentLayer.id, { status, opinion, note, reviewer: '当前用户', standardTags: tags, screenshotIds: selectedShots });
      setToast('复核意见已提交');
      setNote('');
      loadAll();
    } finally { setSubmitting(false); }
  }

  async function handleUpload() {
    if (!taskId || !upFile) return;
    const fd = new FormData();
    fd.append('file', upFile);
    if (upForm.layerId) fd.append('layerId', upForm.layerId);
    fd.append('caption', upForm.caption);
    const tagArr = upForm.standardTags.split(',').map((s) => s.trim()).filter(Boolean);
    if (tagArr.length === 0) tagArr.push('未分类');
    fd.append('standardTags', JSON.stringify(tagArr));
    setSubmitting(true);
    try {
      await uploadScreenshot(taskId, fd);
      setShowUpModal(false);
      setUpForm({ layerId: '', caption: '', standardTags: '' });
      setUpFile(null);
      setToast('截图上传成功');
      loadAll();
    } finally { setSubmitting(false); }
  }

  if (!task) return <div className="p-10 text-center text-slate-400">加载中...</div>;

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-bg-border bg-bg-soft/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3 text-sm">
          <Link to="/" className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition"><ArrowLeft className="h-4 w-4" />返回任务列表</Link>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-slate-200 font-medium">{task.projectName}</span>
          <span className="chip bg-brand-600/20 text-brand-400 ml-2">{STATUS_LABELS[task.status as LayerStatus] || task.status}</span>
          <button className="btn-primary ml-auto px-3 py-1.5 text-xs" onClick={() => { fetch(`/api/tasks/${taskId}/export`, { method: 'POST' }); setToast('导出已开始'); }}>
            <FileDown className="h-3.5 w-3.5" />导出
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 p-6">
        <div className="card p-5">
          <h1 className="font-display text-xl font-bold text-white lg:text-2xl">{task.projectName}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
            <span>图纸版本：<b className="text-slate-200">{task.drawingVersion}</b></span>
            <span>CAD 来源：<b className="text-slate-200">{task.cadSource}</b></span>
            <span>创建：{fmt(task.createdAt)}</span>
            <span>更新：{fmt(task.updatedAt)}</span>
          </div>
          {task.description && <p className="mt-3 text-sm text-slate-300">{task.description}</p>}
        </div>

        <div className="grid gap-5 lg:grid-cols-[35%,65%]" style={{ minHeight: 'calc(100vh - 280px)' }}>
          <div className="card flex flex-col overflow-hidden">
            <div className="border-b border-bg-border p-3">
              <div className="flex flex-wrap gap-1.5">
                {LAYER_CATS.map((c) => (
                  <button key={c} onClick={() => setCatFilter(c)} className={cn('px-2.5 py-1 text-xs rounded transition', catFilter === c ? 'bg-brand-600 text-white' : 'bg-bg-elevated text-slate-400 hover:text-slate-200')}>
                    {c === 'all' ? '全部' : c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {filteredLayers.length === 0 ? <Empty /> : filteredLayers.map((l) => (
                <div key={l.id} onClick={() => setSelLayerId(l.id)} className={cn('cursor-pointer border-b border-bg-border/60 p-4 transition last:border-0 hover:bg-bg-elevated/50', selLayerId === l.id && 'bg-bg-elevated border-l-2 border-l-brand-500')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-300 truncate">{l.originalName}</span>
                    <span className={cn('chip shrink-0', l.currentStatus === 'approved' ? 'bg-green-500/20 text-green-400' : l.currentStatus === 'needs_modify' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400')}>{STATUS_LABELS[l.currentStatus]}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-200">{l.displayName} <span className="text-xs text-slate-500">· V{l.version}</span></div>
                  <div className="mt-1 text-xs text-slate-500">{l.category}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5 overflow-auto">
            {currentLayer ? (
              <>
                <div className="card p-5">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-sm text-brand-400">{currentLayer.originalName}</span>
                    <h2 className="font-display text-lg font-semibold text-white">{currentLayer.displayName}</h2>
                    <span className="chip bg-bg-elevated text-slate-400">V{currentLayer.version}</span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {[['分类', currentLayer.category], ['颜色', currentLayer.color], ['线型', currentLayer.lineType], ['创建', fmt(currentLayer.createdAt)], ['更新', fmt(currentLayer.updatedAt)]].map(([k, v]) => (
                      <div key={k} className="rounded-md bg-bg-soft p-3">
                        <div className="label">{k}</div>
                        <div className="mt-1 text-slate-200">{v}</div>
                      </div>
                    ))}
                    <div className="sm:col-span-2 rounded-md bg-bg-soft p-3">
                      <div className="label flex items-center gap-1"><Lock className="h-3 w-3" />原始图层名：不可修改</div>
                      <div className="mt-1 font-mono text-sm text-slate-400">{currentLayer.originalName}</div>
                    </div>
                  </div>
                </div>

                <div className="card p-5 space-y-4">
                  <h3 className="font-display text-base font-semibold text-white">改判操作</h3>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(['approved', 'needs_modify', 'rejected'] as LayerStatus[]).map((s) => (
                      <button key={s} onClick={() => setStatus(s)} className={cn('flex items-center justify-center gap-2 rounded-md border py-3 text-sm font-medium transition', status === s ? (s === 'approved' ? 'bg-green-600 border-green-500 text-white' : s === 'needs_modify' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-red-600 border-red-500 text-white') : 'border-bg-border bg-bg-soft text-slate-300 hover:bg-bg-elevated')}>
                        {s === 'approved' ? <Check className="h-4 w-4" /> : s === 'needs_modify' ? <AlertTriangle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="label mb-1.5 block">改判意见</label>
                    <textarea className="input min-h-[70px]" value={opinion} onChange={(e) => setOpinion(e.target.value)} placeholder="描述复核判定的原因和依据..." />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">补充备注</label>
                    <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="与改判意见分开，记录协调过程或其他说明" />
                  </div>
                  <div>
                    <label className="label mb-1.5 block">口径标签</label>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                        <button key={t} onClick={() => addTag(t)} className="chip border border-dashed border-bg-border text-slate-400 hover:border-brand-500 hover:text-brand-400">+ {t}</button>
                      ))}
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {tags.map((t, i) => (
                        <span key={i} className="chip bg-brand-600/20 text-brand-400 gap-1.5">{t}<button onClick={() => removeTag(i)}><X className="h-3 w-3" /></button></span>
                      ))}
                    </div>
                    <input className="input" placeholder="输入自定义标签后回车" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }} />
                  </div>
                  {screenshots.length > 0 && (
                    <div>
                      <label className="label mb-1.5 block">绑定截图（多选）</label>
                      <div className="max-h-40 overflow-auto space-y-1 rounded-md border border-bg-border bg-bg-soft p-2">
                        {screenshots.map((s) => (
                          <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-bg-elevated">
                            <input type="checkbox" checked={selectedShots.includes(s.id)} onChange={(e) => setSelectedShots(e.target.checked ? [...selectedShots, s.id] : selectedShots.filter((id) => id !== s.id))} className="rounded border-bg-border bg-bg-elevated" />
                            <img src={s.storedPath} className="h-8 w-12 rounded object-cover" alt="" />
                            <span className="truncate text-sm text-slate-300">{s.caption}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <button className="btn-primary w-full" disabled={submitting || !opinion} onClick={handleSubmit}>
                    {submitting ? '提交中...' : '提交复核意见'}
                  </button>
                </div>

                <div className="card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <HistoryIcon className="h-4 w-4 text-slate-400" />
                    <h3 className="font-display text-base font-semibold text-white">版本留痕</h3>
                    <Link to={`/tasks/${taskId}/history`} className="ml-auto text-xs text-brand-400 hover:text-brand-300">查看对比 →</Link>
                  </div>
                  {layerHistories.length === 0 ? <Empty title="暂无历史" /> : (
                    <div className="relative pl-6 before:absolute before:left-2 before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-bg-border">
                      {layerHistories.map((h, i) => (
                        <div key={h.id} className={cn('relative pb-5 last:pb-0', i !== layerHistories.length - 1 && 'animate-slide-x')} style={{ animationDelay: `${i * 40}ms` }}>
                          <div className={cn('absolute -left-4 top-1 h-4 w-4 rounded-full border-2 border-bg-card', h.status === 'approved' ? 'bg-green-500' : h.status === 'needs_modify' ? 'bg-orange-500' : 'bg-red-500')} />
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold text-white">V{h.version}</span>
                            <span className={cn('chip text-[10px]', h.status === 'approved' ? 'bg-green-500/20 text-green-400' : h.status === 'needs_modify' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400')}>{STATUS_LABELS[h.status]}</span>
                            <span className="ml-auto text-xs text-slate-500">{fmt(h.reviewedAt)}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-300">{h.opinion}</p>
                          {h.note && <p className="mt-1 text-xs text-slate-500">备注：{h.note}</p>}
                          {h.standardTags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{h.standardTags.map((t) => <span key={t} className="chip bg-bg-elevated text-slate-400 text-[10px]">{t}</span>)}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-400" />
                    <h3 className="font-display text-base font-semibold text-white">关联截图</h3>
                    <button onClick={() => setShowUpModal(true)} className="btn-primary ml-auto px-3 py-1.5 text-xs">
                      <Upload className="h-3.5 w-3.5" />上传截图
                    </button>
                  </div>
                  {layerShots.length === 0 ? <Empty title="暂无截图" description="上传截图后将展示在这里" /> : (
                    <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {layerShots.map((s) => (
                        <div key={s.id} className="group overflow-hidden rounded-md border border-bg-border bg-bg-soft">
                          <img src={s.storedPath} className="h-32 w-full object-cover transition group-hover:scale-[1.02]" alt={s.caption} />
                          <div className="p-3">
                            <p className="truncate text-sm text-slate-200">{s.caption}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {s.standardTags.map((t) => <span key={t} className="chip bg-brand-600/20 text-brand-400 text-[10px]">{t}</span>)}
                            </div>
                            {s.layerId && <p className="mt-2 font-mono text-xs text-slate-500 truncate">{layers.find((l) => l.id === s.layerId)?.originalName} · V{s.boundVersion}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : <Empty title="请选择左侧图层" />}
          </div>
        </div>
      </div>

      {showUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between border-b border-bg-border p-4">
              <h3 className="font-display text-lg font-semibold text-white">上传截图</h3>
              <button onClick={() => setShowUpModal(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="label mb-1.5 block">绑定图层</label>
                <select className="input" value={upForm.layerId} onChange={(e) => setUpForm({ ...upForm, layerId: e.target.value })}>
                  <option value="">任务级（不绑定）</option>
                  {layers.map((l) => <option key={l.id} value={l.id}>{l.displayName} - {l.originalName}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">图片说明 caption</label>
                <input className="input" value={upForm.caption} onChange={(e) => setUpForm({ ...upForm, caption: e.target.value })} placeholder="如：地下一层管井交叉处" />
              </div>
              <div>
                <label className="label mb-1.5 block">口径标签（逗号分隔）</label>
                <input className="input" value={upForm.standardTags} onChange={(e) => setUpForm({ ...upForm, standardTags: e.target.value })} placeholder="如：GB50015-2019,09S304" />
              </div>
              <div>
                <label className="label mb-1.5 block">文件 *</label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-bg-border bg-bg-soft p-6 text-slate-400 hover:border-brand-500 hover:text-brand-400">
                  <PlusIcon className="h-6 w-6" />
                  <span className="text-sm">{upFile ? upFile.name : '点击选择图片文件（jpg/png/webp 上限10MB）'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setUpFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-bg-border p-4">
              <button className="btn-ghost" onClick={() => setShowUpModal(false)}>取消</button>
              <button className="btn-primary" disabled={submitting || !upFile} onClick={handleUpload}>{submitting ? '上传中...' : '确认上传'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
