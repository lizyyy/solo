import { useState } from 'react';
import { 
  BookOpen, 
  ChevronDown, 
  AlertTriangle, 
  RotateCcw, 
  RefreshCw,
  FileWarning
} from 'lucide-react';
import { boundaryRules } from '@/data/boundaryRules';
import type { RuleCategory } from '@/types';

const categoryLabels: Record<RuleCategory, { label: string; icon: typeof AlertTriangle; color: string }> = {
  name_conflict: { label: '新旧名称判定', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  rollback: { label: '回滚操作', icon: RotateCcw, color: 'text-orange-600 bg-orange-50' },
  consistency: { label: '数据一致性', icon: RefreshCw, color: 'text-blue-600 bg-blue-50' },
  exception: { label: '异常处理', icon: FileWarning, color: 'text-red-600 bg-red-50' },
};

export default function RulesPage() {
  const [expandedRule, setExpandedRule] = useState<string | null>('rule-001');
  const [activeCategory, setActiveCategory] = useState<RuleCategory | 'all'>('all');

  const filteredRules = activeCategory === 'all' 
    ? boundaryRules 
    : boundaryRules.filter(r => r.category === activeCategory);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: 'Source Han Serif SC, serif' }}
        >
          边界规则
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          阿宁和巡检员交接用的规则说明，别只靠口头约定
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          全部规则
        </button>
        {(Object.keys(categoryLabels) as RuleCategory[]).map((cat) => {
          const info = categoryLabels[cat];
          const Icon = info.icon;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeCategory === cat
                  ? info.color + ' ring-2 ring-offset-1'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {info.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredRules.map((rule, idx) => {
          const catInfo = categoryLabels[rule.category];
          const CatIcon = catInfo.icon;
          const isExpanded = expandedRule === rule.id;
          
          return (
            <div 
              key={rule.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                className="w-full px-6 py-5 flex items-start justify-between gap-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{rule.title}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${catInfo.color}`}>
                        <CatIcon className="w-3 h-3" />
                        {catInfo.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-gray-600 max-w-2xl">
                      {rule.description}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 mt-1 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`} />
              </button>
              
              {isExpanded && (
                <div className="px-6 pb-6 border-t border-gray-100">
                  <div className="mt-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        判定逻辑
                      </h4>
                      <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
{rule.logic}
                        </pre>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        示例
                      </h4>
                      <div className="mt-2 p-4 bg-amber-50 border border-amber-100 rounded-lg">
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {rule.example}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <BookOpen className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">规则也写在代码里了</h3>
            <p className="mt-1 text-sm text-blue-700">
              这些规则不只是写在页面上，代码里也有对应的逻辑。改规则要同步改代码和这里的说明，
              别一个地方改了另一个地方忘了。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
