import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, ShieldCheck, ShieldX, RefreshCw, Info, User, Calendar, Code, Server } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useFlagStore } from '../store/flagStore';
import { Card } from '../components/Card';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RiskBadge } from '../components/RiskBadge';
import { getRiskLevelLabel, getSuggestedActionLabel } from '../utils/riskCalculator';
import { formatDate } from '../utils/dateUtils';
import type { RiskLevel, SuggestedAction } from '../types';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  blocker: '#DC2626',
};

const ACTION_COLORS: Record<SuggestedAction, string> = {
  safe_delete: '#10B981',
  verify_first: '#F59E0B',
  do_not_delete: '#DC2626',
};

const RISK_ICONS: Record<RiskLevel, React.ReactNode> = {
  low: <ShieldCheck className="w-6 h-6" />,
  medium: <AlertTriangle className="w-6 h-6" />,
  high: <ShieldAlert className="w-6 h-6" />,
  blocker: <ShieldX className="w-6 h-6" />,
};

export function RiskAssessment() {
  const {
    flags,
    rules,
    initData,
    loading,
    reAssessAll,
    getStatistics,
  } = useFlagStore();

  const [selectedLevel, setSelectedLevel] = useState<RiskLevel | 'all'>('all');

  useEffect(() => {
    if (flags.length === 0) initData();
  }, [flags.length, initData]);

  const stats = getStatistics();

  const riskDistribution = Object.entries(stats.byRiskLevel).map(([level, count]) => ({
    name: getRiskLevelLabel(level as RiskLevel),
    value: count,
    color: RISK_COLORS[level as RiskLevel],
  }));

  const actionStats: Record<SuggestedAction, number> = {
    safe_delete: flags.filter(f => f.suggestedAction === 'safe_delete').length,
    verify_first: flags.filter(f => f.suggestedAction === 'verify_first').length,
    do_not_delete: flags.filter(f => f.suggestedAction === 'do_not_delete').length,
  };

  const actionData = Object.entries(actionStats).map(([action, count]) => ({
    name: getSuggestedActionLabel(action as SuggestedAction),
    value: count,
    color: ACTION_COLORS[action as SuggestedAction],
  }));

  const blockerFlags = flags.filter(f => f.riskLevel === 'blocker');
  const highRiskFlags = flags.filter(f => f.riskLevel === 'high');
  const missingOwnerFlags = flags.filter(f => !f.owner);

  const filteredFlags = selectedLevel === 'all'
    ? flags.filter(f => f.riskLevel === 'blocker' || f.riskLevel === 'high')
    : flags.filter(f => f.riskLevel === selectedLevel);

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在加载..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">风险评估中心</h1>
          <p className="text-gray-500 mt-1">自动识别风险开关，分级展示并给出清理建议</p>
        </div>
        <button onClick={() => reAssessAll()} className="btn-primary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          重新评估
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {(['low', 'medium', 'high', 'blocker'] as RiskLevel[]).map(level => (
          <Card
            key={level}
            title={getRiskLevelLabel(level)}
            value={stats.byRiskLevel[level]}
            icon={RISK_ICONS[level]}
            color={level === 'low' ? 'green' : level === 'medium' ? 'orange' : 'red'}
            trend={level === 'blocker' ? '禁止清理' : level === 'high' ? '需要核查' : level === 'medium' ? '建议确认' : '可安全清理'}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">风险等级分布</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">建议操作分布</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {actionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{blockerFlags.length}</p>
                <p className="text-sm text-gray-500">阻塞项</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-orange-100 rounded-xl">
                <ShieldAlert className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{highRiskFlags.length}</p>
                <p className="text-sm text-gray-500">高风险</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <User className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{missingOwnerFlags.length}</p>
                <p className="text-sm text-gray-500">负责人缺失</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {missingOwnerFlags.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-risk-medium" />
              <h2 className="text-lg font-semibold text-gray-900">负责人缺失告警</h2>
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 mb-4">
            <div className="flex items-start gap-3">
              <User className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800 mb-1">负责人缺失提示</p>
                <p className="text-sm text-orange-700 leading-relaxed">
                  ⚠️ 以下开关未登记负责人，无法确认清理影响范围。
                  建议联系该模块最近的代码提交者补充信息。
                  当前共有 <strong>{missingOwnerFlags.length}</strong> 个开关缺少负责人。
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {missingOwnerFlags.slice(0, 9).map(flag => (
              <div key={flag.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">{flag.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">{flag.key}</p>
                {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {blockerFlags.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldX className="w-5 h-5 text-risk-blocker" />
            <h2 className="text-lg font-semibold text-gray-900">阻塞项 - 禁止清理</h2>
          </div>
          <div className="space-y-4">
            {blockerFlags.map(flag => (
              <div key={flag.id} className="p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-gray-900">{flag.name}</p>
                      <RiskBadge level="blocker" />
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-1">{flag.key}</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <User className="w-3 h-3" />
                      <span>{flag.owner || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{flag.launchDate ? formatDate(flag.launchDate) : '-'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {flag.riskReasons.map((reason, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg">
                      <p className={`text-sm font-medium ${reason.severity === 'error' ? 'text-red-700' : 'text-orange-700'}`}>
                        {reason.message}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{reason.suggestion}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Code className="w-3 h-3" />
                    {flag.codeReferences.length} 处代码引用
                  </span>
                  <span className="flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {Math.max(...flag.environmentStatuses.map(e => e.grayUsers), 0)} 位灰度用户
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">风险规则配置</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-gray-700">风险分级规则</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-risk-low/10 rounded-lg">
                <p className="font-medium text-risk-low mb-1">低风险</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 代码无引用</li>
                  <li>• 全量开启超180天</li>
                  <li>• 无灰度用户</li>
                  <li>• 负责人明确</li>
                </ul>
              </div>
              <div className="p-3 bg-risk-medium/10 rounded-lg">
                <p className="font-medium text-risk-medium mb-1">中风险</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 静态引用已注释</li>
                  <li>• 灰度用户 {'<'} 阈值</li>
                  <li>• 负责人缺失但影响小</li>
                </ul>
              </div>
              <div className="p-3 bg-risk-high/10 rounded-lg">
                <p className="font-medium text-risk-high mb-1">高风险</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 动态引用嫌疑</li>
                  <li>• 灰度用户 ≥ 阈值</li>
                  <li>• 环境状态不一致</li>
                </ul>
              </div>
              <div className="p-3 bg-risk-blocker/10 rounded-lg">
                <p className="font-medium text-risk-blocker mb-1">阻塞</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• 明确动态引用</li>
                  <li>• 灰度用户 {'>'} 100人</li>
                  <li>• 核心链路无负责人</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {rules.filter(r => r.ruleKey.startsWith('risk.')).map(rule => (
              <div key={rule.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">{rule.ruleName}</span>
                  <span className="text-sm text-primary-600">
                    {typeof rule.value === 'boolean' ? (rule.value ? '已启用' : '已禁用') : rule.value}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{rule.description}</p>
                <p className="text-xs text-primary-600 mt-2 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {rule.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">高风险开关列表</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedLevel('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedLevel === 'all'
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              高风险+阻塞
            </button>
            {(['blocker', 'high', 'medium', 'low'] as RiskLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedLevel === level
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                {getRiskLevelLabel(level)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {filteredFlags.slice(0, 10).map(flag => (
            <div key={flag.id} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-medium text-gray-900">{flag.name}</p>
                  {flag.riskLevel && <RiskBadge level={flag.riskLevel} />}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-1">{flag.key}</p>
                {flag.riskReasons.length > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    {flag.riskReasons[0].suggestion}
                  </p>
                )}
              </div>
              <div className="text-right text-sm">
                <p className="text-gray-600">
                  <span className="text-gray-400">建议：</span>
                  {flag.suggestedAction && getSuggestedActionLabel(flag.suggestedAction)}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  负责人: {flag.owner || '-'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
