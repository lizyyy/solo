import { History, RotateCcw, User, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useSwingStore } from '@/store/useSwingStore';
import { getChangeTypeLabel, getChangeTypeColor } from '@/utils/versionControl';
import { DataVersion } from '@/types';

interface VersionCardProps {
  version: DataVersion;
  isLatest: boolean;
}

function VersionCard({ version, isLatest }: VersionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const typeColor = getChangeTypeColor(version.changeType);
  
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    'golf-blue': { bg: 'bg-golf-blue/20', text: 'text-golf-blue', border: 'border-golf-blue/50' },
    'golf-green': { bg: 'bg-golf-green/20', text: 'text-golf-green', border: 'border-golf-green/50' },
    'golf-orange': { bg: 'bg-golf-orange/20', text: 'text-golf-orange', border: 'border-golf-orange/50' },
    'golf-text-muted': { bg: 'bg-golf-text-muted/20', text: 'text-golf-text-muted', border: 'border-golf-text-muted/50' },
  };
  
  const colors = colorMap[typeColor] || colorMap['golf-text-muted'];
  
  const formatDiffValue = (value: any): string => {
    if (value === null || value === undefined) return '无';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  const diffEntries = Object.entries(version.diffData || {});
  
  return (
    <div className={`p-3 bg-golf-bg-light border rounded-lg mb-2 transition-all ${
      isLatest ? 'border-golf-green/50' : 'border-golf-border'
    }`}>
      <div 
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
          <span className="text-xs font-bold">v{version.versionNumber}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {getChangeTypeLabel(version.changeType)}
            </span>
            {isLatest && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-golf-green/20 text-golf-green">
                最新
              </span>
            )}
            <span className="ml-auto text-xs text-golf-text-dim font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(version.createdAt).toLocaleTimeString()}
            </span>
          </div>
          
          <p className="text-sm text-golf-text mb-1 line-clamp-1">
            {version.remark}
          </p>
          
          <div className="flex items-center gap-4 text-xs text-golf-text-muted">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {version.changedBy}
            </span>
            {diffEntries.length > 0 && (
              <span className="flex items-center gap-1">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {diffEntries.length} 处变更
              </span>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && diffEntries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-golf-border/50 animate-fade-in">
          <div className="text-xs text-golf-text-muted mb-2">变更详情</div>
          <div className="space-y-2">
            {diffEntries.map(([key, value]) => (
              <div key={key} className="p-2 bg-golf-bg rounded-lg">
                <div className="text-xs text-golf-blue font-mono mb-1">{key}</div>
                {typeof value === 'object' && value !== null && 'old' in value && 'new' in value ? (
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] px-1 py-0.5 bg-golf-red/20 text-golf-red rounded flex-shrink-0">旧值</span>
                      <span className="text-xs text-golf-text-muted font-mono break-all">
                        {formatDiffValue((value as any).old)}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] px-1 py-0.5 bg-golf-green/20 text-golf-green rounded flex-shrink-0">新值</span>
                      <span className="text-xs text-golf-text font-mono break-all">
                        {formatDiffValue((value as any).new)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-golf-text font-mono break-all">
                    {formatDiffValue(value)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function VersionHistoryPanel() {
  const { 
    currentSession, 
    activePanel,
  } = useSwingStore();
  
  if (!currentSession || activePanel !== 'history') return null;
  
  const versions = [...currentSession.versions].reverse();
  
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-golf-blue" />
        <h2 className="text-lg font-semibold text-golf-text">版本历史</h2>
        <span className="ml-auto text-xs text-golf-text-muted font-mono">
          共 {versions.length} 个版本
        </span>
      </div>
      
      <div className="mb-4 p-3 bg-golf-bg-light border border-golf-border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="w-4 h-4 text-golf-green" />
          <span className="text-sm font-medium text-golf-text">版本说明</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-golf-blue" />
            <span className="text-golf-text-muted">创建</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-golf-green" />
            <span className="text-golf-text-muted">更新</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-golf-orange" />
            <span className="text-golf-text-muted">补录</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-golf-text-muted" />
            <span className="text-golf-text-muted">导入</span>
          </div>
        </div>
      </div>
      
      {versions.length === 0 ? (
        <div className="text-center py-12 text-golf-text-muted">
          <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无版本记录</p>
          <p className="text-xs mt-1">系统将自动记录所有数据变更</p>
        </div>
      ) : (
        <div className="space-y-1">
          {versions.map((version, index) => (
            <VersionCard
              key={version.versionId}
              version={version}
              isLatest={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
