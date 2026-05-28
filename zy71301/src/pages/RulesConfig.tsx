import { useState } from 'react';
import {
  Settings,
  Activity,
  Zap,
  Monitor,
  Move,
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  BookOpen,
  Gauge,
} from 'lucide-react';
import { useSessionStore } from '@/store/sessionStore';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, any> = {
  acceleration: Activity,
  jerk: Zap,
  fps: Monitor,
  pose: Move,
  feedback: MessageSquare,
};

const categoryLabels: Record<string, string> = {
  acceleration: '加速度',
  jerk: '加加速度',
  fps: '帧率',
  pose: '姿态',
  feedback: '反馈',
};

const categoryColors: Record<string, string> = {
  acceleration: 'text-blue-400',
  jerk: 'text-orange-400',
  fps: 'text-purple-400',
  pose: 'text-yellow-400',
  feedback: 'text-pink-400',
};

export default function RulesConfig() {
  const { rules, scoreFormula, updateRule, toggleRule, reprocessAnomalies } = useSessionStore();
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set(['rule_accel_001']));
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [localRules, setLocalRules] = useState(rules);

  const handleThresholdChange = (ruleId: string, key: string, value: number) => {
    setLocalRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, thresholds: { ...r.thresholds, [key]: value } }
          : r
      )
    );
  };

  const handleSaveRule = (ruleId: string) => {
    const rule = localRules.find((r) => r.id === ruleId);
    if (rule) {
      updateRule(ruleId, { thresholds: rule.thresholds });
      setEditingRule(null);
    }
  };

  const handleResetRule = (ruleId: string) => {
    const original = rules.find((r) => r.id === ruleId);
    if (original) {
      setLocalRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...original } : r))
      );
    }
  };

  const groupedRules = localRules.reduce((acc, rule) => {
    if (!acc[rule.category]) acc[rule.category] = [];
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, typeof rules>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">规则配置</h1>
          <p className="text-dark-400 mt-1">管理异常检测规则与评分公式</p>
        </div>
        <button
          onClick={reprocessAnomalies}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          应用规则并重分析
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {Object.entries(groupedRules).map(([category, categoryRules]) => {
            const Icon = categoryIcons[category] || Settings;
            return (
              <div
                key={category}
                className="bg-dark-700/50 rounded-xl border border-dark-600 overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4 border-b border-dark-600 bg-dark-800/50">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center bg-dark-700',
                      categoryColors[category]
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {categoryLabels[category]}规则
                    </h3>
                    <p className="text-xs text-dark-400">
                      {categoryRules.length} 条规则
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-dark-600">
                  {categoryRules.map((rule) => (
                    <div key={rule.id} className="relative">
                      <button
                        onClick={() =>
                          setExpandedRules(
                            (prev) =>
                              new Set(
                                prev.has(rule.id)
                                  ? (prev.delete(rule.id), prev)
                                  : new Set([...prev, rule.id])
                              )
                          )
                        }
                        className="w-full flex items-center justify-between p-4 hover:bg-dark-700/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          {expandedRules.has(rule.id) ? (
                            <ChevronDown className="w-4 h-4 text-dark-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-dark-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {rule.name}
                              </span>
                              {rule.isPreset && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-primary-500/20 text-primary-400">
                                  预设
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-dark-400 mt-0.5">
                              {rule.description}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRule(rule.id);
                          }}
                          className="p-2 hover:bg-dark-600 rounded-lg transition-colors"
                        >
                          {rule.enabled ? (
                            <ToggleRight className="w-6 h-6 text-primary-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-dark-500" />
                          )}
                        </button>
                      </button>

                      {expandedRules.has(rule.id) && (
                        <div className="px-4 pb-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {rule.thresholds.minValue !== undefined && (
                              <div>
                                <label className="block text-xs text-dark-400 mb-1">
                                  最小阈值
                                </label>
                                <input
                                  type="number"
                                  value={rule.thresholds.minValue}
                                  onChange={(e) =>
                                    handleThresholdChange(
                                      rule.id,
                                      'minValue',
                                      parseFloat(e.target.value)
                                    )
                                  }
                                  onFocus={() => setEditingRule(rule.id)}
                                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                              </div>
                            )}
                            {rule.thresholds.maxValue !== undefined && (
                              <div>
                                <label className="block text-xs text-dark-400 mb-1">
                                  最大阈值
                                </label>
                                <input
                                  type="number"
                                  value={rule.thresholds.maxValue}
                                  onChange={(e) =>
                                    handleThresholdChange(
                                      rule.id,
                                      'maxValue',
                                      parseFloat(e.target.value)
                                    )
                                  }
                                  onFocus={() => setEditingRule(rule.id)}
                                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                              </div>
                            )}
                            {rule.thresholds.duration !== undefined && (
                              <div>
                                <label className="block text-xs text-dark-400 mb-1">
                                  持续时间 (秒)
                                </label>
                                <input
                                  type="number"
                                  value={rule.thresholds.duration}
                                  onChange={(e) =>
                                    handleThresholdChange(
                                      rule.id,
                                      'duration',
                                      parseFloat(e.target.value)
                                    )
                                  }
                                  onFocus={() => setEditingRule(rule.id)}
                                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                              </div>
                            )}
                            {rule.thresholds.consecutiveSamples !== undefined && (
                              <div>
                                <label className="block text-xs text-dark-400 mb-1">
                                  连续采样数
                                </label>
                                <input
                                  type="number"
                                  value={rule.thresholds.consecutiveSamples}
                                  onChange={(e) =>
                                    handleThresholdChange(
                                      rule.id,
                                      'consecutiveSamples',
                                      parseInt(e.target.value)
                                    )
                                  }
                                  onFocus={() => setEditingRule(rule.id)}
                                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="block text-xs text-dark-400 mb-2">
                              严重程度映射
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {(['low', 'medium', 'high', 'critical'] as const).map(
                                (level) => (
                                  <div
                                    key={level}
                                    className="bg-dark-800 rounded-lg p-2 text-center"
                                  >
                                    <div
                                      className={cn(
                                        'text-lg font-bold',
                                        level === 'low' && 'text-blue-400',
                                        level === 'medium' && 'text-yellow-400',
                                        level === 'high' && 'text-orange-400',
                                        level === 'critical' && 'text-red-400'
                                      )}
                                    >
                                      {rule.severityMapping[level]}
                                    </div>
                                    <div className="text-xs text-dark-500 capitalize">
                                      {level === 'low'
                                        ? '低'
                                        : level === 'medium'
                                        ? '中'
                                        : level === 'high'
                                        ? '高'
                                        : '严重'}
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div className="bg-dark-800/50 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <BookOpen className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-dark-400 mb-1">
                                  规则说明
                                </p>
                                <p className="text-sm text-dark-200">
                                  {rule.explanation}
                                </p>
                                {rule.references.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {rule.references.map((ref) => (
                                      <span
                                        key={ref}
                                        className="px-2 py-0.5 rounded bg-dark-700 text-xs text-dark-400"
                                      >
                                        {ref}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {editingRule === rule.id && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveRule(rule.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-sm hover:bg-primary-600 transition-colors"
                              >
                                <Save className="w-3.5 h-3.5" />
                                保存
                              </button>
                              <button
                                onClick={() => handleResetRule(rule.id)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-dark-600 text-dark-200 text-sm hover:bg-dark-500 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                重置
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary-500/20">
                <Gauge className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">评分公式</h3>
                <p className="text-xs text-dark-400">{scoreFormula.version}</p>
              </div>
            </div>

            <p className="text-sm text-dark-300 mb-4">{scoreFormula.description}</p>

            <div className="space-y-3">
              <p className="text-xs text-dark-400">权重分配:</p>
              {scoreFormula.components.map((comp, idx) => {
                const rule = rules.find((r) => r.id === comp.ruleId);
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-full bg-dark-800 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${comp.weight * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-dark-300 w-12 text-right">
                      {(comp.weight * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-dark-400 w-20 truncate">
                      {rule?.name || comp.ruleId}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-dark-800/50 rounded-lg">
              <p className="text-xs text-dark-400 mb-2">公式说明:</p>
              <p className="text-xs text-dark-300 whitespace-pre-line">
                {scoreFormula.explanation}
              </p>
            </div>
          </div>

          <div className="bg-dark-700/50 rounded-xl border border-dark-600 p-5">
            <h3 className="font-semibold text-white mb-4">快捷操作</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 rounded-lg bg-dark-800 text-sm text-dark-200 hover:bg-dark-700 transition-colors text-left">
                导入规则配置
              </button>
              <button className="w-full px-4 py-2 rounded-lg bg-dark-800 text-sm text-dark-200 hover:bg-dark-700 transition-colors text-left">
                导出规则配置
              </button>
              <button className="w-full px-4 py-2 rounded-lg bg-dark-800 text-sm text-dark-200 hover:bg-dark-700 transition-colors text-left">
                恢复默认预设
              </button>
            </div>
          </div>

          <div className="bg-warning-500/10 border border-warning-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-warning-500/20 flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4 text-warning-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-warning-400">调整提示</p>
                <p className="text-xs text-dark-400 mt-1">
                  修改阈值后请点击「应用规则并重分析」以更新异常检测结果。建议小幅度调整后观察效果。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
