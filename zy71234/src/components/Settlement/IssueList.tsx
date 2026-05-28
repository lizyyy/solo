import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { Issue } from '../../types';
import { getSeverityColor, getSeverityLabel, getIssueTypeLabel } from '../../utils/issueDetector';

interface IssueListProps {
  issues: Issue[];
}

export function IssueList({ issues }: IssueListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5" />;
      case 'major': return <AlertCircle className="w-5 h-5" />;
      case 'minor': return <Info className="w-5 h-5" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const majorCount = issues.filter(i => i.severity === 'major').length;
  const minorCount = issues.filter(i => i.severity === 'minor').length;

  return (
    <div className="bg-music-card rounded-xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-music-gold font-serif text-lg">
          ⚠️ 问题识别
        </h3>
        <div className="flex gap-3 text-sm">
          {criticalCount > 0 && (
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">
              严重 {criticalCount}
            </span>
          )}
          {majorCount > 0 && (
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
              重要 {majorCount}
            </span>
          )}
          {minorCount > 0 && (
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
              轻微 {minorCount}
            </span>
          )}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-8 text-green-400">
          ✅ 未发现问题，协议合规！
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {issues.map((issue, index) => (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-lg border ${getSeverityColor(issue.severity)} overflow-hidden`}
              >
                <button
                  className="w-full p-4 flex items-center justify-between text-left"
                  onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${getSeverityColor(issue.severity)} p-2 rounded-full bg-opacity-20`}>
                      {getSeverityIcon(issue.severity)}
                    </span>
                    <div>
                      <div className="font-bold">{issue.description}</div>
                      <div className="text-xs text-gray-400">
                        {getIssueTypeLabel(issue.type)} · {getSeverityLabel(issue.severity)}
                      </div>
                    </div>
                  </div>
                  {expandedId === issue.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                <AnimatePresence>
                  {expandedId === issue.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-music-darker rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">📄 原始信息</div>
                            <div className="text-sm text-gray-300">{issue.rawData}</div>
                          </div>
                          <div className="bg-music-darker rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">🔄 处理结果</div>
                            <div className="text-sm text-yellow-300">{issue.processedResult}</div>
                          </div>
                        </div>
                        <div className="bg-music-green/10 rounded-lg p-3 border border-music-green/30">
                          <div className="text-xs text-music-green mb-1">💡 问题解释</div>
                          <div className="text-sm text-gray-300">{issue.explanation}</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
