import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function DuplicateBanner() {
  const duplicates = useAppStore((s) => s.duplicates);
  const openConfirm = useAppStore((s) => s.openConfirmPanel);
  const [expanded, setExpanded] = useState(true);

  if (duplicates.length === 0) return null;

  const totalRecords = duplicates.reduce((sum, d) => sum + d.count, 0);
  const totalAffected = duplicates.reduce((sum, d) => sum + d.affected_warnings.length, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl border-2 border-alert-yellow/60 bg-gradient-to-r from-alert-yellow/15 via-alert-yellow/10 to-alert-yellow/15 shadow-card animate-shake-light"
      >
        <button
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="w-9 h-9 rounded-lg bg-alert-yellow/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#8a6a00]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[#7a5d00] leading-tight">
              检测到 {duplicates.length} 组设备编号重复 · 涉及 {totalRecords} 条记录 · 影响 {totalAffected} 条预警
            </div>
            <div className="text-xs text-[#927000] mt-0.5">
              为避免数值冲突，以下记录的预警暂以「待人工确认」标记。请先确认采信哪条，再查看最终数字。
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-block px-3 py-1.5 rounded-md bg-[#8a6a00] text-white text-xs font-semibold hover:bg-[#745700] transition-colors">
              立即确认
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[#8a6a00]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8a6a00]" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 border-t border-alert-yellow/30 space-y-2.5">
                {duplicates.map((g) => (
                  <div
                    key={g.equipment_no}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-white/70 border border-alert-yellow/40"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-alert-orange shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm text-[#7a5d00] font-medium num">
                          设备编号 {g.equipment_no} · {g.count} 条记录冲突
                        </div>
                        <ul className="text-xs text-[#927000] mt-0.5 space-y-0.5">
                          {g.conflict_points.map((cp, i) => (
                            <li key={i}>→ {cp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-col sm:items-end shrink-0">
                      {g.affected_warnings.length > 0 && (
                        <div className="text-[11px] text-[#927000] num">
                          影响预警：
                          <span className="font-semibold text-[#7a5d00]">
                            {g.affected_warnings.join(', ')}
                          </span>
                        </div>
                      )}
                      <button
                        className="btn-primary !py-1.5 !px-3 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfirm(g.equipment_no);
                        }}
                      >
                        去确认 →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
