import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, GitCompare, AlertTriangle, CheckCircle2, OctagonX, Sparkles, Link2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useAppStore } from '@/store/useAppStore';
import { LevelBadge } from '@/components/common/Badges';
import type { FormulaVersion } from '@/types';

function VersionGroup({
  version,
  items,
  isDefaultOpen,
  onSelectRecord,
}: {
  version: FormulaVersion;
  items: ReturnType<typeof useAppStore.getState>['timeline'];
  isDefaultOpen: boolean;
  onSelectRecord: (id: string) => void;
}) {
  const [open, setOpen] = useState(isDefaultOpen);

  const levelDot = (level: string) => {
    if (level === 'red') return <OctagonX className="w-4 h-4 text-alert-red" />;
    if (level === 'yellow') return <AlertTriangle className="w-4 h-4 text-alert-orange" />;
    return <CheckCircle2 className="w-4 h-4 text-alert-green" />;
  };

  return (
    <section className="card-base overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-industrial-50/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            version.is_current ? 'bg-gradient-to-br from-industrial-400 to-industrial-600 text-white shadow-inner' : 'bg-industrial-100 text-industrial-500'
          }`}
        >
          {version.is_current ? <Sparkles className="w-5 h-5" /> : <GitCompare className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="title-font text-base font-bold text-industrial-800 num">{version.version}</span>
            <span className="text-sm text-industrial-600">{version.name}</span>
            {version.is_current && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-industrial-500 text-white">
                <Link2 className="w-3 h-3" />
                当前口径（与页面统一）
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-industrial-500">
            <span>生效日期：{version.effective_date}</span>
            <span>·</span>
            <span className="truncate max-w-md">{version.description}</span>
            <span>·</span>
            <span>
              本组 <span className="num font-semibold text-industrial-700">{items.length}</span> 条记录
            </span>
          </div>
        </div>
        <div className="shrink-0 p-1.5 rounded-md hover:bg-industrial-100 transition-colors">
          {open ? <ChevronUp className="w-4 h-4 text-industrial-500" /> : <ChevronDown className="w-4 h-4 text-industrial-500" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-surface-border"
          >
            <div className="px-5 pt-4 pb-2 relative">
              {!version.is_current && (
                <div className="mb-4 p-3 rounded-lg bg-alert-blue/5 border border-alert-blue/25 text-xs text-[#0a56a5] leading-relaxed flex items-start gap-2">
                  <GitCompare className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    本时段记录使用<span className="font-semibold">「{version.version}」</span>历史口径生成。
                    页面展示数值已按当前口径统一回算；如存在差异，将在卡片下方标注具体原因。
                  </span>
                </div>
              )}

              <div className="relative pl-8">
                <div className="absolute left-[11px] top-2 bottom-4 w-px bg-gradient-to-b from-industrial-300 via-industrial-200 to-industrial-100" />
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.35 }}
                    className="relative pb-6 last:pb-2"
                  >
                    <div
                      className={`absolute -left-[29px] top-3 w-[24px] h-[24px] rounded-full border-2 border-white flex items-center justify-center shadow-card ${
                        item.level === 'red'
                          ? 'bg-alert-red'
                          : item.level === 'yellow'
                            ? 'bg-alert-orange'
                            : 'bg-alert-green'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-white/90" />
                    </div>
                    <div
                      onClick={() => onSelectRecord(item.record_id)}
                      className={`card-base p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-hover ${
                        !item.is_current_version ? 'ring-1 ring-industrial-200/70' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Clock className="w-3.5 h-3.5 text-industrial-400" />
                            <span className="num text-xs font-semibold text-industrial-600">{item.date}</span>
                            <LevelBadge level={item.level} />
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-industrial-100 text-industrial-600 num">
                              {item.formula_version}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="num text-xs text-industrial-400">{item.equipment_no}</span>
                            <span className="text-sm font-medium text-industrial-700 truncate max-w-xs">
                              {item.pipeline_name}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="num text-xl font-bold text-industrial-800 leading-none">
                            {item.value.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-industrial-400 mt-0.5">{item.unit}</div>
                        </div>
                      </div>

                      {(item.diff_note || item.change_reason) && (
                        <div className="mt-2 space-y-1.5 pt-2 border-t border-dashed border-surface-border">
                          {item.diff_note && (
                            <div className="flex items-start gap-2 text-[11px] text-industrial-500 leading-relaxed">
                              <GitCompare className="w-3 h-3 text-industrial-400 shrink-0 mt-0.5" />
                              <span>{item.diff_note}</span>
                            </div>
                          )}
                          {item.change_reason && (
                            <div className="flex items-start gap-2 text-[11px] text-alert-orange leading-relaxed">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>变动原因：{item.change_reason}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function TimelinePage() {
  const timeline = useAppStore((s) => s.timeline);
  const versions = useAppStore((s) => s.versions);
  const setSelected = useAppStore((s) => s.setSelectedRecordId);
  const currentV = versions.find((v) => v.is_current);

  const goToInspection = (recordId: string) => {
    setSelected(recordId);
    window.location.hash = '#/inspections';
  };

  return (
    <PageContainer
      title="历史时间线"
      subtitle="按口径版本分组查看全部预警记录。页面和文件的数值统一使用当前口径展示，历史数据将标注口径差异与变动原因，避免两边对不上。"
      breadcrumb={[{ label: '历史时间线' }]}
    >
      <div className="card-base p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-industrial-400 to-industrial-600 text-white flex items-center justify-center shadow-inner">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-industrial-500">当前计算口径</div>
              <div className="title-font text-xl font-bold text-industrial-800 num">
                {currentV?.version} · {currentV?.name}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-surface-muted">
              <div className="text-industrial-400">生效日期</div>
              <div className="num font-semibold text-industrial-700 mt-0.5">{currentV?.effective_date}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-muted">
              <div className="text-industrial-400">总记录</div>
              <div className="num font-semibold text-industrial-700 mt-0.5">{timeline.length} 条</div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-muted">
              <div className="text-industrial-400">口径版本</div>
              <div className="num font-semibold text-industrial-700 mt-0.5">{versions.length} 个</div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface-muted">
              <div className="text-industrial-400">含差异记录</div>
              <div className="num font-semibold text-industrial-700 mt-0.5">
                {timeline.filter((t) => t.diff_note || t.change_reason).length} 条
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {versions.map((v) => (
          <VersionGroup
            key={v.version}
            version={v}
            items={timeline.filter((t) => t.formula_version === v.version)}
            isDefaultOpen={v.is_current}
            onSelectRecord={goToInspection}
          />
        ))}
      </div>
    </PageContainer>
  );
}
