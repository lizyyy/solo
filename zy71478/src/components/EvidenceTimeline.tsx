import { useAppStore } from '../store/appStore';
import { getSourceText, getCorroborationText } from '../engine/evidence';
import { formatDateTime, formatVelocity, formatPercent } from '../utils/format';
import { 
  Link2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Thermometer, 
  Ruler, 
  Timer, 
  Settings,
  ChevronDown,
  ChevronRight,
  Shield,
  XCircle,
  Zap,
  ListOrdered
} from 'lucide-react';
import { useState } from 'react';
import { EvidenceItem } from '../types';

const sourceIcons: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  distance: Ruler,
  time: Timer,
  device: Settings,
  system: Zap,
};

const sourceColors: Record<string, string> = {
  temperature: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  distance: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
  time: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  device: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  system: 'text-slate-400 bg-slate-500/20 border-slate-500/30',
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  anomaly: AlertTriangle,
  temperature_conclusion: Thermometer,
  distance_conclusion: Ruler,
  time_diff_evidence: Timer,
  calibration_detail: Settings,
  calculation_step: ListOrdered,
};

export default function EvidenceTimeline() {
  const { currentEvidenceChain, currentAnomalies } = useAppStore();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'sequence' | 'timestamp' | 'type'>('sequence');

  if (!currentEvidenceChain) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Link2 className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">暂无证据链数据</p>
          <p className="text-sm mt-2 opacity-60">执行计算后将展示完整证据链</p>
        </div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const sortedItems = [...currentEvidenceChain.items].sort((a, b) => {
    if (sortBy === 'timestamp') return a.timestamp - b.timestamp;
    if (sortBy === 'type') return a.type.localeCompare(b.type);
    return a.sequence - b.sequence;
  });

  const corroborationConfig = {
    full: { icon: CheckCircle2, color: 'text-emerald-400', label: '完全印证' },
    partial: { icon: AlertTriangle, color: 'text-amber-400', label: '部分印证' },
    none: { icon: XCircle, color: 'text-red-400', label: '无印证' },
  };

  const corrobConfig = corroborationConfig[currentEvidenceChain.corroborationLevel];
  const CorrobIcon = corrobConfig.icon;

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Link2 className="w-5 h-5 text-blue-400" />
          证据链与时序追踪
        </h2>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${corrobConfig.color.replace('text-', 'bg-').replace('400', '500/10')} border ${corrobConfig.color.replace('text-', 'border-').replace('400', '500/30')}`}>
            <CorrobIcon className={`w-4 h-4 ${corrobConfig.color}`} />
            <span className={`text-sm font-medium ${corrobConfig.color}`}>
              {getCorroborationText(currentEvidenceChain.corroborationLevel)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">排序:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="sequence">处理顺序</option>
              <option value="timestamp">时间顺序</option>
              <option value="type">类型分组</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-blue-300 mb-1">整体结论</div>
            <p className="text-white">{currentEvidenceChain.overallConclusion}</p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-slate-400">
                置信度: <span className="text-white font-mono">{currentEvidenceChain.confidence}%</span>
              </span>
              <span className="text-slate-400">
                证据项: <span className="text-white font-mono">{currentEvidenceChain.items.length}</span>
              </span>
              {currentAnomalies.length > 0 && (
                <span className="text-slate-400">
                  异常: <span className="text-amber-400 font-mono">{currentAnomalies.length}</span>
                </span>
              )}
            </div>
            {currentEvidenceChain.contradictions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-sm text-red-400 font-medium mb-1">检测到矛盾:</div>
                {currentEvidenceChain.contradictions.map((c, i) => (
                  <p key={i} className="text-sm text-red-300">• {c}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-slate-600 to-slate-700" />
        
        <div className="space-y-1">
          {sortedItems.map((item: EvidenceItem, index: number) => {
            const SourceIcon = sourceIcons[item.source] || Zap;
            const TypeIcon = typeIcons[item.type] || ListOrdered;
            const isExpanded = expandedItems.has(item.id);
            const isAnomaly = item.type === 'anomaly';
            
            return (
              <div key={item.id} className="relative pl-14 pb-4">
                <div className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isAnomaly 
                    ? 'bg-red-500 border-red-400' 
                    : sourceColors[item.source].split(' ')[1].replace('bg-', 'bg-').replace('/20', '') + ' border-white/30'
                }`}>
                  <TypeIcon className="w-3 h-3 text-white" />
                </div>

                <div
                  onClick={() => toggleExpand(item.id)}
                  className={`cursor-pointer rounded-xl border transition-all ${
                    isAnomaly
                      ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                      : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-mono text-slate-300">
                          #{item.sequence}
                        </span>
                        <div className={`px-2 py-0.5 rounded-md text-xs flex items-center gap-1 ${sourceColors[item.source]}`}>
                          <SourceIcon className="w-3 h-3" />
                          {getSourceText(item.source)}
                        </div>
                        <span className={`text-sm font-medium ${isAnomaly ? 'text-red-300' : 'text-white'}`}>
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.value !== undefined && (
                          <span className="text-sm font-mono text-slate-300">
                            {item.value.toFixed(2)}{item.unit ? ` ${item.unit}` : ''}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-600/50">
                        <p className="text-sm text-slate-300">{item.content}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(item.timestamp)}
                          </span>
                          <span>类型: {item.type}</span>
                          {item.supports && item.supports.length > 0 && (
                            <span>支持: {item.supports.join(', ')}</span>
                          )}
                          {item.contradicts && item.contradicts.length > 0 && (
                            <span className="text-red-400">矛盾: {item.contradicts.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {index === sortedItems.length - 1 && (
                  <div className="absolute left-4 w-5 h-5 rounded-full bg-emerald-500 border-2 border-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
        <span>排序方式: {sortBy === 'sequence' ? '按处理顺序' : sortBy === 'timestamp' ? '按时间顺序' : '按类型分组'}</span>
        <span>共 {currentEvidenceChain.items.length} 项证据</span>
      </div>
    </div>
  );
}
