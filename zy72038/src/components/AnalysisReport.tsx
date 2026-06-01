import React from 'react';
import {
  Trophy,
  XCircle,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Lightbulb,
  Scale,
  ArrowRight,
} from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { formatTime } from '@/utils/gameUtils';
import { FailureReason } from '@/types/game';

const failureReasonConfig: Record<FailureReason, {
  icon: React.ReactNode;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  rule_understanding: {
    icon: <Brain className="w-6 h-6" />,
    title: '规则理解问题',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  slow_operation: {
    icon: <Zap className="w-6 h-6" />,
    title: '操作速度问题',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  mixed: {
    icon: <AlertTriangle className="w-6 h-6" />,
    title: '综合问题',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
};

export const AnalysisReport: React.FC = () => {
  const { report, actions, resetGame } = useGameStore();

  if (!report) {
    return (
      <div className="bg-slate-800/90 backdrop-blur rounded-xl p-6 border border-slate-700">
        <div className="text-center py-8 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>游戏结束后将生成分析报告</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur rounded-xl p-6 space-y-6 border border-slate-700">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">游戏分析报告</h2>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            report.isSuccess
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}
        >
          {report.isSuccess ? (
            <Trophy className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span className="font-bold">
            {report.isSuccess ? '防守成功！' : '防守失败'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{report.finalScore}</div>
          <div className="text-xs text-slate-400 mt-1">最终得分</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-cyan-400">
            {report.completedWaves}/{report.totalWaves}
          </div>
          <div className="text-xs text-slate-400 mt-1">完成波次</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-400">
            {formatTime(report.totalPlayTime)}
          </div>
          <div className="text-xs text-slate-400 mt-1">游戏时长</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-400">
            {report.avgResponseTime.toFixed(0)}ms
          </div>
          <div className="text-xs text-slate-400 mt-1">平均响应</div>
        </div>
      </div>

      {!report.isSuccess && report.failureReason && (
        <div
          className={`p-4 rounded-lg border ${failureReasonConfig[report.failureReason].bgColor} ${failureReasonConfig[report.failureReason].borderColor}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={failureReasonConfig[report.failureReason].color}>
              {failureReasonConfig[report.failureReason].icon}
            </div>
            <div>
              <h3
                className={`font-bold ${failureReasonConfig[report.failureReason].color}`}
              >
                {failureReasonConfig[report.failureReason].title}
              </h3>
              <p className="text-slate-300 text-sm">
                {report.failureReasonDescription}
              </p>
            </div>
          </div>

          {report.ruleViolations > 0 && (
            <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
                <Brain className="w-4 h-4" />
                <span>规则违规: {report.ruleViolations} 次</span>
              </div>
              <p className="text-slate-400 text-xs">
                建议复习游戏规则，特别注意防守塔的建造条件和位置限制
              </p>
            </div>
          )}

          {report.avgResponseTime > 2000 && (
            <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-2 text-orange-400 text-sm mb-2">
                <Clock className="w-4 h-4" />
                <span>响应较慢: 平均 {report.avgResponseTime.toFixed(0)}ms</span>
              </div>
              <p className="text-slate-400 text-xs">
                建议提升操作熟练度，通过简单关卡反复练习可以加快反应速度
              </p>
            </div>
          )}
        </div>
      )}

      {report.evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            证据记录
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {report.evidence.map((evidence) => (
              <div
                key={evidence.id}
                className="p-3 bg-slate-700/50 rounded-lg flex items-start gap-3"
              >
                <div
                  className={`p-2 rounded-lg ${
                    evidence.type === 'rule'
                      ? 'bg-purple-500/20 text-purple-400'
                      : evidence.type === 'action'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-600 text-slate-400'
                  }`}
                >
                  {evidence.type === 'rule' ? (
                    <Brain className="w-4 h-4" />
                  ) : evidence.type === 'action' ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm">{evidence.description}</p>
                  {evidence.details && (
                    <p className="text-slate-400 text-xs mt-1">
                      {evidence.details}
                    </p>
                  )}
                  <p className="text-slate-500 text-xs mt-1">
                    来源: {evidence.source}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.conflicts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            数据冲突检测
          </h3>
          <div className="space-y-3">
            {report.conflicts.map((conflict, index) => (
              <div
                key={index}
                className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg"
              >
                <p className="text-yellow-300 text-sm mb-3">
                  字段: {conflict.field}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 p-2 bg-slate-800 rounded">
                    <div className="text-xs text-slate-400 mb-1">计分表值</div>
                    <div className="text-green-400 font-mono text-sm">
                      {conflict.scoreboardValue}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div className="flex-1 p-2 bg-slate-800 rounded">
                    <div className="text-xs text-slate-400 mb-1">导入值</div>
                    <div className="text-yellow-400 font-mono text-sm">
                      {conflict.importedValue}
                    </div>
                  </div>
                </div>
                <p className="text-slate-400 text-xs mt-3 flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  建议: {conflict.suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-cyan-400" />
            改进建议
          </h3>
          <ul className="space-y-2">
            {report.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-slate-300 text-sm"
              >
                <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <button
          onClick={resetGame}
          className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
        >
          重新开始
        </button>
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-600 transition-all"
        >
          导出报告
        </button>
      </div>
    </div>
  );
};
