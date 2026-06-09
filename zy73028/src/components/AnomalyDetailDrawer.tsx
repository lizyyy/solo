import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  AlertTriangle,
  Scale,
  Thermometer,
  MessageCircle,
  Clock,
  UserCheck,
  FileQuestion,
  PlusCircle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
  WECHAT_TRACE_KEYWORDS,
  PET_CATEGORY_LABEL,
  ANOMALY_LABEL,
  ANOMALY_CHIP_CLASS,
  STATUS_LABEL,
  STATUS_CHIP_CLASS,
  type TempControlRecord,
  type AnomalyType,
  type RecordStatus,
} from '@/types';

const DRAWER_WIDTH = 480;

function highlightWechatNote(text: string): React.ReactNode {
  if (!text) return <span className="text-ink-400">（无备注）</span>;

  const regex = new RegExp(`(${WECHAT_TRACE_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (WECHAT_TRACE_KEYWORDS.includes(part)) {
      return (
        <span key={idx} className="hl-mark">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function AnomalyDetailDrawer() {
  const openDetailId = useAppStore((s) => s.ui.openDetailId);
  const setOpenDetail = useAppStore((s) => s.setOpenDetail);
  const records = useAppStore((s) => s.records);
  const addJudgment = useAppStore((s) => s.addJudgment);
  const addSupplementaryNote = useAppStore((s) => s.addSupplementaryNote);
  const confirmedIds = useAppStore((s) => s.confirmedIds);
  const toggleConfirm = useAppStore((s) => s.toggleConfirm);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [judgmentForm, setJudgmentForm] = useState<{
    anomalyType: AnomalyType | '';
    newStatus: RecordStatus | '';
    reason: string;
  }>({ anomalyType: '', newStatus: '', reason: '' });
  const [noteInput, setNoteInput] = useState('');

  const record: TempControlRecord | undefined = useMemo(
    () => records.find((r) => r.id === openDetailId),
    [records, openDetailId]
  );

  const isOpen = !!openDetailId;
  const isConfirmed = record ? confirmedIds.includes(record.id) : false;

  const handleCopyPhone = async () => {
    if (!record?.ownerPhone) return;
    try {
      await navigator.clipboard.writeText(record.ownerPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleSubmitJudgment = () => {
    if (!record || !judgmentForm.anomalyType || !judgmentForm.newStatus || !judgmentForm.reason.trim()) {
      return;
    }
    addJudgment(record.id, {
      originalAnomaly: judgmentForm.anomalyType,
      newStatus: judgmentForm.newStatus,
      reason: judgmentForm.reason.trim(),
    });
    setJudgmentForm({ anomalyType: '', newStatus: '', reason: '' });
  };

  const handleAddNote = () => {
    if (!record || !noteInput.trim()) return;
    addSupplementaryNote(record.id, { content: noteInput.trim() });
    setNoteInput('');
  };

  return (
    <AnimatePresence>
      {isOpen && record && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm"
            onClick={() => setOpenDetail(null)}
          />

          <motion.aside
            initial={{ x: DRAWER_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: DRAWER_WIDTH }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="fixed top-0 right-0 bottom-0 z-50 bg-white shadow-2xl flex flex-col"
            style={{ width: DRAWER_WIDTH }}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-ink-200 bg-ink-50/60">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-400 mb-1.5">
                  <span>温控记录</span>
                  <span>›</span>
                  <span className="text-ink-500">#{record.id}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-ink-800">
                    {record.petName}
                  </h2>
                  <span className="chip !text-[11px] chip-anom-miss">
                    {PET_CATEGORY_LABEL[record.petCategory]}
                  </span>
                  <span className="text-xs text-ink-500">{record.species}</span>
                  <span
                    className={cn('chip', STATUS_CHIP_CLASS[record.status])}
                  >
                    {STATUS_LABEL[record.status]}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpenDetail(null)}
                className="p-1.5 rounded-lg hover:bg-ink-200/60 transition-colors flex-shrink-0"
                title="关闭"
              >
                <X className="w-4.5 h-4.5 text-ink-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="p-5 space-y-5">
                <div className="card-flat p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-4 h-4 text-clinic-600" />
                    <h3 className="text-sm font-semibold text-ink-700">
                      主人信息
                    </h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-500">姓名</span>
                      <span className="text-sm font-medium text-ink-800">
                        {record.ownerName || '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-500">电话</span>
                      <button
                        onClick={handleCopyPhone}
                        className="flex items-center gap-1.5 text-sm font-medium text-clinic-600 hover:text-clinic-700 transition-colors group"
                      >
                        <span>{record.ownerPhone || '—'}</span>
                        {copiedPhone ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-flat p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-ink-700">
                      微信备注原文
                    </h3>
                  </div>
                  <div className="flex justify-end">
                    <div className="wechat-bubble max-w-[90%]">
                      {highlightWechatNote(record.ownerWechatNote)}
                    </div>
                  </div>
                </div>

                <div className="card-flat p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileQuestion className="w-4 h-4 text-violet-600" />
                    <h3 className="text-sm font-semibold text-ink-700">
                      原始数据
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="field-label flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5" />
                        体重
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-ink-50/60 rounded-md px-3 py-2">
                          <div className="text-[10px] text-ink-400 mb-0.5">
                            原始值
                          </div>
                          <div
                            className={cn(
                              'text-sm font-semibold flex items-center gap-1',
                              record.weightUnitAbnormal
                                ? 'text-red-600'
                                : 'text-ink-700'
                            )}
                          >
                            {record.weight} {record.weightUnit}
                            {record.weightUnitAbnormal && (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="bg-clinic-50/50 rounded-md px-3 py-2">
                          <div className="text-[10px] text-clinic-600/70 mb-0.5">
                            规范化 (kg)
                          </div>
                          <div className="text-sm font-semibold text-clinic-700">
                            {record.weightNormalizedKg.toFixed(2)} kg
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="field-label flex items-center gap-1.5">
                        <Thermometer className="w-3.5 h-3.5" />
                        温度
                      </div>
                      <div className="bg-ink-50/60 rounded-md px-3 py-2">
                        <div className="text-sm font-semibold text-ink-700">
                          {record.temperature.toFixed(1)} ℃
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="field-label flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        测量时间
                      </div>
                      <div className="bg-ink-50/60 rounded-md px-3 py-2">
                        <div className="text-sm font-medium text-ink-700">
                          {formatDateTime(record.measureTime)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-flat p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-semibold text-ink-700">
                      异常标签
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {record.anomalyType && record.anomalyType.length > 0 ? (
                      record.anomalyType.map((type) => (
                        <span
                          key={type}
                          className={cn('chip', ANOMALY_CHIP_CLASS[type])}
                        >
                          {ANOMALY_LABEL[type]}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-ink-400">（无异常）</span>
                    )}
                  </div>
                </div>

                <div className="card-flat p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserCheck className="w-4 h-4 text-clinic-600" />
                    <h3 className="text-sm font-semibold text-ink-700">
                      人工改判面板
                    </h3>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="field-label">异常类型</label>
                      <select
                        className="input"
                        value={judgmentForm.anomalyType}
                        onChange={(e) =>
                          setJudgmentForm((f) => ({
                            ...f,
                            anomalyType: e.target.value as AnomalyType | '',
                          }))
                        }
                      >
                        <option value="">选择要改判的异常类型</option>
                        {record.anomalyType?.map((type) => (
                          <option key={type} value={type}>
                            {ANOMALY_LABEL[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">新状态</label>
                      <select
                        className="input"
                        value={judgmentForm.newStatus}
                        onChange={(e) =>
                          setJudgmentForm((f) => ({
                            ...f,
                            newStatus: e.target.value as RecordStatus | '',
                          }))
                        }
                      >
                        <option value="">选择新状态</option>
                        <option value="confirmed">已确认（正常）</option>
                        <option value="pending">待处理</option>
                        <option value="anomaly">标记为异常</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">改判原因（必填）</label>
                      <textarea
                        className="input resize-none"
                        rows={3}
                        placeholder="请详细说明改判原因，便于后续追溯..."
                        value={judgmentForm.reason}
                        onChange={(e) =>
                          setJudgmentForm((f) => ({ ...f, reason: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      onClick={handleSubmitJudgment}
                      disabled={
                        !judgmentForm.anomalyType ||
                        !judgmentForm.newStatus ||
                        !judgmentForm.reason.trim()
                      }
                      className={cn(
                        'btn-primary w-full',
                        (!judgmentForm.anomalyType ||
                          !judgmentForm.newStatus ||
                          !judgmentForm.reason.trim()) &&
                          'opacity-50 cursor-not-allowed'
                      )}
                    >
                      提交改判
                    </button>
                  </div>

                  {record.judgments && record.judgments.length > 0 && (
                    <div className="border-t border-ink-100 pt-4">
                      <h4 className="text-xs font-semibold text-ink-500 mb-3">
                        改判记录 ({record.judgments.length})
                      </h4>
                      <div className="relative pl-5 space-y-4">
                        {record.judgments.map((j, idx) => (
                          <div key={j.id} className="relative">
                            {idx < record.judgments!.length - 1 && (
                              <div className="absolute left-[-17px] top-3 bottom-[-17px] w-px bg-ink-200" />
                            )}
                            <div className="timeline-dot absolute -left-[17px] top-1.5" />
                            <div className="bg-ink-50/60 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-medium text-ink-700">
                                    {j.operator}
                                  </span>
                                  <span
                                    className={cn(
                                      'chip !text-[10px] !py-0 !px-1.5',
                                      ANOMALY_CHIP_CLASS[j.originalAnomaly]
                                    )}
                                  >
                                    {ANOMALY_LABEL[j.originalAnomaly]}
                                  </span>
                                  <span className="text-ink-300">→</span>
                                  <span
                                    className={cn(
                                      'chip !text-[10px] !py-0 !px-1.5',
                                      STATUS_CHIP_CLASS[j.newStatus]
                                    )}
                                  >
                                    {STATUS_LABEL[j.newStatus]}
                                  </span>
                                </div>
                                <span className="text-[10px] text-ink-400 flex-shrink-0">
                                  {formatDateTime(j.timestamp)}
                                </span>
                              </div>
                              <p className="text-xs text-ink-600 leading-relaxed">
                                {j.reason}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="card-flat p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle className="w-4 h-4 text-sky-600" />
                    <h3 className="text-sm font-semibold text-ink-700">
                      后补说明时间线
                    </h3>
                  </div>

                  {record.supplementaryNotes &&
                  record.supplementaryNotes.length > 0 ? (
                    <div className="relative pl-5 space-y-4 mb-4">
                      {record.supplementaryNotes.map((n, idx) => (
                        <div key={n.id} className="relative">
                          {idx < record.supplementaryNotes!.length - 1 && (
                            <div className="absolute left-[-17px] top-3 bottom-[-17px] w-px bg-ink-200" />
                          )}
                          <div className="timeline-dot absolute -left-[17px] top-1.5" />
                          <div className="bg-sky-50/60 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium text-ink-700">
                                {n.author}
                              </span>
                              <span className="text-[10px] text-ink-400">
                                {formatDateTime(n.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-ink-600 leading-relaxed">
                              {n.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-ink-400 mb-4">
                      暂无后补说明
                    </div>
                  )}

                  <div className="space-y-2">
                    <textarea
                      className="input resize-none"
                      rows={2}
                      placeholder="追加备注说明，如主人补充信息、现场观察等..."
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!noteInput.trim()}
                      className={cn(
                        'btn-secondary w-full',
                        !noteInput.trim() && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <PlusCircle className="w-4 h-4" />
                      追加说明
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-ink-200 bg-ink-50/60 px-5 py-3 flex items-center gap-2.5">
              <button
                onClick={() => setOpenDetail(null)}
                className="btn-ghost flex-1"
              >
                <X className="w-4 h-4" />
                关闭
              </button>
              {isConfirmed ? (
                <button
                  onClick={() => record && toggleConfirm(record.id, false)}
                  className="btn-secondary flex-1"
                >
                  取消确认
                </button>
              ) : (
                <button
                  onClick={() => record && toggleConfirm(record.id, true)}
                  className="btn-primary flex-1"
                >
                  <Check className="w-4 h-4" />
                  确认无误
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
