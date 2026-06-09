import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Layers, AlertTriangle, Clock, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchTasks, createTask } from '@/lib/api';
import type { ReviewTask, TaskStatus } from '@shared/types';
import Empty from '@/components/Empty';

const STATUS_TABS: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待复核' },
  { key: 'in_progress', label: '复核中' },
  { key: 'completed', label: '已完成' },
  { key: 'has_legacy', label: '有遗留' },
];

const STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-status-pending',
  in_progress: 'bg-status-in_progress',
  completed: 'bg-status-completed',
  has_legacy: 'bg-status-has_legacy',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TaskList() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TaskStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ projectName: '', drawingVersion: '', cadSource: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchTasks(activeStatus === 'all' ? undefined : activeStatus, search || undefined);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [activeStatus, search]);

  async function handleCreate() {
    if (!form.projectName || !form.drawingVersion || !form.cadSource) return;
    setSubmitting(true);
    try {
      await createTask(form);
      setShowModal(false);
      setForm({ projectName: '', drawingVersion: '', cadSource: '', description: '' });
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg p-6 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-white">复核任务</h1>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="搜索项目名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4" /> 新建任务
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveStatus(t.key)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                activeStatus === t.key
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-bg-card text-slate-400 hover:text-slate-200 border border-bg-border',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card h-48 animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <Empty title="暂无任务" description="点击右上角「新建任务」创建第一个复核任务" />
        ) : (
          <div className="stagger grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                className="card group relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-hover"
              >
                <div className={cn('absolute left-0 top-0 h-full w-1.5', STATUS_BAR_COLORS[task.status])} />
                <div className="p-5 pl-6">
                  <h3 className="font-display text-lg font-semibold text-white">{task.projectName}</h3>
                  <p className="mt-1 text-xs text-slate-500">图纸版本 · {task.drawingVersion}</p>
                  {task.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-slate-400">{task.description}</p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-brand-500" />
                      <span className="chip bg-brand-600/20 text-brand-400">{task.layerCount}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className={cn('h-3.5 w-3.5', task.openIssueCount > 0 ? 'text-orange-500' : 'text-slate-500')} />
                      <span className={cn('chip', task.openIssueCount > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-bg-elevated text-slate-400')}>
                        {task.openIssueCount}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 ml-auto">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(task.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between border-b border-bg-border p-4">
              <h3 className="font-display text-lg font-semibold text-white">新建复核任务</h3>
              <button className="text-slate-400 hover:text-white" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="label mb-1.5 block">项目名称 *</label>
                <input className="input" value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} placeholder="如：城东科创园A栋办公楼" />
              </div>
              <div>
                <label className="label mb-1.5 block">图纸版本 *</label>
                <input className="input" value={form.drawingVersion} onChange={(e) => setForm({ ...form, drawingVersion: e.target.value })} placeholder="如：V1.0" />
              </div>
              <div>
                <label className="label mb-1.5 block">CAD 来源 *</label>
                <input className="input" value={form.cadSource} onChange={(e) => setForm({ ...form, cadSource: e.target.value })} placeholder="如：华建集团上海院" />
              </div>
              <div>
                <label className="label mb-1.5 block">任务描述</label>
                <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="可选：复核范围、重点关注点等" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-bg-border p-4">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn-primary" disabled={submitting || !form.projectName || !form.drawingVersion || !form.cadSource} onClick={handleCreate}>
                {submitting ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
