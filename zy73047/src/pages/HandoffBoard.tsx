import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '@/store/useScheduleStore';
import { ConclusionBadge, HandoffBadge } from '@/components/Badges';
import Modal from '@/components/Modal';
import type { HandoffStatus } from '@/types';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowRight,
  Package,
  GripVertical,
  Check,
} from 'lucide-react';
import { cn, formatDateTime, handoffMeta } from '@/lib/utils';

export default function HandoffBoard() {
  const nav = useNavigate();
  const { schedules, getHandoffGroups, setHandoffStatus, getMaterialsBySchedule } =
    useScheduleStore();
  const groups = getHandoffGroups();
  const [confirm, setConfirm] = useState<{ id: string; to: HandoffStatus } | null>(null);

  const applyConfirm = () => {
    if (!confirm) return;
    setHandoffStatus(confirm.id, confirm.to, '运营主管-王工');
    setConfirm(null);
  };

  const Column = ({
    title,
    icon: Icon,
    items,
    accent,
    target,
  }: {
    title: string;
    icon: any;
    items: typeof schedules;
    accent: string;
    target: HandoffStatus;
  }) => (
    <div className={cn('rounded-lg border p-4 min-h-[420px] flex flex-col', handoffMeta[target].bg)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center text-white',
              accent
            )}
          >
            <Icon size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{title}</h3>
            <div className="text-[11px] text-slate-500">共 {items.length} 项</div>
          </div>
        </div>
        <div className="text-3xl font-bold text-slate-800 tabular-nums">{items.length}</div>
      </div>
      <div className="flex-1 space-y-2 overflow-auto pr-1">
        {items.length === 0 && (
          <div className="h-full min-h-[200px] flex items-center justify-center text-xs text-slate-400 border-2 border-dashed border-slate-300/70 rounded-md bg-white/40">
            暂无
          </div>
        )}
        {items.map((s) => {
          const mats = getMaterialsBySchedule(s.id);
          return (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-md p-3 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[12px] font-bold text-slate-800">
                      {s.scheduleNo}
                    </span>
                    <ConclusionBadge value={s.conclusion} />
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                    {s.bridgeName} · {s.position}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                    更新于 {formatDateTime(s.updatedAt)}
                  </div>
                </div>
                <GripVertical size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mb-2 text-xs text-slate-700 leading-snug line-clamp-2 border-l-2 border-slate-200 pl-2">
                {s.primaryRemark}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] flex items-center gap-1 text-slate-500">
                  <Package size={10} />
                  {mats.length
                    ? `材料：${mats.map((m) => m.batchNo).join(',')}`
                    : '⚠ 未关联材料'}
                </div>
                <div className="flex items-center gap-1">
                  {target !== 'releasable' && mats.length > 0 && s.conclusion !== 'anomaly' && (
                    <button
                      onClick={() => setConfirm({ id: s.id, to: 'releasable' })}
                      className="text-[10px] px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 flex items-center gap-0.5"
                    >
                      置为可放行 <ArrowRight size={10} />
                    </button>
                  )}
                  {target === 'releasable' && (
                    <button
                      onClick={() => setConfirm({ id: s.id, to: 'pending' })}
                      className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      回退待确认
                    </button>
                  )}
                  {target === 'missing_material' && (
                    <button
                      onClick={() => setConfirm({ id: s.id, to: 'pending' })}
                      className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      先入待确认
                    </button>
                  )}
                  <button
                    onClick={() => nav(`/schedules/${s.id}`)}
                    className="text-[10px] px-2 py-1 rounded bg-slate-800 text-white hover:bg-slate-900 flex items-center gap-0.5"
                  >
                    查看 <ChevronRight size={10} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const confirmSch = confirm ? schedules.find((s) => s.id === confirm.id) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            交接状态看板
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            运营主管临走前核对：哪些可放行、哪些还缺材料；卡片右上角按钮可快速切换状态。
          </p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
            <CheckCircle2 size={12} className="text-emerald-600" /> 可放行
            <span className="font-bold tabular-nums ml-1">{groups.releasable.length}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
            <AlertTriangle size={12} className="text-amber-600" /> 缺材料
            <span className="font-bold tabular-nums ml-1">{groups.missing.length}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 text-slate-600">
            <Clock size={12} className="text-slate-500" /> 待确认
            <span className="font-bold tabular-nums ml-1">{groups.pending.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Column
          title="可放行"
          icon={CheckCircle2}
          items={groups.releasable}
          accent="bg-emerald-500"
          target="releasable"
        />
        <Column
          title="待确认"
          icon={Clock}
          items={groups.pending}
          accent="bg-slate-500"
          target="pending"
        />
        <Column
          title="缺材料 · 不可放行"
          icon={AlertTriangle}
          items={groups.missing}
          accent="bg-amber-500"
          target="missing_material"
        />
      </div>

      {confirmSch && (
        <Modal
          open
          onClose={() => setConfirm(null)}
          title={`确认切换 ${confirmSch.scheduleNo} 交接状态`}
          footer={
            <>
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-1.5 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={applyConfirm}
                className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
              >
                <Check size={14} /> 确认切换
              </button>
            </>
          }
        >
          <div className="text-sm space-y-3">
            <div>
              桥梁：<span className="font-medium text-slate-800">{confirmSch.bridgeName}</span>
              <span className="mx-1 text-slate-400">·</span>
              位置：<span className="font-medium text-slate-800">{confirmSch.position}</span>
            </div>
            <div className="flex items-center gap-2">
              <HandoffBadge value={confirmSch.handoff} />
              <ArrowRight size={16} className="text-slate-400" />
              <HandoffBadge value={confirm!.to} />
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-2.5 leading-relaxed">
              操作人：运营主管-王工 · 操作将记入更新时间。
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
