import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { getDuplicateRecordsByEquipment } from '@/utils/detector';
import { findRuleByMetric, evaluateWarning } from '@/utils/calculator';
import { LevelBadge, StatusBadge } from '@/components/common/Badges';
import { formatDateTime } from '@/utils/unitConverter';

export default function ConfirmPanel() {
  const openFor = useAppStore((s) => s.confirmPanelOpenFor);
  const close = useAppStore((s) => s.closeConfirmPanel);
  const records = useAppStore((s) => s.records);
  const rules = useAppStore((s) => s.rules);
  const warnings = useAppStore((s) => s.warnings);
  const confirm = useAppStore((s) => s.confirmDuplicate);
  const [chosen, setChosen] = useState<string | null>(null);

  if (!openFor) return null;
  const group = getDuplicateRecordsByEquipment(openFor, records);
  if (group.length === 0) return null;

  const handleConfirm = () => {
    if (chosen) {
      confirm(openFor, chosen);
      setChosen(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-industrial-900/50 backdrop-blur-sm" onClick={close} />
        <motion.div
          initial={{ scale: 0.96, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.96, y: 8, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-2xl card-base shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-surface-border bg-gradient-to-r from-alert-yellow/15 to-transparent">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-alert-yellow/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#8a6a00]" />
              </div>
              <div className="min-w-0">
                <h2 className="title-font text-lg font-semibold text-industrial-800 leading-tight">
                  人工确认 · 设备编号 {openFor}
                </h2>
                <p className="text-xs text-industrial-500 mt-1">
                  以下 {group.length} 条记录使用了相同的设备编号。请根据巡检时间、测量工具和巡检人说明，
                  <span className="text-[#7a5d00] font-semibold">选择一条采信</span>
                  ，其余记录的对应预警将标记为作废。
                </p>
              </div>
            </div>
            <button
              onClick={close}
              className="p-1.5 rounded-md text-industrial-400 hover:text-industrial-700 hover:bg-industrial-50 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-3">
            {group.map((rec, idx) => {
              const rule = findRuleByMetric(rules, rec.metric_type);
              const result = rule ? evaluateWarning(rec.measured_value, rule) : null;
              const recWarnings = warnings.filter((w) => w.record_id === rec.id);
              const selected = chosen === rec.id;
              return (
                <label
                  key={rec.id}
                  className={`block cursor-pointer rounded-xl border-2 p-4 transition-all ${
                    selected
                      ? 'border-industrial-500 bg-industrial-50/80 shadow-inner'
                      : 'border-surface-border hover:border-industrial-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selected ? 'border-industrial-500 bg-industrial-500' : 'border-industrial-300 bg-white'
                        }`}
                      >
                        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="duplicate-confirm"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setChosen(rec.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="num text-sm font-bold text-industrial-800">
                            候选 {idx + 1} · {rec.id}
                          </span>
                          <StatusBadge status={rec.status} />
                          {result && <LevelBadge level={result.level} />}
                        </div>
                        {idx < group.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-industrial-300 hidden sm:block" />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                        <div>
                          <span className="text-industrial-400">测量值：</span>
                          <span className="num font-semibold text-industrial-700">
                            {rec.measured_value} {rec.measure_unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-industrial-400">计算值：</span>
                          <span className="num font-semibold text-industrial-700">
                            {result?.steps[result.steps.length - 1].result.toFixed(2)} {rule?.unit}
                          </span>
                        </div>
                        <div>
                          <span className="text-industrial-400">巡检时间：</span>
                          <span className="num text-industrial-600">{formatDateTime(rec.inspect_time)}</span>
                        </div>
                        <div>
                          <span className="text-industrial-400">巡检人：</span>
                          <span className="text-industrial-600">{rec.inspector}</span>
                        </div>
                      </div>

                      {rec.notes.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-surface-muted border border-surface-border text-xs leading-relaxed">
                          {rec.notes.map((n) => (
                            <p key={n.id} className="text-industrial-600">
                              <span className="text-industrial-400 mr-1.5 num">[{formatDateTime(n.created_at)}]</span>
                              {n.content}
                            </p>
                          ))}
                        </div>
                      )}

                      {recWarnings.length > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-industrial-500">
                          <Clock className="w-3 h-3" />
                          对应预警：
                          <span className="num font-semibold text-industrial-600">
                            {recWarnings.map((w) => w.id).join(', ')}
                          </span>
                          <span className="text-industrial-400">
                            — 若不采信本条，以上预警将被标记作废
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <footer className="px-6 py-4 border-t border-surface-border bg-surface-muted/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-industrial-500">
              确认操作会记入时间线变动记录，后续可在历史页查看口径变更与人工确认轨迹。
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button className="btn-secondary" onClick={close}>
                稍后处理
              </button>
              <button
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!chosen}
                onClick={handleConfirm}
              >
                <CheckCircle2 className="w-4 h-4" />
                确认并采信选中记录
              </button>
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
