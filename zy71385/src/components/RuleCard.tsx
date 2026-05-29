import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, ToggleLeft, ToggleRight } from 'lucide-react';
import type { RuleConfig } from '../types';

interface RuleCardProps {
  rule: RuleConfig;
  onToggle: () => void;
  onValueChange: (value: any) => void;
}

export function RuleCard({ rule, onToggle, onValueChange }: RuleCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  const renderValueEditor = () => {
    if (typeof rule.value === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rule.value}
            onChange={(e) => onValueChange(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
          />
          <span className="text-sm text-gray-600">{rule.value ? '已启用' : '已禁用'}</span>
        </label>
      );
    }

    if (typeof rule.value === 'number') {
      return (
        <input
          type="number"
          value={rule.value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      );
    }

    if (Array.isArray(rule.value)) {
      return (
        <textarea
          value={JSON.stringify(rule.value, null, 2)}
          onChange={(e) => {
            try {
              onValueChange(JSON.parse(e.target.value));
            } catch (err) {
              console.error('Invalid JSON');
            }
          }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 h-24 resize-none"
        />
      );
    }

    if (typeof rule.value === 'string') {
      return (
        <select
          value={rule.value}
          onChange={(e) => onValueChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {rule.ruleKey === 'import.default_strategy' && (
            <>
              <option value="ask">询问用户</option>
              <option value="skip">跳过</option>
              <option value="overwrite">覆盖</option>
              <option value="append">追加</option>
            </>
          )}
        </select>
      );
    }

    return null;
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-medium text-gray-900">{rule.ruleName}</h4>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              title="查看规则解释"
            >
              <Info className="w-4 h-4 text-gray-400 hover:text-primary-600" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-3">{rule.description}</p>
          
          {showExplanation && (
            <div className="mb-4 p-4 bg-primary-50 rounded-lg border border-primary-100 animate-fade-in">
              <p className="text-sm text-primary-800">
                <span className="font-medium">规则解释：</span>
                {rule.explanation}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            {renderValueEditor()}
          </div>
        </div>

        <button
          onClick={onToggle}
          className="text-gray-400 hover:text-primary-600 transition-colors"
          title={rule.enabled ? '禁用规则' : '启用规则'}
        >
          {rule.enabled ? (
            <ToggleRight className="w-8 h-8 text-primary-600" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-gray-300" />
          )}
        </button>
      </div>
    </div>
  );
}
