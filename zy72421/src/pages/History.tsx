import { Clock, ArrowRight, User, FileText, Edit3, RefreshCw, Mic, Camera, Image as ImageIcon, MessageSquare } from 'lucide-react';
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
    add_photo: { label: '添加照片', icon: ImageIcon, color: 'bg-teal-700/30 text-teal-300 border-teal-700/30' },
  };

  const getBatchName = (targetId: string) => {
    const batch = batches.find((b) => b.id === targetId || b.tracks.some((t) => t.id === targetId));
    return batch?.name || targetId;
  };

  const getTrackName = (targetId: string) => {
    for (const batch of batches) {
      const track = batch.tracks.find((t) => t.id === targetId);
      if (track) return track.name;
    }
    return null;
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gold-200 text-shadow-gold mb-2">
            历史记录
          </h1>
          <p className="text-white/60">
            所有操作的完整轨迹，包括导入、修正、重跑、复核和补录
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />
            
            <div className="space-y-6">
              {history.map((record, index) => {
                const config = actionConfig[record.action];
                const Icon = config.icon;
                const trackName = record.targetType === 'track' ? getTrackName(record.targetId) : null;
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
                            {trackName && <span className="text-gold-300 ml-1">「{trackName}」</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <Clock size={12} />
                          {record.timestamp}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-white/60">
                          关联批次：<span className="text-gold-300 font-mono">{getBatchName(record.targetId)}</span>
                        </p>
                      </div>

                      {record.action === 'supplement' && record.detail && (
                        <div className="mb-3 p-3 rounded-lg bg-gray-800/40 border border-gray-700/40 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <MessageSquare size={12} />
                            <span>补录详情</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">修改人：</span>
                              <span className="text-white/70">{record.operator}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">修改原因：</span>
                              <span className="text-white/70">{record.detail.reason}</span>
                            </div>
                          </div>
                          <div className="mt-2 p-2 rounded bg-wine-900/20 border-l-2 border-gold-800">
                            <p className="text-xs text-gray-400 mb-1">照片原话：</p>
                            <p className="text-sm text-gold-200 italic">"{record.detail.photoRemark}"</p>
                          </div>
                        </div>
                      )}

                      {record.action === 'add_photo' && record.detail && (
                        <div className="mb-3 p-3 rounded-lg bg-teal-900/20 border border-teal-800/30">
                          <p className="text-xs text-teal-300 mb-1">📸 添加的照片备注：</p>
                          <p className="text-sm text-white/70">{record.detail.photoRemark}</p>
                        </div>
                      )}

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

                      {record.detail?.fieldChanges && record.detail.fieldChanges.length > 0 && record.action !== 'supplement' && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <p className="text-xs text-white/40 mb-2">字段变更明细：</p>
                          <div className="space-y-1">
                            {record.detail.fieldChanges.map((change, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <span className="text-white/40 w-16">{change.field}:</span>
                                <span className="text-red-400">{change.before}</span>
                                <ArrowRight size={10} className="text-white/30" />
                                <span className="text-forest-400">{change.after}</span>
                              </div>
                            ))}
                          </div>
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
