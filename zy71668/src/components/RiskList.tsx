import { useState } from 'react';
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, Database, Lightbulb, Calculator } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { RiskItem } from '@/types';

export default function RiskList() {
  const result = useAppStore((state) => state.calculationResult);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!result) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-400">
          暂无风险数据
        </h3>
        <p className="text-sm text-slate-500 mt-2">
          请先执行续航估算计算
        </p>
      </div>
    );
  }

  const sortedRisks = [...result.risks].sort((a, b) => {
    const levelOrder = { critical: 0, warning: 1, notice: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  const getRiskStyles = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          border: 'border-danger-500',
          bg: 'bg-danger-500/10',
          icon: <XCircle className="w-5 h-5 text-danger-400" />,
          label: '严重',
          labelBg: 'bg-danger-500',
        };
      case 'warning':
        return {
          border: 'border-warning-500',
          bg: 'bg-warning-500/10',
          icon: <AlertTriangle className="w-5 h-5 text-warning-400" />,
          label: '警告',
          labelBg: 'bg-warning-500',
        };
      default:
        return {
          border: 'border-amber-500',
          bg: 'bg-amber-500/10',
          icon: <Info className="w-5 h-5 text-amber-400" />,
          label: '注意',
          labelBg: 'bg-amber-500',
        };
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      battery: '电池',
      wind: '风速',
      payload: '载重',
      navigation: '导航',
      data: '数据',
    };
    return labels[category] || category;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-100">风险评估报告</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">共</span>
          <span className="px-2 py-1 bg-danger-500/20 text-danger-400 rounded text-sm font-mono">
            {result.risks.filter((r) => r.level === 'critical').length} 严重
          </span>
          <span className="px-2 py-1 bg-warning-500/20 text-warning-400 rounded text-sm font-mono">
            {result.risks.filter((r) => r.level === 'warning').length} 警告
          </span>
          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-sm font-mono">
            {result.risks.filter((r) => r.level === 'notice').length} 注意
          </span>
        </div>
      </div>

      {sortedRisks.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-500/20 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <h3 className="text-lg font-semibold text-success-400 mb-2">
            未检测到风险
          </h3>
          <p className="text-sm text-slate-400">
            当前参数配置下，飞行风险较低，可以安全执行任务
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRisks.map((risk: RiskItem) => {
            const styles = getRiskStyles(risk.level);
            const isExpanded = expandedId === risk.id;

            return (
              <div
                key={risk.id}
                className={`card border-l-4 ${styles.border} ${styles.bg} overflow-hidden`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(risk.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {styles.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 ${styles.labelBg} text-white text-xs font-medium rounded`}
                        >
                          {styles.label}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-600 text-slate-200 text-xs rounded">
                          {getCategoryLabel(risk.category)}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-100">
                        {risk.title}
                      </h4>
                    </div>
                    <button className="flex-shrink-0 p-1 hover:bg-slate-700/50 rounded transition-colors">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 mt-3">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-300">问题描述</span>
                        </div>
                        <p className="text-sm text-slate-400 ml-6">
                          {risk.description}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-300">数据来源</span>
                        </div>
                        <p className="text-sm text-slate-400 ml-6">
                          {risk.source}
                        </p>
                      </div>

                      {risk.formula && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Calculator className="w-4 h-4 text-slate-400" />
                            <span className="text-sm font-medium text-slate-300">计算公式</span>
                          </div>
                          <div className="ml-6 p-3 bg-slate-900/50 rounded font-mono text-sm text-aviation-300">
                            {risk.formula}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-300">建议措施</span>
                        </div>
                        <p className="text-sm text-slate-400 ml-6">
                          {risk.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
