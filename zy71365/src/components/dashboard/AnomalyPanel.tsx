import { useState } from 'react';
import { usePortfolioStore, useSelectedWorks } from '../../store/usePortfolioStore';
import { AlertTriangle, ChevronDown, ChevronRight, Layers, StarOff, FileWarning, X } from 'lucide-react';
import { getAnomalyTypeLabel, getSeverityLabel, cn } from '../../lib/utils';
import type { Anomaly } from '../../types';

export default function AnomalyPanel() {
  const anomalies = usePortfolioStore(s => s.anomalies);
  const selectedWorks = useSelectedWorks();
  const toggleSelection = usePortfolioStore(s => s.toggleWorkSelection);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getIcon = (type: Anomaly['type']) => {
    switch (type) {
      case 'duplicate_theme': return Layers;
      case 'low_completion': return StarOff;
      case 'missing_copyright': return FileWarning;
      default: return AlertTriangle;
    }
  };

  const getSeverityColor = (severity: Anomaly['severity']) => {
    return severity === 'critical'
      ? 'text-terracotta-500 bg-terracotta-500/10 border-terracotta-500/30'
      : 'text-amber-500 bg-amber-500/10 border-amber-500/30';
  };

  if (selectedWorks.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-charcoal-700/50 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-cream-400/40" />
        </div>
        <p className="text-cream-400/60 text-sm">请先选择作品以检测异常</p>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="glass-card rounded-xl p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-moss-500/10 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-moss-500/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-moss-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h4 className="font-display text-base font-semibold text-cream-200 mb-1">未检测到异常</h4>
        <p className="text-cream-400/60 text-sm">当前选择的作品组合状态良好</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-terracotta-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-terracotta-500" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-cream-200">异常检测</h3>
            <p className="text-xs text-cream-400/60">共 {anomalies.length} 项问题待处理</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-terracotta-500/20 text-terracotta-500 animate-pulseSoft">
          {anomalies.length} 项
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {anomalies.map((anomaly, index) => {
          const Icon = getIcon(anomaly.type);
          const isExpanded = expandedId === anomaly.id;
          const relatedWorks = selectedWorks.filter(w => anomaly.relatedWorkIds.includes(w.id));

          return (
            <div
              key={anomaly.id}
              className="opacity-0 animate-fadeInUp"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                className="w-full p-4 flex items-start gap-3 hover:bg-charcoal-700/30 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${getSeverityColor(anomaly.severity)}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${anomaly.severity === 'critical' ? 'bg-terracotta-500/20 text-terracotta-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {getSeverityLabel(anomaly.severity)}
                    </span>
                    <span className="text-xs text-cream-400/60">{getAnomalyTypeLabel(anomaly.type)}</span>
                  </div>
                  <p className="text-sm text-cream-200 mt-1 line-clamp-2">{anomaly.description}</p>
                  <p className="text-xs text-cream-400/60 mt-1">
                    关联 {anomaly.relatedWorkIds.length} 件作品
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-cream-400/60 shrink-0 mt-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-cream-400/60 shrink-0 mt-1" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 animate-slideIn">
                  <div className="ml-11 space-y-2">
                    <p className="text-xs text-cream-400/70 font-medium uppercase tracking-wider">
                      关联作品（点击可移除）
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {relatedWorks.map(work => (
                        <button
                          key={work.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(work.id);
                          }}
                          className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-charcoal-700/50 hover:bg-terracotta-500/10 border border-white/5 hover:border-terracotta-500/30 transition-all"
                        >
                          <img
                            src={work.thumbnail}
                            alt={work.title}
                            className="w-8 h-8 rounded object-cover"
                          />
                          <div className="text-left">
                            <p className="text-xs text-cream-200 font-medium line-clamp-1 max-w-[150px]">
                              {work.title}
                            </p>
                            <p className="text-[10px] text-cream-400/60">{work.studentName}</p>
                          </div>
                          <X className="w-3 h-3 text-cream-400/40 group-hover:text-terracotta-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
