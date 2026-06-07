import React, { useEffect } from 'react';
import {
  BookOpen,
  AlertTriangle,
  ShieldCheck,
  RefreshCcw,
  Eye,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

export const RulesPage: React.FC = () => {
  const { rules, fetchRules, toggleRule } = useAppStore();

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggle = async (id: string, isActive: boolean) => {
    await toggleRule(id, !isActive);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-stone-800 to-stone-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <BookOpen className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold mb-2">边界规则配置</h3>
            <p className="text-stone-300 text-sm max-w-2xl">
              所有规则都写在这里和代码里，不再靠口头约定。每条规则明确写清：触发条件是什么、怎么判定、怎么修改、怎么回滚。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
              rule.isActive ? 'border-stone-200' : 'border-stone-200 opacity-60'
            }`}
          >
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-800 flex items-center gap-2">
                    {rule.name}
                    <code className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded font-mono">
                      {rule.id}
                    </code>
                  </h4>
                  <p className="text-sm text-stone-500 mt-0.5">{rule.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle(rule.id, rule.isActive)}
                className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700"
              >
                {rule.isActive ? (
                  <ToggleRight className="w-8 h-8 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-stone-300" />
                )}
                <span className="text-xs">{rule.isActive ? '已启用' : '已停用'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-stone-100">
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  触发条件
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {rule.triggerCondition}
                </p>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                  <Eye className="w-4 h-4" />
                  判定与处理
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {rule.judgmentLogic}
                </p>
                <p className="text-sm text-stone-600 leading-relaxed mt-2">
                  <span className="font-medium">处理方式：</span>
                  {rule.modificationMethod}
                </p>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
                  <RefreshCcw className="w-4 h-4" />
                  回滚方式
                </div>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {rule.rollbackMethod}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-stone-50 rounded-xl border border-stone-200 p-6">
        <h4 className="font-bold text-stone-800 mb-3">使用说明</h4>
        <ul className="space-y-2 text-sm text-stone-600 list-disc list-inside">
          <li>规则同时写在代码（<code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono">api/services/</code>）和此处，保持一致</li>
          <li>施工临时改道标记后，自动流转到"待复核"，不会直接归为正常</li>
          <li>重复导入公交刷卡时段时，系统自动跳过重复项，数量不会翻倍</li>
          <li>仅修改红线图备注时，历史记录会保存修改前后的完整差异</li>
          <li>所有操作都可在历史记录页面回滚，回滚操作本身也会留痕</li>
        </ul>
      </div>
    </div>
  );
};

export default RulesPage;
