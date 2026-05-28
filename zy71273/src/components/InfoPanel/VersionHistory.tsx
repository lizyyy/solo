import { History, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { Artwork } from '../../types/artwork';
import { GlassCard } from '../common/GlassCard';
import { getVersionDiff } from '../../utils/versionManager';

interface VersionHistoryProps {
  artwork: Artwork;
}

export function VersionHistory({ artwork }: VersionHistoryProps) {
  if (artwork.versionHistory.length <= 1) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-white/90">版本历史</h3>
        <span className="ml-auto text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
          {artwork.versionHistory.length} 个版本
        </span>
      </div>

      <div className="space-y-3">
        {[...artwork.versionHistory].reverse().map((version, index, arr) => {
          const isLatest = index === 0;
          const prevVersion = arr[index + 1];
          const diff = prevVersion ? getVersionDiff(prevVersion, version) : [];

          return (
            <div key={version.version} className="relative">
              {index < arr.length - 1 && (
                <div className="absolute left-3 top-8 bottom-0 w-px bg-white/10" />
              )}
              
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  isLatest ? 'bg-indigo-500/30' : 'bg-white/10'
                }`}>
                  {isLatest ? (
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      isLatest ? 'text-white' : 'text-white/70'
                    }`}>
                      {version.version}
                    </span>
                    <span className="text-xs text-white/40">
                      {formatDate(version.timestamp)}
                    </span>
                    {isLatest && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                        当前
                      </span>
                    )}
                  </div>
                  
                  {version.note && (
                    <p className="text-xs text-white/60 mt-1">{version.note}</p>
                  )}
                  
                  {diff.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {diff.map((change, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <ChevronRight className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          <span className="text-white/50">{change}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {version.fields.hue === null && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400/80">
                      <AlertTriangle className="w-3 h-3" />
                      <span>此版本缺少色彩数据</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
