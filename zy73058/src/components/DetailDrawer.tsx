import { useState } from 'react';
import { useReviewStore } from '@/store/reviewStore';
import { StatusBadge, ChangeTypeBadge } from './Badges';
import { ChangeTimeline } from './ChangeTimeline';
import { RawSnapshot } from './RawSnapshot';
import { SparePartSourceModal } from './SparePartSourceModal';
import type { ReviewStatus } from '@/types';
import {
  X,
  User,
  Clock,
  Wrench,
  Building2,
  FileText,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  ExternalLink,
  Hash,
  ListTree,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';

export function DetailDrawer() {
  const {
    records,
    activeRecordId,
    setActiveRecordId,
    updateRecordStatus,
    getSparePartById,
  } = useReviewStore();
  const [showSource, setShowSource] = useState(false);
  const [tab, setTab] = useState<'overview' | 'timeline' | 'snapshot'>('overview');

  const record = records.find((r) => r.id === activeRecordId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  if (!record) return null;

  const linkedParts = record.sparePartIds
    .map((id) => getSparePartById(id))
    .filter((x): x is NonNullable<typeof x> => !!x);

  const handleUpdateStatus = (s: ReviewStatus) => {
    if (s === 'rejected') {
      if (!rejectOpen) {
        setRejectOpen(true);
        return;
      }
      if (!rejectReason.trim()) return;
    }
    updateRecordStatus(record.id, s);
    setRejectOpen(false);
    setRejectReason('');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={() => setActiveRecordId(null)}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-[760px] max-w-[92vw] bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded bg-white/15 flex items-center justify-center border border-white/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-lg font-bold">{record.id}</span>
                  <StatusBadge status={record.status} />
                  {record.changeLogs[0] && (
                    <ChangeTypeBadge type={record.changeLogs[0].changeType} />
                  )}
                </div>
                <div className="text-xs text-blue-200 mt-1" style={{ fontFamily: 'Noto Serif SC, serif' }}>
                  电梯故障报告复核 · 详情
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-blue-100 leading-relaxed">{record.summary}</div>
          </div>
          <button
            onClick={() => setActiveRecordId(null)}
            className="w-9 h-9 rounded hover:bg-white/15 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-1 text-xs font-semibold">
          {([
            { k: 'overview', label: '📋 概览 & 溯源', Icon: Hash },
            { k: 'timeline', label: '📜 变更时间线', Icon: ListTree },
            { k: 'snapshot', label: '📸 原始快照', Icon: FileText },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={clsx(
                'px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1.5',
                tab === t.k
                  ? 'bg-white text-blue-700 border border-blue-300 shadow-sm'
                  : 'text-zinc-600 hover:bg-zinc-200/60'
              )}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { Icon: Building2, label: '电梯编号', value: record.elevatorId, mono: true },
                  { Icon: Wrench, label: '故障类型', value: record.faultType },
                  { Icon: User, label: '上报人', value: record.reporter },
                  { Icon: User, label: '处理人', value: record.handler },
                  { Icon: Clock, label: '上报时间', value: record.reportedAt, mono: true },
                  { Icon: Clock, label: '处理时间', value: record.handledAt, mono: true },
                ].map((x, i) => (
                  <div
                    key={i}
                    className="rounded border border-zinc-200 bg-white p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0">
                      <x.Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                        {x.label}
                      </div>
                      <div
                        className={clsx(
                          'text-sm font-semibold text-zinc-800 truncate',
                          x.mono && 'font-mono'
                        )}
                      >
                        {x.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {record.hasThresholdAdjustment && record.thresholdInfo && (
                <div className="rounded border-2 border-orange-300 bg-orange-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">
                        ⚠️ 阈值临时调高 · 已单独拎出（不混入正常结果）
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="rounded bg-white border border-orange-200 p-2">
                          <div className="text-[10px] text-zinc-500 mb-1">字段</div>
                          <div className="font-mono font-bold text-zinc-800">
                            {record.thresholdInfo.field}
                          </div>
                        </div>
                        <div className="rounded bg-white border border-orange-200 p-2">
                          <div className="text-[10px] text-zinc-500 mb-1">阈值变化</div>
                          <div className="font-mono text-xs">
                            <span className="text-red-600 line-through">
                              {record.thresholdInfo.oldThreshold}
                            </span>
                            <span className="mx-1 text-zinc-400">→</span>
                            <span className="font-bold text-amber-700">
                              {record.thresholdInfo.newThreshold}
                            </span>
                          </div>
                        </div>
                        <div className="rounded bg-red-500 text-white p-2">
                          <div className="text-[10px] opacity-90 mb-1">漏报次数</div>
                          <div className="font-mono text-lg font-bold">
                            {record.thresholdInfo.triggeredMisses}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded border border-zinc-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-100 flex items-center justify-between">
                  <div className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    备件清单关联 · 点击按钮跳转原始对象
                  </div>
                  <button
                    onClick={() => setShowSource(true)}
                    className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 font-semibold"
                  >
                    <ExternalLink className="w-3 h-3" />
                    打开备件清单溯源
                  </button>
                </div>
                {linkedParts.length === 0 ? (
                  <div className="p-4 text-sm text-zinc-500 text-center">
                    该记录未关联备件（阈值调整类）
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {linkedParts.map((p) => (
                      <li
                        key={p.id}
                        className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-blue-50/30 cursor-pointer"
                        onClick={() => {
                          setShowSource(true);
                          const { setHighlightSparePartId } = useReviewStore.getState();
                          setHighlightSparePartId(p.id);
                          setTimeout(
                            () => useReviewStore.getState().setHighlightSparePartId(null),
                            3000
                          );
                        }}
                      >
                        <span className="font-mono font-bold text-blue-700 w-14">{p.id}</span>
                        <span className="font-medium text-zinc-800">{p.name}</span>
                        <span className="font-mono text-xs text-zinc-500">
                          {p.spec || '⚠️ 空字段'}
                        </span>
                        <span className="ml-auto text-[11px] text-blue-600 inline-flex items-center gap-1 font-medium">
                          跳转原始对象 →
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {record.changeLogs[0] && (
                <div className="rounded border-l-4 border-amber-400 bg-amber-50/70 p-4">
                  <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                    📜 最近变更 · 影响说明（摘要）
                  </div>
                  <p className="text-sm text-amber-900 leading-relaxed">
                    {record.changeLogs[0].impactExplanation}
                  </p>
                  <button
                    onClick={() => setTab('timeline')}
                    className="mt-3 text-xs text-amber-700 hover:text-amber-900 font-semibold inline-flex items-center gap-1"
                  >
                    查看完整变更时间线 →
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'timeline' && <ChangeTimeline logs={record.changeLogs} />}

          {tab === 'snapshot' && (
            <div>
              <div className="mb-3 text-xs text-zinc-500">
                💡 与上方"变更时间线"或"备件溯源"对照：脏数据（空字段、错别字）不会被抹除，原始状态一览无余。
              </div>
              <RawSnapshot record={record} />
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          {rejectOpen && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3">
              <div className="text-xs font-bold text-red-800 mb-2">请填写退回原因（必填）：</div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例：阈值调整未经审批、备件型号与清单不符需重核..."
                className="w-full h-20 p-2 text-sm border border-red-200 rounded focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
              />
              <div className="mt-2 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setRejectOpen(false);
                    setRejectReason('');
                  }}
                  className="px-3 py-1.5 text-xs rounded border border-zinc-300 bg-white hover:bg-zinc-100"
                >
                  取消
                </button>
                <button
                  onClick={() => handleUpdateStatus('rejected')}
                  className={clsx(
                    'px-3 py-1.5 text-xs rounded text-white font-semibold',
                    rejectReason.trim() ? 'bg-red-600 hover:bg-red-700' : 'bg-red-300 cursor-not-allowed'
                  )}
                >
                  确认退回
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-zinc-500">
              月底复核 / 交接班操作 · 老唐或接手同事
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveRecordId(null)}
                className="px-4 py-2 text-xs rounded border border-zinc-300 bg-white hover:bg-zinc-100 font-semibold text-zinc-700"
              >
                关闭
              </button>
              <button
                onClick={() => handleUpdateStatus('pending')}
                className={clsx(
                  'px-4 py-2 text-xs rounded border font-semibold inline-flex items-center gap-1.5 transition-colors',
                  record.status === 'pending'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-amber-700 border-amber-500 hover:bg-amber-50'
                )}
              >
                <ClockIcon className="w-3.5 h-3.5" />
                标记待补件
              </button>
              <button
                onClick={() => handleUpdateStatus('rejected')}
                className={clsx(
                  'px-4 py-2 text-xs rounded border font-semibold inline-flex items-center gap-1.5 transition-colors',
                  record.status === 'rejected'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-700 border-red-500 hover:bg-red-50'
                )}
              >
                <XCircle className="w-3.5 h-3.5" />
                退回
              </button>
              <button
                onClick={() => handleUpdateStatus('confirmed')}
                className={clsx(
                  'px-4 py-2 text-xs rounded border font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm',
                  record.status === 'confirmed'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                )}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                ✅ 复核确认
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSource && (
        <SparePartSourceModal
          highlightIds={record.sparePartIds}
          onClose={() => {
            setShowSource(false);
            useReviewStore.getState().setHighlightSparePartId(null);
          }}
        />
      )}
    </>
  );
}
