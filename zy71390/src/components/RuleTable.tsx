import { useState } from 'react';
import { Edit2, History, Filter } from 'lucide-react';
import { RateLimitRule, RuleStatus, TIER_LABELS, TIER_COLORS, STATUS_COLORS, STATUS_LABELS } from '../../shared/types';

interface RuleTableProps {
  rules: RateLimitRule[];
  onEdit: (rule: RateLimitRule) => void;
  onViewVersions: (ruleId: string) => void;
}

export default function RuleTable({ rules, onEdit, onViewVersions }: RuleTableProps) {
  const [statusFilter, setStatusFilter] = useState<RuleStatus | 'all'>('all');

  const filteredRules = statusFilter === 'all'
    ? rules
    : rules.filter(r => r.status === statusFilter);

  const statusOptions: Array<{ value: RuleStatus | 'all'; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '已启用' },
    { value: 'draft', label: '草稿' },
    { value: 'deprecated', label: '已废弃' }
  ];

  return (
    <div className="bg-dark-100 rounded-xl border border-dark-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-400">状态筛选:</span>
          <div className="flex gap-1">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === option.value
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-white hover:bg-dark-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">规则名称</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">接口路径</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">方法</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">时间窗</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">阈值</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">适用层级</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">当前版本</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-200">
            {filteredRules.map((rule) => (
              <tr key={rule.id} className="hover:bg-dark-200/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-white">{rule.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-300 font-mono">{rule.path}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-dark-200 text-slate-300">{rule.method}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-300">{rule.windowSize}秒</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-300">{rule.limit.toLocaleString()}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={{ backgroundColor: `${TIER_COLORS[rule.tier]}20`, color: TIER_COLORS[rule.tier] }}
                  >
                    {rule.tier} - {TIER_LABELS[rule.tier]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 text-xs font-medium rounded-full"
                    style={{ backgroundColor: `${STATUS_COLORS[rule.status]}20`, color: STATUS_COLORS[rule.status] }}
                  >
                    {STATUS_LABELS[rule.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-300">v{rule.currentVersion}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(rule)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-200 rounded transition-colors"
                      title="编辑规则"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onViewVersions(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-primary-light hover:bg-dark-200 rounded transition-colors"
                      title="版本历史"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredRules.length === 0 && (
        <div className="p-12 text-center text-slate-500 text-sm">
          暂无规则数据
        </div>
      )}
    </div>
  );
}
