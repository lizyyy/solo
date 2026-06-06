import { Clock, ArrowRight, User, FileText, Edit3, RefreshCw, Mic, Camera } from 'lucide-react';
import { useAppStore } from '@/store';
import { HistoryAction } from '@/types';

export const History = () => {
  const { history, batches } = useAppStore();

  const actionConfig: Record<HistoryAction, { label: string; icon: typeof Clock; color: string }> = {
    import: { label: '导入', icon: FileText, color: 'bg-blue-700/30 text-blue-300 border-blue-700/30' },
    correct: { label: '修正', icon: Edit3, color: 'bg-purple-700/30 text-purple-300 border-purple-700/30' },
    rerun: { label: '重跑', icon: RefreshCw, color: 'bg-yellow-700/30 text-yellow-300 border-yellow-700/30' },
    review: { label: '复核', icon: Mic, color: 'bg-orange-700/30 text-orange-300 border-orange-700/30' },
    supplement: { label: '补录', icon: Camera, color: 'bg-gray-700/30 text-gray-300 border-gray-700/30' },
  };

  const getBatchName = (targetId: string) => {
    const batch = batches.find((b) => b.id === targetId || b.tracks.some((t) => t.id === targetId));
    return batch?.name || targetId;
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gold-200 text-shadow-gold mb-2">
            历史记录
          </h1>
          <p className="text-white/60">
            所有操作的完整轨迹，包括导入、修正、重跑和复核
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />
            
            <div className="space-y-6">
              {history.map((record, index) => {
                const config = actionConfig[record.action];
                const Icon = config.icon;
                return (
                  <div key={record.id} className="relative pl-16 animate-slide-in" style={{ animationDelay: `${index * 0.05}s` }}>
                    <div className={`absolute left-4 w-5 h-5 rounded-full border-2 ${config.color} flex items-center justify-center transform -translate-x-1/2 bg-gray-900`}>
                      <Icon size={10} />
                    </div>
                    
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-gold-800/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-sm text-white/80 font-medium">
                            {record.targetType === 'batch' ? '批次' : '曲目'}操作
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <Clock size={12} />
                          {record.timestamp}
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <p className="text-sm text-white/60 mb-1">
                          关联：<span className="text-gold-300 font-mono">{getBatchName(record.targetId)}</span>
                        </p>
                      </div>

                      {record.beforeValue !== '-' && (
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex-1 p-2 rounded bg-red-900/20 border border-red-800/30">
                            <span className="text-red-400 text-xs">变更前</span>
                            <p className="text-white/70">{record.beforeValue}</p>
                          </div>
                          <ArrowRight size={16} className="text-white/30 flex-shrink-0" />
                          <div className="flex-1 p-2 rounded bg-forest-900/20 border border-forest-800/30">
                            <span className="text-forest-400 text-xs">变更后</span>
                            <p className="text-white/70">{record.afterValue}</p>
                          </div>
                        </div>
                      )}

                      {record.beforeValue === '-' && (
                        <div className="p-2 rounded bg-wine-900/20 border border-wine-800/30">
                          <p className="text-white/70 text-sm">{record.afterValue}</p>
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                        <User size={12} />
                        操作人：{record.operator}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
