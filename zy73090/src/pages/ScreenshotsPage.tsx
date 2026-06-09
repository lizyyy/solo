import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Upload, Download, Trash2, RefreshCw, Plus, X } from 'lucide-react';
import { fetchLayers, fetchScreenshots, uploadScreenshot, deleteScreenshot } from '@/lib/api';
import type { CadLayer, Screenshot } from '@shared/types';
import Empty from '@/components/Empty';

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function setToast(msg: string) {
  const el = document.createElement('div');
  el.className = 'fixed top-5 right-5 z-[100] animate-fade-in-up card px-4 py-3 text-sm text-brand-200 border-brand-500/40';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export default function ScreenshotsPage() {
  const { taskId } = useParams();
  const [layers, setLayers] = useState<CadLayer[]>([]);
  const [shots, setShots] = useState<Screenshot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ layerId: '', caption: '', standardTags: '' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!taskId) return;
    const [ls, ss] = await Promise.all([fetchLayers(taskId), fetchScreenshots(taskId)]);
    setLayers(ls); setShots(ss.filter((s) => !s.isDeleted));
  }

  useEffect(() => { load(); }, [taskId]);

  async function handleUpload() {
    if (!taskId || !file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (form.layerId) fd.append('layerId', form.layerId);
    fd.append('caption', form.caption);
    const tagArr = form.standardTags.split(',').map((s) => s.trim()).filter(Boolean);
    if (tagArr.length === 0) tagArr.push('未分类');
    fd.append('standardTags', JSON.stringify(tagArr));
    setLoading(true);
    try {
      await uploadScreenshot(taskId, fd);
      setShowModal(false);
      setForm({ layerId: '', caption: '', standardTags: '' });
      setFile(null);
      setToast('截图上传成功');
      load();
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这张截图吗？')) return;
    try {
      await deleteScreenshot(id);
      setToast('截图已删除');
      load();
    } catch (e) {
      setToast('删除失败');
    }
  }

  function handleDownload(s: Screenshot) {
    window.open(`/api/screenshots/${s.id}/download`, '_blank');
  }

  function handleReplace(_s: Screenshot) {
    setToast('请删除后重新上传（替换功能演示）');
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-bg-border bg-bg-soft/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3 text-sm">
          <Link to={`/tasks/${taskId}`} className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition"><ArrowLeft className="h-4 w-4" />返回详情</Link>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-slate-200 font-medium">截图管理</span>
          <button onClick={() => setShowModal(true)} className="btn-primary ml-auto px-3 py-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" />上传截图
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        {shots.length === 0 ? (
          <Empty title="暂无截图" description="点击右上角「上传截图」开始添加" />
        ) : (
          <div className="stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shots.map((s) => {
              const boundLayer = layers.find((l) => l.id === s.layerId);
              return (
                <div key={s.id} className="card group overflow-hidden transition hover:shadow-hover">
                  <div className="relative">
                    <img src={s.storedPath} alt={s.caption} className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => handleDownload(s)} className="rounded-md bg-black/60 p-2 text-slate-200 hover:bg-brand-600 hover:text-white backdrop-blur" title="下载"><Download className="h-4 w-4" /></button>
                      <button onClick={() => handleReplace(s)} className="rounded-md bg-black/60 p-2 text-slate-200 hover:bg-brand-600 hover:text-white backdrop-blur" title="替换"><RefreshCw className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="rounded-md bg-black/60 p-2 text-slate-200 hover:bg-red-600 hover:text-white backdrop-blur" title="删除"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="absolute bottom-2 left-2 chip bg-black/60 text-white text-[10px] backdrop-blur">{fmtSize(s.fileSize)}</div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <p className="font-medium text-slate-100 line-clamp-1">{s.caption || '无标题'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">上传于 {fmt(s.uploadedAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.standardTags.map((t, i) => (
                        <span key={i} className={`chip text-[10px] ${i % 2 === 0 ? 'bg-brand-600/20 text-brand-400' : 'bg-orange-500/20 text-orange-400'}`}>{t}</span>
                      ))}
                    </div>
                    {boundLayer && (
                      <div className="border-t border-bg-border/50 pt-3">
                        <p className="font-mono text-xs text-slate-400 truncate">{boundLayer.originalName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{boundLayer.displayName}{s.boundVersion !== undefined && ` · 绑定 V${s.boundVersion}`}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between border-b border-bg-border p-4">
              <h3 className="font-display text-lg font-semibold text-white">上传截图</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="label mb-1.5 block">绑定图层</label>
                <select className="input" value={form.layerId} onChange={(e) => setForm({ ...form, layerId: e.target.value })}>
                  <option value="">任务级（不绑定）</option>
                  {layers.map((l) => <option key={l.id} value={l.id}>{l.displayName} - {l.originalName}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1.5 block">图片说明 caption</label>
                <input className="input" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="如：地下一层管井交叉处" />
              </div>
              <div>
                <label className="label mb-1.5 block">口径标签（逗号分隔）</label>
                <input className="input" value={form.standardTags} onChange={(e) => setForm({ ...form, standardTags: e.target.value })} placeholder="如：GB50015-2019,09S304,喷淋避让" />
              </div>
              <div>
                <label className="label mb-1.5 block">文件 *</label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-bg-border bg-bg-soft p-6 text-slate-400 hover:border-brand-500 hover:text-brand-400">
                  <Plus className="h-6 w-6" />
                  <span className="text-sm">{file ? file.name : '点击选择图片（jpg/png/webp 上限10MB）'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-bg-border p-4">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn-primary" disabled={loading || !file} onClick={handleUpload}>{loading ? '上传中...' : '确认上传'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
