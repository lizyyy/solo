import { Calendar, Music2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getCategoryStats } from '../../utils/calculations';
import { getCategoryColor } from '../../utils/classification';

export function Timeline() {
  const { batches, deviations, selectedBatchId, setSelectedBatchId } = useAppStore();

  const sortedBatches = [...batches].sort((a, b) => 
    a.rehearsalDate.localeCompare(b.rehearsalDate)
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'final': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reviewed': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="w-48 flex-shrink-0 border-r border-cream-300 bg-white/50 p-4 overflow-y-auto scrollbar-thin">
      <h3 className="font-serif text-sm font-semibold text-primary mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-accent" />
        排练时间线
      </h3>

      <div className="relative">
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gradient-to-b from-accent/30 via-primary/20 to-transparent" />

        {sortedBatches.map((batch, index) => {
          const stats = getCategoryStats(deviations, batch.id);
          const isSelected = selectedBatchId === batch.id;
          const hasIssues = stats.persistent > 0 || stats.occasional > 0;

          return (
            <button
              key={batch.id}
              onClick={() => setSelectedBatchId(batch.id)}
              className={`relative w-full text-left mb-4 pl-8 pr-2 py-3 rounded-lg transition-all duration-200 group ${
                isSelected
                  ? 'bg-accent/10 border border-accent/30 shadow-sm'
                  : 'hover:bg-white/80 border border-transparent'
              }`}
            >
              <div
                className={`absolute left-1.5 top-3.5 w-3 h-3 rounded-full border-2 transition-all ${
                  isSelected
                    ? 'bg-accent border-accent scale-125'
                    : hasIssues
                    ? 'bg-white border-deviation-severe'
                    : 'bg-white border-primary/30'
                }`}
              />

              {batch.keyChanged && (
                <div className="absolute -left-0.5 top-0 w-2 h-2 bg-accent rounded-full animate-pulse-soft" title="转调批次" />
              )}

              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${
                  isSelected ? 'text-accent-700' : 'text-primary-600'
                }`}>
                  {batch.rehearsalDate.slice(5)}
                </span>
                {getStatusIcon(batch.status)}
              </div>

              <div className="text-xs font-medium text-primary truncate mb-1">
                {batch.title.replace(/第.*次排练录音/, '第$1次')}
              </div>

              {hasIssues && (
                <div className="flex items-center gap-1 mt-1">
                  {stats.persistent > 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${getCategoryColor('persistent')}15`, color: getCategoryColor('persistent') }}
                    >
                      {stats.persistent}持
                    </span>
                  )}
                  {stats.occasional > 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${getCategoryColor('occasional')}15`, color: getCategoryColor('occasional') }}
                    >
                      {stats.occasional}偶
                    </span>
                  )}
                  {stats.unreviewed > 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${getCategoryColor('unreviewed')}15`, color: getCategoryColor('unreviewed') }}
                    >
                      {stats.unreviewed}未
                    </span>
                  )}
                </div>
              )}

              {batch.keyChanged && (
                <div className="mt-1 flex items-center gap-1">
                  <Music2 className="w-3 h-3 text-accent" />
                  <span className="text-[10px] text-accent-600">
                    {batch.previousKey}→{batch.keySignature}
                  </span>
                </div>
              )}

              {batch.missingMeasures && batch.missingMeasures.length > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] text-orange-600">
                    缺{batch.missingMeasures.length}小节
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-cream-200">
        <h4 className="text-xs font-medium text-primary-500 mb-2">图例说明</h4>
        <div className="space-y-2 text-[10px] text-primary-600">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-deviation-severe" />
            <span>持续跑偏</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-deviation-mild" />
            <span>偶发失误</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-deviation-unreviewed" />
            <span>未复核</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400 opacity-50" />
            <span>异常数据（不计入平均）</span>
          </div>
        </div>
      </div>
    </div>
  );
}
