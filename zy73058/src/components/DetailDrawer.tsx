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
  AlertCircle,
  BadgeAlert,
  ArrowRight,
  Search,
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

  const partsByRole = {
    anomaly: (record.sparePartRefs || [])
      .filter((r) => r.role === 'primary-anomaly')
      .map((r) => ({ ref: r, part: getSparePartById(r.id) }))
      .filter((x): x is { ref: typeof x.ref; part: NonNullable<typeof x.part> } => !!x.part),
    corrected: (record.sparePartRefs || [])
      .filter((r) => r.role === 'corrected')
      .map((r) => ({ ref: r, part: getSparePartById(r.id) }))
      .filter((x): x is { ref: typeof x.ref; part: NonNullable<typeof x.part> } => !!x.part),
    normal: (record.sparePartRefs || [])
      .filter((r) => r.role === 'normal')
      .map((r) => ({ ref: r, part: getSparePartById(r.id) }))
      .filter((x): x is { ref: typeof x.ref; part: NonNullable<typeof x.part> } => !!x.part),
  };

  const hasTraceableParts = partsByRole.anomaly.length + partsByRole.corrected.length + partsByRole.normal.length > 0;
  const primarySourceId = record.primarySourceSparePartId || partsByRole.anomaly[0]?.part.id;

  const jumpToSource = (highlightId: string) => {
    setShowSource(true);
    const { setHighlightSparePartId } = useReviewStore.getState();
    setHighlightSparePartId(highlightId);
    setTimeout(() => useReviewStore.getState().setHighlightSparePartId(null), 3500);
  };

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

              <div className="space-y-4">
                {partsByRole.anomaly.length > 0 && (
                  <div className="rounded border-2 border-red-400 bg-gradient-to-br from-red-50 to-amber-50 overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 bg-red-500 text-white flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <BadgeAlert className="w-4 h-4" />
                        <span className="text-xs font-bold tracking-wide uppercase">
                          🔴 溯源终点 · 用于解释异常的原始备件对象
                        </span>
                      </div>
                      {primarySourceId && (
                        <button
                          onClick={() => jumpToSource(primarySourceId)}
                          className="text-[11px] inline-flex items-center gap-1 px-3 py-1.5 rounded border-2 border-white text-white bg-red-600 hover:bg-red-700 font-bold shadow-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          跳转 {primarySourceId} · 备件清单原始对象
                        </button>
                      )}
                    </div>
                    <ul className="divide-y divide-red-200/70">
                      {partsByRole.anomaly.map(({ ref, part }) => (
                        <li
                          key={part.id}
                          onClick={() => jumpToSource(part.id)}
                          className="px-4 py-3.5 flex items-start gap-3 text-sm hover:bg-white/60 cursor-pointer transition-colors"
                        >
                          <div className="w-9 h-9 rounded bg-red-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-red-700 text-sm bg-white px-2 py-0.5 rounded border border-red-200">
                                {part.id}
                              </span>
                              <span className="font-semibold text-zinc-900">{part.name}</span>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-red-500 text-white font-bold">
                                PRIMARY SOURCE
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs font-mono">
                              <span className={part.spec ? 'text-zinc-600' : 'text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded border border-red-300'}>
                                规格：{part.spec || '⚠️ 空字段（脏数据）'}
                              </span>
                              <span className={part.batch ? 'text-zinc-600' : 'text-red-700 font-bold bg-red-100 px-1.5 py-0.5 rounded border border-red-300'}>
                                批次：{part.batch || '⚠️ 空'}
                              </span>
                              <span className="text-zinc-500">数量：{part.quantity}</span>
                            </div>
                            <div className="mt-2 text-xs text-red-900 bg-white/70 border border-red-200 rounded px-2.5 py-1.5 leading-relaxed">
                              📌 <b>为什么是它：</b>
                              {ref.roleLabel || '影响复核结论的原始备件，溯源必须回到此处，修正后对象不可替代'}
                            </div>
                          </div>
                          <span className="text-[11px] text-red-600 inline-flex items-center gap-1 font-bold mt-1">
                            查看源 →
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {partsByRole.corrected.length > 0 && (
                  <div className="rounded border-2 border-zinc-300 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-zinc-200 text-zinc-800 flex items-center gap-2">
                      <Search className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold tracking-wide uppercase">
                        ⚪ 修正后对照（仅作对比参考，不可替代原始来源）
                      </span>
                    </div>
                    <ul className="divide-y divide-zinc-100">
                      {partsByRole.corrected.map(({ ref, part }) => (
                        <li
                          key={part.id}
                          onClick={() => jumpToSource(part.id)}
                          className="px-4 py-3 flex items-start gap-3 text-sm hover:bg-zinc-50/70 cursor-pointer transition-colors"
                        >
                          <div className="w-9 h-9 rounded bg-zinc-300 text-zinc-700 flex items-center justify-center shrink-0">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-zinc-600">{part.id}</span>
                              <span className="font-medium text-zinc-800">{part.name}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-400 text-white font-bold">
                                CORRECTED
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs font-mono text-zinc-600">
                              <span>规格：{part.spec || '—'}</span>
                              <span>批次：{part.batch || '—'}</span>
                              <span>数量：{part.quantity}</span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-zinc-500">
                              {ref.roleLabel || '修正后的备件记录，仅作对照'}
                            </div>
                          </div>
                          <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1 font-medium mt-1">
                            查看对照 →
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {partsByRole.normal.length > 0 && (
                  <div className="rounded border border-zinc-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-zinc-100 text-zinc-700 flex items-center justify-between">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" />
                        其他普通关联备件
                      </div>
                      {!primarySourceId && (
                        <button
                          onClick={() => setShowSource(true)}
                          className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-500 text-blue-700 bg-white hover:bg-blue-50 font-semibold"
                        >
                          <ExternalLink className="w-3 h-3" />
                          打开备件清单溯源
                        </button>
                      )}
                    </div>
                    {partsByRole.normal.length === 0 ? (
                      <div className="p-4 text-sm text-zinc-500 text-center">该记录未关联普通备件</div>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {partsByRole.normal.map(({ part }) => (
                          <li
                            key={part.id}
                            onClick={() => jumpToSource(part.id)}
                            className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-blue-50/30 cursor-pointer"
                          >
                            <span className="font-mono font-semibold text-blue-700 w-14">{part.id}</span>
                            <span className="font-medium text-zinc-800">{part.name}</span>
                            <span className="font-mono text-xs text-zinc-500">{part.spec || '—'}</span>
                            <span className="ml-auto text-[11px] text-blue-600 inline-flex items-center gap-1 font-medium">
                              查看 →
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {!hasTraceableParts && (
                  <div className="rounded border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
                    该记录未关联备件（阈值调整类不涉及备件溯源）
                  </div>
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
          primaryAnomalyId={primarySourceId}
          correctedIds={partsByRole.corrected.map((x) => x.part.id)}
          normalIds={partsByRole.normal.map((x) => x.part.id)}
          highlightIds={record.sparePartIds}
          roleLabels={Object.fromEntries(
            [...partsByRole.anomaly, ...partsByRole.corrected, ...partsByRole.normal]
              .filter((x) => x.ref.roleLabel)
              .map((x) => [x.part.id, x.ref.roleLabel!])
          )}
          onClose={() => {
            setShowSource(false);
            useReviewStore.getState().setHighlightSparePartId(null);
          }}
        />
      )}
    </>
  );
}
