import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Thermometer,
  CheckCircle2,
  AlertTriangle,
  Users2,
  Scale,
  FileText,
  Hand,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  generateHandoverSummary,
  computeHandoverStats,
  getHandoverDetailItems,
} from '@/utils/handoverSummary';
import { cn } from '@/lib/utils';
import type { AnomalyType } from '@/types';

export default function ProgressHeader() {
  const records = useAppStore((s) => s.records);
  const mergeGroups = useAppStore((s) => s.mergeGroups);
  const confirmedIds = useAppStore((s) => s.confirmedIds);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);
  const lastOperator = useAppStore((s) => s.lastOperator);
  const lastAction = useAppStore((s) => s.lastAction);
  const drillDown = useAppStore((s) => s.drillDown);
  const setDrillDown = useAppStore((s) => s.setDrillDown);
  const setShowMergeModal = useAppStore((s) => s.setShowMergeModal);

  const ctx = useMemo(
    () => ({
      records,
      mergeGroups,
      lastOperator,
      lastSavedAt,
      lastAction,
    }),
    [records, mergeGroups, lastOperator, lastSavedAt, lastAction]
  );

  const stats = useMemo(() => computeHandoverStats(ctx), [ctx]);
  const summary = useMemo(() => generateHandoverSummary(ctx), [ctx]);
  const detailItems = useMemo(() => getHandoverDetailItems(ctx), [ctx]);

  const confirmRate = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
  const gap = stats.total - stats.confirmed;

  const weightAbnormalIds = useMemo(
    () =>
      records
        .filter((r) => r.anomalyType.includes('weight_unit_mixed'))
        .map((r) => r.id),
    [records]
  );

  const tempAbnormalIds = useMemo(
    () =>
      records
        .filter((r) => r.anomalyType.includes('temp_out_of_range'))
        .map((r) => r.id),
    [records]
  );

  const missingSupplIds = useMemo(
    () =>
      records
        .filter((r) => {
          const hasAnomaly = r.anomalyType.length > 0;
          const hasNotes = r.supplementaryNotes && r.supplementaryNotes.length > 0;
          const hasJudgments = r.judgments && r.judgments.length > 0;
          return hasAnomaly && !hasNotes && !hasJudgments;
        })
        .map((r) => r.id),
    [records]
  );

  const handleCardClick = (type: AnomalyType | 'duplicate' | 'missing', ids: string[]) => {
    if (type === 'duplicate') {
      setShowMergeModal(true);
      return;
    }
    setDrillDown({
      type: type as AnomalyType,
      recordIds: ids,
      highlightAt: Date.now(),
    });
  };

  const isDrilling = (type: AnomalyType | null) => drillDown.type === type;

  const summaryCards = [
    {
      key: 'total',
      label: '记录总数',
      value: stats.total,
      icon: FileText,
      color: 'text-white/90',
      bg: 'bg-white/10',
      clickable: false,
    },
    {
      key: 'confirmed',
      label: '已确认',
      value: stats.confirmed,
      icon: CheckCircle2,
      color: 'text-emerald-300',
      bg: 'bg-emerald-400/15',
      clickable: false,
    },
    {
      key: 'gap',
      label: '待处理缺口',
      value: gap,
      icon: AlertTriangle,
      color: gap > 0 ? 'text-amber-300' : 'text-white/80',
      bg: 'bg-amber-400/15',
      clickable: false,
      animate: gap > 0,
    },
    {
      key: 'weight_unit_mixed',
      label: '单位异常',
      value: stats.weightUnitMixed,
      icon: Scale,
      color: stats.weightUnitMixed > 0 ? 'text-rose-300' : 'text-white/80',
      bg: 'bg-rose-400/15',
      clickable: true,
      anomalyType: 'weight_unit_mixed' as AnomalyType,
      ids: weightAbnormalIds,
    },
    {
      key: 'duplicate_pet',
      label: '重名组',
      value: stats.duplicateGroups,
      icon: Users2,
      color: stats.duplicateGroups > 0 ? 'text-violet-300' : 'text-white/80',
      bg: 'bg-violet-400/15',
      clickable: true,
      anomalyType: 'duplicate_pet' as AnomalyType,
      isDuplicate: true,
      ids: [],
    },
    {
      key: 'temp_out_of_range',
      label: '温度异常',
      value: stats.tempOutOfRange,
      icon: Thermometer,
      color: stats.tempOutOfRange > 0 ? 'text-orange-300' : 'text-white/80',
      bg: 'bg-orange-400/15',
      clickable: true,
      anomalyType: 'temp_out_of_range' as AnomalyType,
      ids: tempAbnormalIds,
    },
    {
      key: 'missing_supplementary',
      label: '说明缺失',
      value: stats.missingSupplementary,
      icon: FileText,
      color: stats.missingSupplementary > 0 ? 'text-slate-300' : 'text-white/80',
      bg: 'bg-slate-400/15',
      clickable: true,
      anomalyType: 'missing_data' as AnomalyType,
      isMissing: true,
      ids: missingSupplIds,
    },
  ];

  return (
    <header className="h-[170px] w-full fixed top-0 left-0 right-0 z-40 bg-header-grad text-white overflow-hidden shadow-lg">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/3 w-80 h-80 bg-clinic-300 rounded-full blur-3xl" />
      </div>

      <div className="relative h-full px-6 py-3 flex flex-col gap-2.5">
        <div className="flex items-center gap-5 flex-shrink-0">
          <div className="flex items-center gap-3 flex-shrink-0">
            <Hand className="w-6 h-6 text-clinic-200" />
            <h1 className="text-xl font-semibold tracking-wide text-white/95">
              异宠温控交接台
            </h1>
            <span className="chip bg-white/10 text-white/80 ring-1 ring-white/20">
              已确认 {confirmedIds.length} 条
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 justify-end">
            {summaryCards.map((card) => {
              const drilling =
                card.anomalyType && isDrilling(card.anomalyType);
              return (
                <motion.button
                  key={card.key}
                  onClick={() => {
                    if (!card.clickable) return;
                    if (card.isDuplicate) {
                      handleCardClick('duplicate', []);
                    } else if (card.isMissing) {
                      handleCardClick('missing', card.ids || []);
                    } else {
                      handleCardClick(
                        card.anomalyType as AnomalyType,
                        card.ids || []
                      );
                    }
                  }}
                  whileHover={card.clickable ? { y: -2, scale: 1.03 } : {}}
                  whileTap={card.clickable ? { scale: 0.97 } : {}}
                  animate={drilling ? 'pulse' : undefined}
                  variants={{
                    pulse: {
                      boxShadow: [
                        '0 0 0 0 rgba(255,255,255,0.4)',
                        '0 0 0 12px rgba(255,255,255,0)',
                      ],
                      transition: { repeat: Infinity, duration: 1.4 },
                    },
                  }}
                  className={cn(
                    'relative flex flex-col items-start gap-1 rounded-lg px-3 py-2.5 min-w-[86px] backdrop-blur-sm transition-all flex-shrink-0',
                    card.bg,
                    card.clickable
                      ? 'cursor-pointer hover:bg-white/20 active:scale-95 ring-1 ring-white/10'
                      : 'ring-1 ring-white/10 cursor-default',
                    drilling && 'animate-pulse3 ring-2 ring-white/40',
                    card.animate && !card.clickable && 'animate-gapBeat'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <card.icon className={cn('w-3.5 h-3.5', card.color)} />
                    <span className="text-[11px] text-white/70 font-medium">
                      {card.label}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold leading-none',
                      card.value > 0 ? card.color : 'text-white/60'
                    )}
                  >
                    {card.value}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-5 flex-shrink-0">
          <div className="w-full max-w-[520px] flex-shrink-0">
            <div className="flex items-end justify-between mb-1">
              <span className="text-xs text-white/70">确认进度</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-white">{confirmRate}</span>
                <span className="text-sm text-white/70">%</span>
                <span className="text-xs text-white/50 ml-2">
                  {stats.confirmed}/{stats.total}
                </span>
              </div>
            </div>
            <div className="progress-outer bg-black/20">
              <div
                className="progress-inner"
                style={{ width: `${confirmRate}%` }}
              />
            </div>
            {detailItems.length > 0 && (
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-white/60">
                {detailItems.slice(0, 3).map((item) => (
                  <span key={item.category} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    {item.category} {item.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 glass rounded-lg px-3.5 py-2 flex items-start gap-2.5">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-clinic-100/30 flex items-center justify-center mt-0.5">
              <span className="text-clinic-900 font-serif text-base leading-none">"</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-ink-700 leading-snug whitespace-pre-line text-balance">
                {summary}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
