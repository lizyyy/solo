import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, Info, Shield, Code, Database, User, AlertTriangle } from 'lucide-react';
import { useFlagStore } from '../store/flagStore';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { RuleCard } from '../components/RuleCard';
import { formatDateTime } from '../utils/dateUtils';
import type { RuleConfig } from '../types';

export function Settings() {
  const {
    rules,
    flags,
    initData,
    loading,
    updateRule,
    toggleRule,
    reAssessAll,
  } = useFlagStore();

  const [activeTab, setActiveTab] = useState<'risk' | 'scan' | 'cleanup' | 'import'>('risk');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (flags.length === 0) initData();
  }, [flags.length, initData]);

  const getRulesByCategory = (category: string): RuleConfig[] => {
    const categoryMap: Record<string, string[]> = {
      risk: ['risk.stale_days', 'risk.gray_user_threshold', 'risk.ownership_required'],
      scan: ['scan.dynamic_patterns', 'scan.exclude_dirs'],
      cleanup: ['cleanup.require_approval'],
      import: ['import.default_strategy'],
    };
    const keys = categoryMap[category] || [];
    return rules.filter(r => keys.includes(r.ruleKey));
  };

  const handleRuleValueChange = (ruleKey: string, value: any) => {
    updateRule(ruleKey, value);
    showSaveMessage();
  };

  const handleRuleToggle = (ruleKey: string) => {
    toggleRule(ruleKey);
    showSaveMessage();
  };

  const showSaveMessage = () => {
    setSaveMessage('设置已自动保存');
    setTimeout(() => setSaveMessage(null), 2000);
  };

  const handleReassessAll = () => {
    reAssessAll();
    showSaveMessage();
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'risk':
        return <Shield className="w-4 h-4" />;
      case 'scan':
        return <Code className="w-4 h-4" />;
      case 'cleanup':
        return <Database className="w-4 h-4" />;
      case 'import':
        return <User className="w-4 h-4" />;
      default:
        return <SettingsIcon className="w-4 h-4" />;
    }
  };

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'risk':
        return '风险评估规则';
      case 'scan':
        return '代码扫描规则';
      case 'cleanup':
        return '清理执行规则';
      case 'import':
        return '数据导入规则';
      default:
        return tab;
    }
  };

  const tabs = ['risk', 'scan', 'cleanup', 'import'] as const;

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message="正在处理..." />}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
          <p className="text-gray-500 mt-1">配置风险评估、代码扫描、清理执行等核心规则</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Save className="w-4 h-4" />
              {saveMessage}
            </span>
          )}
          <button
            onClick={handleReassessAll}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重新评估所有开关
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700">{rules.filter(r => r.enabled).length}</p>
              <p className="text-xs text-blue-600">已启用规则</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{rules.length}</p>
              <p className="text-xs text-gray-600">总规则数</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Code className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{flags.length}</p>
              <p className="text-xs text-green-600">开关总数</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">{rules.filter(r => !r.enabled).length}</p>
              <p className="text-xs text-orange-600">已禁用规则</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex border-b border-gray-100 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              {getTabIcon(tab)}
              {getTabLabel(tab)}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {getRulesByCategory(tab).length}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {getRulesByCategory(activeTab).map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => handleRuleToggle(rule.ruleKey)}
              onValueChange={(value) => handleRuleValueChange(rule.ruleKey, value)}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-50 rounded-xl">
            <Info className="w-6 h-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-2">规则配置说明</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <strong>规则修改生效时间：</strong>
                规则修改后会立即保存，但需要点击"重新评估所有开关"按钮才会对现有开关数据重新计算风险等级。
              </p>
              <p>
                <strong>规则解释：</strong>
                每条规则右侧的 <Info className="w-3 h-3 inline" /> 图标点击可展开查看详细的规则解释，了解规则的设计意图和调整建议。
              </p>
              <p>
                <strong>历史追溯：</strong>
                所有规则修改都会记录更新时间，系统保留完整的操作日志，便于追溯和审计。
              </p>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <h4 className="font-medium text-gray-900 mb-2">风险等级判定逻辑</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium flex-shrink-0">阻塞</span>
                  <p className="text-gray-600">检测到动态引用，或生产环境灰度用户超过100人</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium flex-shrink-0">高风险</span>
                  <p className="text-gray-600">疑似动态引用、灰度用户超过阈值、环境配置不一致</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium flex-shrink-0">中风险</span>
                  <p className="text-gray-600">缺少负责人、仅存在注释代码、上线时间不足但无引用</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex-shrink-0">低风险</span>
                  <p className="text-gray-600">代码无引用、全量开启超过阈值、无灰度用户，可安全删除</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">最近规则变更记录</h3>
        <div className="space-y-3">
          {rules
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5)
            .map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{rule.ruleName}</p>
                    <p className="text-xs text-gray-500">{rule.ruleKey}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {rule.enabled ? '已启用' : '已禁用'}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateTime(rule.updatedAt)}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
