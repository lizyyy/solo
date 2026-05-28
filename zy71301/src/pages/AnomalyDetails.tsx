import { useState } from 'react';
import {
  Video,
  FileText,
  Image,
  ClipboardList,
  Radio,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Play,
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import AnomalyCard from '@/components/ui/AnomalyCard';
import { useSessionStore } from '@/store/sessionStore';
import { getRiskLevel, getAnomalyTypeInfo, generateScoreExplanation } from '@/services/riskScoring';
import { cn } from '@/lib/utils';

const materialIcons: Record<string, any> = {
  video: Video,
  log: FileText,
  screenshot: Image,
  questionnaire: ClipboardList,
  telemetry: Radio,
};

const materialLabels: Record<string, string> = {
  video: '视频片段',
  log: '系统日志',
  screenshot: '截图',
  questionnaire: '玩家问卷',
  telemetry: '遥测数据',
};

export default function AnomalyDetails() {
  const {
    anomalyData,
    rules,
    scoreFormula,
    selectedAnomalyId,
    selectAnomaly,
    updateAnomalyReview,
  } = useSessionStore();

  const [activeTab, setActiveTab] = useState<string>('materials');
  const [reviewNote, setReviewNote] = useState('');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const selectedAnomaly = anomalyData.find((a) => a.id === selectedAnomalyId) || anomalyData[0];

  if (!selectedAnomaly) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-dark-500 mx-auto mb-4" />
          <p className="text-dark-400">请从会话分析页面选择一个异常点</p>
        </div>
      </div>
    );
  }

  const riskInfo = getRiskLevel(selectedAnomaly.riskScore);
  const typeInfo = getAnomalyTypeInfo(selectedAnomaly.type);
  const scoreExplanations = generateScoreExplanation(selectedAnomaly, rules, scoreFormula);
  const matchedRuleDetails = selectedAnomaly.matchedRules
    .map((ruleId) => rules.find((r) => r.id === ruleId))
    .filter(Boolean);

  const toggleRuleExpand = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">异常详情</h1>
          <p className="text-dark-400 mt-1">深入分析异常点数据与来源材料</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedAnomalyId || ''}
            onChange={(e) => selectAnomaly(e.target.value)}
            className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2 text-sm text-dark-200 focus:outline-none focus:border-primary-500"
          >
            {anomalyData.map((a) => (
              <option key={a.id} value={a.id}>
                {getAnomalyTypeInfo(a.type).label} - {a.startTime.toFixed(1)}s
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-16 h-16 rounded-xl flex items-center justify-center',
                    riskInfo.bgColor
                  )}
                >
                  <Gauge className={cn('w-8 h-8', riskInfo.color)} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-display font-bold text-white">
                      {typeInfo.label}
                    </h2>
                    <span
                      className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        riskInfo.bgColor,
                        riskInfo.color
                      )}
                    >
                      {riskInfo.level}
                    </span>
                  </div>
                  <p className="text-dark-400 mt-1">{typeInfo.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1 text-dark-400">
                      <Clock className="w-4 h-4" />
                      <span>
                        {selectedAnomaly.startTime.toFixed(1)}s - {selectedAnomaly.endTime.toFixed(1)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-dark-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>置信度 {(selectedAnomaly.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={cn('text-4xl font-display font-bold', riskInfo.color)}>
                  {selectedAnomaly.riskScore}
                </div>
                <div className="text-sm text-dark-400">风险评分</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {selectedAnomaly.peakAcceleration.toFixed(2)}
              </div>
              <div className="text-xs text-dark-400 mt-1">峰值加速度 (m/s²)</div>
            </div>
            <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {selectedAnomaly.avgAcceleration.toFixed(2)}
              </div>
              <div className="text-xs text-dark-400 mt-1">平均加速度 (m/s²)</div>
            </div>
            <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {selectedAnomaly.duration.toFixed(2)}s
              </div>
              <div className="text-xs text-dark-400 mt-1">持续时间</div>
            </div>
            <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {selectedAnomaly.dominantAxis.toUpperCase()}
              </div>
              <div className="text-xs text-dark-400 mt-1">主导轴</div>
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-6">
            <h3 className="font-display font-semibold text-white mb-4">评分构成</h3>
            <div className="space-y-3">
              {scoreExplanations.map((explanation, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5" />
                  <span className="text-sm text-dark-200">{explanation}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-6">
            <h3 className="font-display font-semibold text-white mb-4">匹配规则</h3>
            <div className="space-y-3">
              {matchedRuleDetails.map((rule) => (
                <div
                  key={rule.id}
                  className="border border-dark-600 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleRuleExpand(rule.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-dark-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800">
                        <Info className="w-4 h-4 text-primary-400" />
                      </div>
                      <span className="font-medium text-white">{rule.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-dark-400">权重: {rule.weight}x</span>
                      {expandedRules.has(rule.id) ? (
                        <ChevronDown className="w-4 h-4 text-dark-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-dark-400" />
                      )}
                    </div>
                  </button>
                  {expandedRules.has(rule.id) && (
                    <div className="px-4 pb-4 border-t border-dark-600 pt-4">
                      <p className="text-sm text-dark-300 mb-3">{rule.description}</p>
                      <div className="bg-dark-800/50 rounded-lg p-3">
                        <p className="text-xs text-dark-400 mb-2">规则说明:</p>
                        <p className="text-sm text-dark-300">{rule.explanation}</p>
                      </div>
                      {rule.references.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-dark-400 mb-1">参考依据:</p>
                          <div className="flex flex-wrap gap-2">
                            {rule.references.map((ref, refIdx) => (
                              <span
                                key={refIdx}
                                className="px-2 py-0.5 rounded bg-dark-800 text-xs text-dark-300"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-6">
            <h3 className="font-display font-semibold text-white mb-4">复核操作</h3>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                onClick={() =>
                  updateAnomalyReview(
                    selectedAnomaly.id,
                    'confirmed',
                    reviewNote
                  )
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-500/20 text-success-400 hover:bg-success-500/30 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                确认异常
              </button>
              <button
                onClick={() =>
                  updateAnomalyReview(
                    selectedAnomaly.id,
                    'false_positive',
                    reviewNote
                  )
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                标记误报
              </button>
              <button
                onClick={() =>
                  updateAnomalyReview(
                    selectedAnomaly.id,
                    'needs_review',
                    reviewNote
                  )
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warning-500/20 text-warning-400 hover:bg-warning-500/30 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                待复核
              </button>
            </div>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="添加复核备注..."
              className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-primary-500 resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-display font-semibold text-white mb-3">来源材料</h3>
            <div className="space-y-3">
              {selectedAnomaly.sourceMaterials.map((material) => {
                const Icon = materialIcons[material.type] || FileText;
                const label = materialLabels[material.type] || '材料';

                return (
                  <div key={material.id}>
                    <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-4 hover:border-dark-500 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {material.name}
                          </div>
                          <div className="text-xs text-dark-400">{label}</div>
                        </div>
                        <Play className="w-4 h-4 text-dark-400" />
                      </div>
                      {material.type === 'video' && (
                        <div className="mt-3 aspect-video bg-dark-800 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Play className="w-8 h-8 text-dark-500 mx-auto mb-2" />
                            <p className="text-xs text-dark-500">点击播放</p>
                          </div>
                        </div>
                      )}
                      {material.type === 'log' && (
                        <div className="mt-3 bg-dark-800 rounded-lg p-3 font-mono text-xs text-dark-300 max-h-32 overflow-auto">
                          <p className="text-dark-500">// 日志预览...</p>
                          <p>[{material.startTime.toFixed(3)}s] 加速度异常开始</p>
                          <p>[INFO] Acceleration peak detected</p>
                          <p>[DEBUG] X: 8.5 m/s²</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-dark-400">
                      时间范围: {material.startTime.toFixed(1)}s - {material.endTime.toFixed(1)}s
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-display font-semibold text-white mb-3">其他异常点</h3>
            <div className="space-y-3">
              {anomalyData.slice(0, 3).map((anomaly) => (
                <AnomalyCard
                  key={anomaly.id}
                  anomaly={anomaly}
                  selected={selectedAnomalyId === anomaly.id}
                  onClick={() => selectAnomaly(anomaly.id)}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
