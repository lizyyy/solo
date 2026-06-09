import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, GitBranch, CalendarDays, Eye } from 'lucide-react';
import type { Batch } from '@/shared/types';

const STATUS_META: Record<Batch['status'], { label: string; cls: string; icon: React.ElementType }> = {
  normal: { label: '正常', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  issue: { label: '有疑点', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  hold: { label: '暂缓', cls: 'bg-red-100 text-red-700 border-red-200', icon: PauseCircle },
  draft: { label: '草稿', cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
};

interface Props {
  batch: Batch;
  compact?: boolean;
}

export function BatchCard({ batch, compact }: Props) {
  const nav = useNavigate();
  const meta = STATUS_META[batch.status];
  const Icon = meta.icon;

  const matched = batch.items.filter((i) => i.matchStatus === 'matched').length;
  const mis = batch.items.filter((i) => i.matchStatus === 'mismatched').length;
  const pending = batch.items.filter((i) => i.matchStatus === 'pending').length;
  const blocking = batch.issues.filter((i) => i.blocksFinalReport).length;

  return (
    <div
      onClick={() => nav(`/checklist/${batch.batchId}`)}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg ${compact ? '' : 'bg-[linear-gradient(135deg,rgba(30,64,175,0.03),transparent_60%)]'}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(30,64,175,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.06) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {batch.runType === 'rerun' && (
              <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9.5px] text-indigo-600 font-bold">
                <GitBranch className="h-2.5 w-2.5" /> 重跑
              </span>
            )}
            <span
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}
            >
              <Icon className="h-2.5 w-2.5" />
              {meta.label}
            </span>
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            {batch.name}
          </div>
          <div className="mt-0.5 text-[10.5px] text-slate-500 font-mono">{batch.batchId}</div>
          {batch.parentBatchId && (
            <div className="mt-0.5 text-[10px] text-indigo-500">
              父批次：{batch.parentBatchId}
            </div>
          )}
        </div>
        <button className="pointer-events-none rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 opacity-0 shadow-sm transition-all group-hover:pointer-events-auto group-hover:opacity-100 group-hover:border-blue-400 group-hover:text-blue-600">
          <Eye className="h-3 w-3 inline mr-0.5" /> 打开
        </button>
      </div>

      <div className="relative mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px]">
        <div className="rounded-md bg-slate-50 p-1.5">
          <div className="text-sm font-bold text-slate-800">{batch.items.length}</div>
          <div className="text-[9px] text-slate-500">构件总数</div>
        </div>
        <div className="rounded-md bg-emerald-50 p-1.5">
          <div className="text-sm font-bold text-emerald-700">{matched}</div>
          <div className="text-[9px] text-emerald-600">已对齐</div>
        </div>
        <div className="rounded-md bg-amber-50 p-1.5">
          <div className="text-sm font-bold text-amber-700">{mis}</div>
          <div className="text-[9px] text-amber-600">口径对不上</div>
        </div>
        <div className={`rounded-md p-1.5 ${blocking > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
          <div className={`text-sm font-bold ${blocking > 0 ? 'text-red-700' : 'text-slate-600'}`}>
            {batch.issues.length}
          </div>
          <div className={`text-[9px] ${blocking > 0 ? 'text-red-600' : 'text-slate-500'}`}>
            疑点{blocking > 0 ? `（${blocking}暂缓）` : ''}
          </div>
        </div>
      </div>

      <div className="relative mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1">
          <CalendarDays className="h-2.5 w-2.5" />
          {new Date(batch.createdAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 17)}
        </div>
        {pending > 0 && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">资料不齐 {pending}</span>
        )}
      </div>
    </div>
  );
}
