import { useGameStore } from '../store/gameStore';
import { getIssueTypeLabel, getIssueTypeColor, getSourceLabel } from '../diagnostics/detectors';
import { AlertTriangle, Car, Gauge, Wind, MapPin, Lightbulb, Clock } from 'lucide-react';
import type { DiagnosticIssue } from '../types';

export const DiagnosticsPanel = () => {
  const { currentIssues, currentLap } = useGameStore();

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'car': return Car;
      case 'wing': return Gauge;
      case 'wind': return Wind;
      default: return AlertTriangle;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 4) return 'bg-red-500';
    if (severity >= 3) return 'bg-orange-500';
    if (severity >= 2) return 'bg-yellow-500';
    return 'bg-yellow-400';
  };

  const getSeverityLabel = (severity: number) => {
    if (severity >= 4) return '严重';
    if (severity >= 3) return '较重';
    if (severity >= 2) return '一般';
    return '轻微';
  };

  const IssueCard = ({ issue }: { issue: DiagnosticIssue }) => {
    const SourceIcon = getSourceIcon(issue.triggerSource);
    const isActive = issue.endTime === -1;
    const typeColor = getIssueTypeColor(issue.type);

    return (
      <div className={`p-3 rounded-lg border transition-all ${
        isActive 
          ? 'bg-red-900/20 border-red-500/50 animate-pulse' 
          : 'bg-[#0a1628] border-[#1e3a5f]'
      }`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${typeColor}20` }}
            >
              <AlertTriangle className="w-4 h-4" style={{ color: typeColor }} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">
                {getIssueTypeLabel(issue.type)}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className={`px-1.5 py-0.5 rounded ${getSeverityColor(issue.severity)} text-white text-[9px] font-bold`}>
                  {getSeverityLabel(issue.severity)}
                </span>
                <span>L{issue.severity}</span>
              </div>
            </div>
          </div>
          {isActive && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full animate-pulse">
              进行中
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>时间</span>
            </div>
            <span className="text-white font-mono">
              {formatTime(issue.startTime)}
              {issue.endTime !== -1 && ` - ${formatTime(issue.endTime)}`}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-400">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>赛道位置</span>
            </div>
            <span className="text-white font-mono">
              {(issue.trackPosition * 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-400">
            <div className="flex items-center gap-1">
              <SourceIcon className="w-3 h-3" />
              <span>触发来源</span>
            </div>
            <div className="text-right">
              <span className="text-white">{getSourceLabel(issue.triggerSource)}</span>
              <div className="text-[9px] text-gray-500 font-mono">
                ID: {issue.triggerId.slice(0, 8)}
              </div>
            </div>
          </div>

          <div className="p-2 bg-[#0f1c33] rounded">
            <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
              <span>阈值</span>
              <span>实际值</span>
            </div>
            <div className="flex items-center justify-between text-sm font-mono">
              <span className="text-gray-400">{issue.threshold.toFixed(2)}</span>
              <span className="text-red-400">{issue.actualValue.toFixed(2)}</span>
            </div>
            <div className="mt-1 h-1 bg-[#1e3a5f] rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${Math.min(100, (issue.actualValue / issue.threshold) * 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 p-2 bg-[#00d4ff]/10 rounded">
            <Lightbulb className="w-4 h-4 text-[#00d4ff] flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-[#00d4ff]">{issue.suggestion}</span>
          </div>

          <div className="text-[10px] text-gray-600">
            影响帧: {issue.frames.length} 帧 | 位置: {issue.frames[0]}
            {issue.frames.length > 1 && ` - ${issue.frames[issue.frames.length - 1]}`}
          </div>
        </div>
      </div>
    );
  };

  const activeIssues = currentIssues.filter(i => i.endTime === -1);
  const resolvedIssues = currentLap?.issues.filter(i => i.endTime !== -1) || [];
  const allIssues = currentLap?.issues || currentIssues;

  return (
    <div className="bg-[#0f1c33] border border-[#1e3a5f] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#00d4ff] font-['Orbitron'] tracking-wider">
          实时诊断
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {activeIssues.length > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              {activeIssues.length} 个进行中
            </span>
          )}
          <span className="text-gray-500">
            累计 {allIssues.length} 个问题
          </span>
        </div>
      </div>

      {allIssues.length === 0 ? (
        <div className="bg-[#0a1628] rounded-lg p-6 text-center border border-[#1e3a5f]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-green-500" />
          </div>
          <div className="text-sm text-gray-400">暂无检测到的问题</div>
          <div className="text-xs text-gray-600 mt-1">
            系统将实时监测阻力过大、抓地不足、弯道失控等情况
          </div>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {activeIssues.map(issue => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
          {resolvedIssues.map(issue => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {allIssues.length > 0 && (
        <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
          <div className="text-xs text-gray-400 mb-2">问题分布统计</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-[#ff6b35]/10 rounded">
              <div className="text-lg font-bold text-[#ff6b35]">
                {allIssues.filter(i => i.type === 'high_drag').length}
              </div>
              <div className="text-[10px] text-gray-500">阻力过大</div>
            </div>
            <div className="p-2 bg-[#fbbf24]/10 rounded">
              <div className="text-lg font-bold text-[#fbbf24]">
                {allIssues.filter(i => i.type === 'low_grip').length}
              </div>
              <div className="text-[10px] text-gray-500">抓地不足</div>
            </div>
            <div className="p-2 bg-[#ff4757]/10 rounded">
              <div className="text-lg font-bold text-[#ff4757]">
                {allIssues.filter(i => i.type === 'corner_loss').length}
              </div>
              <div className="text-[10px] text-gray-500">弯道失控</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#0a1628] rounded-lg p-3 border border-[#1e3a5f]">
        <div className="text-xs text-gray-400 mb-2">诊断阈值参考</div>
        <div className="space-y-1 text-[11px] font-mono text-gray-500">
          <div className="flex justify-between">
            <span>阻力过大:</span>
            <span>F<sub>d</sub> &gt; 4000 N</span>
          </div>
          <div className="flex justify-between">
            <span>抓地不足:</span>
            <span>μ &lt; 0.65</span>
          </div>
          <div className="flex justify-between">
            <span>弯道失控:</span>
            <span>所需抓地力 &gt; 0.88 × 可用抓地力</span>
          </div>
        </div>
      </div>
    </div>
  );
};
