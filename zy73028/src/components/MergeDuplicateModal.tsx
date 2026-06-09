import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users2,
  CheckCircle2,
  X,
  AlertCircle,
  ArrowRight,
  GitMerge,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function MergeDuplicateModal() {
  const {
    ui: { showMergeModal },
    setShowMergeModal,
    mergeGroups,
    records,
    applyMerge,
    confirmMergeGroup,
  } = useAppStore();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMergeModal(false);
    };
    if (showMergeModal) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showMergeModal, setShowMergeModal]);

  const getRecordById = (id: string) => records.find((r) => r.id === id);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setShowMergeModal(false);
  };

  const handleRevoke = (groupId: string) => {
    const group = mergeGroups.find((g) => g.id === groupId);
    if (!group) return;
    useAppStore.setState((state) => ({
      mergeGroups: state.mergeGroups.map((mg) =>
        mg.id === groupId ? { ...mg, confirmed: false } : mg
      ),
      records: state.records.map((r) => {
        if (r.mergeGroupId === groupId) {
          return { ...r, aliases: r.id === group.mergedRecordIds[0] ? [] : r.aliases };
        }
        return r;
      }),
    }));
  };

  return (
    <AnimatePresence>
      {showMergeModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="px-6 py-4 border-b border-ink-200 flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Users2 className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-800 flex items-center gap-2">
                    疑似同宠异名合并
                    <Sparkles className="w-4 h-4 text-violet-500" />
                  </h2>
                  <p className="text-xs text-ink-500">
                    检测到 {mergeGroups.length} 组潜在重复记录，请逐一确认
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="w-9 h-9 rounded-lg hover:bg-white/80 flex items-center justify-center text-ink-500 hover:text-ink-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-ink-50/30">
              {mergeGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-clinic-50 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-clinic-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-ink-700 mb-1">
                    暂无检测到的疑似同宠异名
                  </h3>
                  <p className="text-sm text-ink-500 mb-2">
                    所有记录的宠物命名均未发现重复嫌疑
                  </p>
                  <div className="text-5xl">😊</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {mergeGroups.map((group) => {
                    const groupRecords = group.mergedRecordIds
                      .map(getRecordById)
                      .filter(Boolean);

                    return (
                      <motion.div
                        key={group.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card overflow-hidden"
                      >
                        <div className="px-5 py-4 bg-gradient-to-r from-ink-50 to-white border-b border-ink-100 flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <GitMerge className="w-5 h-5 text-violet-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-ink-800 text-base">
                                  {group.primaryName}
                                </span>
                                <span className="text-xs text-ink-400">【别名：</span>
                                <span className="text-sm text-violet-600 font-medium">
                                  {group.aliases.join(' / ')}
                                </span>
                                <span className="text-xs text-ink-400">】</span>
                                <span className="chip chip-anom-dup ml-1">
                                  {group.species}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="w-32">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-ink-500">置信度</span>
                                <span className="font-bold text-violet-600">
                                  {Math.round(group.confidence * 100)}%
                                </span>
                              </div>
                              <div className="progress-outer">
                                <motion.div
                                  className="progress-inner"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${group.confidence * 100}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                  style={{
                                    background:
                                      'linear-gradient(90deg, #8B5CF6 0%, #6366F1 100%)',
                                  }}
                                />
                              </div>
                            </div>

                            {group.confirmed ? (
                              <span className="chip chip-status-confirmed text-[12px] px-3 py-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                已合并
                              </span>
                            ) : (
                              <span className="chip chip-status-pending text-[12px] px-3 py-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                待确认
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          <div className="bg-ink-50/60 rounded-xl p-4">
                            <div className="text-xs font-semibold text-ink-600 mb-2 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              匹配理由
                            </div>
                            <ul className="space-y-1.5">
                              {group.matchReasons.map((reason, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-start gap-2 text-sm text-ink-700"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-ink-600 mb-3 flex items-center gap-1.5">
                              <Users2 className="w-3.5 h-3.5 text-clinic-600" />
                              组内记录对比（{groupRecords.length} 条）
                            </div>

                            <div className="relative">
                              <div className="flex items-stretch gap-4">
                                {groupRecords.map((r, idx) => (
                                  <div
                                    key={r!.id}
                                    className={`flex-1 card-flat p-4 relative ${
                                      idx === 0
                                        ? 'ring-clinic-200 bg-clinic-50/40'
                                        : 'ring-violet-200/60 bg-violet-50/30'
                                    }`}
                                  >
                                    {idx === 0 && (
                                      <div className="absolute -top-2 left-3">
                                        <span className="chip bg-clinic-500 text-white text-[10px]">
                                          主记录
                                        </span>
                                      </div>
                                    )}
                                    <div className="space-y-2.5 mt-1">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-bold text-ink-800 text-base">
                                          {r!.petName}
                                        </span>
                                        <span className="text-xs text-ink-400">
                                          {r!.species}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <span className="text-ink-400">主人：</span>
                                          <span className="text-ink-700 font-medium">
                                            {r!.ownerName}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-ink-400">体重：</span>
                                          <span className="text-ink-700 font-mono">
                                            {r!.weight}
                                            {r!.weightUnit}
                                          </span>
                                        </div>
                                        <div className="col-span-2">
                                          <span className="text-ink-400">时间：</span>
                                          <span className="text-ink-700 font-mono text-[11px]">
                                            {r!.measureTime}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="relative w-24 h-24">
                                  <div className="absolute top-0 left-0 w-20 h-20 rounded-full bg-clinic-300/25 border-2 border-clinic-400/40" />
                                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-violet-300/25 border-2 border-violet-400/40" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-clinic-400 to-violet-500 flex items-center justify-center shadow-lg">
                                      <GitMerge className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-ink-100 flex items-center justify-end gap-3">
                            {group.confirmed ? (
                              <>
                                <span className="chip chip-status-confirmed text-[13px] px-3 py-1.5 mr-auto">
                                  <CheckCircle2 className="w-4 h-4" />
                                  ✅ 已合并
                                </span>
                                <button
                                  onClick={() => handleRevoke(group.id)}
                                  className="btn-secondary"
                                >
                                  撤销合并
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => confirmMergeGroup(group.id)}
                                  className="btn-secondary"
                                >
                                  仅标记确认
                                </button>
                                <button
                                  onClick={() => applyMerge(group.id)}
                                  className="btn-primary bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600"
                                >
                                  <GitMerge className="w-4 h-4" />
                                  确认合并为一组
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
