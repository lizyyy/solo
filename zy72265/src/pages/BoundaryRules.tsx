import { useEffect, useState } from 'react';
import { useEnvelopeStore } from '@/store/envelopeStore';
import { AlertTriangle, CheckCircle, RotateCcw, Eye, FileCode, BookOpen } from 'lucide-react';
import type { RuleType, BoundaryRule } from '../../shared/types';

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  DETECTION: '检测规则',
  CORRECTION: '修正规则',
  ROLLBACK: '回滚规则',
};

const RULE_TYPE_COLORS: Record<RuleType, string> = {
  DETECTION: 'bg-blue-100 text-blue-800 border-blue-200',
  CORRECTION: 'bg-green-100 text-green-800 border-green-200',
  ROLLBACK: 'bg-purple-100 text-purple-800 border-purple-200',
};

const RULE_TYPE_ICONS: Record<RuleType, typeof AlertTriangle> = {
  DETECTION: AlertTriangle,
  CORRECTION: CheckCircle,
  ROLLBACK: RotateCcw,
};

const EXPLANATIONS: Record<string, string> = {
  rule_001: '许工说：这条规则是帮你自动识别经纬度坐标的。说白了，只要数字在经度-180到180、纬度-90到90之间，或者带了°、E、W、N、S这些符号，系统就认为是经纬度坐标。不用你手动标。',
  rule_002: '许工说：这条是识别米制坐标的。带m、米单位，或者x=、y=这样的写法，或者数字太大超出经纬度范围的，都算米制。省得你一个个看。',
  rule_003: '许工说：重点！这条是防出错的关键。如果同一条记录里既有经纬度特征又有米制特征，系统不会瞎猜，直接标成"混合"，留给巡检组你亲自复核。别嫌麻烦，安全第一。',
  rule_004: '巡检组注意：等你确认了坐标类型，这条规则会自动把坐标统一转换成同一种格式。要么全转米制，要么全转经纬度。转之前会保留原始数据，放心用。',
  rule_005: '巡检组注意：回滚不是随便玩的。每次操作都留痕，能回到任何一个历史状态。回滚后会生成一条新的审计记录，谁回滚的、回滚到哪了，都能查到。',
  rule_006: '许工说：这条是用来比对点云日志和安全半径表的。差值超过5%的，系统不自动选，让你人工确认哪个更准。毕竟设备老化、环境变化都可能影响数值，不能光信机器。',
};

const HOW_TO_HANDLE: Record<string, string> = {
  rule_001: '怎么判：看数字范围和单位符号。怎么改：系统自动标，不用改。怎么回滚：不用回滚，这是第一步检测。',
  rule_002: '怎么判：看单位标记和数值大小。怎么改：系统自动标，不用改。怎么回滚：不用回滚，这是第一步检测。',
  rule_003: '怎么判：同时出现经纬度和米制特征。怎么改：点"复核"按钮，选是经纬度还是米制，或者手动输入正确值。怎么回滚：复核后发现改错了，点"回滚"回到混合状态重新判。',
  rule_004: '怎么判：巡检组确认坐标类型后自动触发。怎么改：系统自动转换，生成归一化后的坐标。怎么回滚：转换错了可以回滚到转换前的状态。',
  rule_005: '怎么判：任何时候觉得不对都可以回滚。怎么改：选要回滚到的历史状态，确认后恢复。怎么回滚：回滚本身也会被记录，可以再回滚。',
  rule_006: '怎么判：算差值百分比，>5%就标红。怎么改：看日志和表，选更可信的那个，或者手动输入。怎么回滚：选错了可以回滚到待确认状态。',
};

export default function BoundaryRules() {
  const { boundaryRules, fetchBoundaryRules, loading, error } = useEnvelopeStore();
  const [selectedType, setSelectedType] = useState<RuleType | 'ALL'>('ALL');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  useEffect(() => {
    fetchBoundaryRules();
  }, [fetchBoundaryRules]);

  const filteredRules = selectedType === 'ALL'
    ? boundaryRules
    : boundaryRules.filter(r => r.ruleType === selectedType);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        加载规则失败：{error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-blue-600" />
            边界规则手册
          </h1>
          <p className="text-slate-500 mt-1">
            许工和巡检组交接用的，每条规则都写明白怎么判、怎么改、怎么回滚，不玩虚的
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">许工的话</h3>
            <p className="text-amber-700 text-sm mt-1">
              这些规则不是摆着看的，是系统每天都在跑的。改动任何一条规则之前，先跟巡检组打个招呼。
              代码里写死了，README里也记着，别光靠口头说。出了问题，谁改的、什么时候改的，都能查到。
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setSelectedType('ALL')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedType === 'ALL'
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          全部规则 ({boundaryRules.length})
        </button>
        {(['DETECTION', 'CORRECTION', 'ROLLBACK'] as RuleType[]).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedType === type
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {RULE_TYPE_LABELS[type]} ({boundaryRules.filter(r => r.ruleType === type).length})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredRules.map((rule: BoundaryRule) => {
          const Icon = RULE_TYPE_ICONS[rule.ruleType];
          const isExpanded = expandedRule === rule.id;
          
          return (
            <div
              key={rule.id}
              className={`bg-white rounded-xl border-2 transition-all ${
                isExpanded ? 'border-blue-300 shadow-lg' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${RULE_TYPE_COLORS[rule.ruleType]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${RULE_TYPE_COLORS[rule.ruleType]}`}>
                          {RULE_TYPE_LABELS[rule.ruleType]}
                        </span>
                        <span className="text-slate-400 font-mono text-sm">{rule.id}</span>
                        {rule.isActive ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            已启用
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            已停用
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mt-2">
                        {rule.ruleName}
                      </h3>
                      <p className="text-slate-500 mt-1">{rule.description}</p>
                    </div>
                  </div>
                  <Eye className={`w-5 h-5 text-slate-400 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`} />
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-medium text-slate-700 mb-2">触发条件</h4>
                      <p className="text-slate-600">{rule.condition}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-medium text-slate-700 mb-2">系统动作</h4>
                      <p className="text-slate-600">{rule.action}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">👨‍🔧 许工解释</h4>
                    <p className="text-blue-700">{EXPLANATIONS[rule.id] || '暂无解释'}</p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">📋 操作指南（怎么判、怎么改、怎么回滚）</h4>
                    <p className="text-green-700">{HOW_TO_HANDLE[rule.id] || '暂无操作指南'}</p>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <FileCode className="w-4 h-4" />
                    <span>代码位置：{rule.codeReference}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-slate-800 text-white rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-3">📌 关键约定（别口头说，写在这里）</h3>
        <ul className="space-y-2 text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>坐标混合记录（is_mixed=1）<strong className="text-white">绝对不能</strong>自动归为正常，必须巡检组人工复核</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>安全半径差值&gt;5%的，<strong className="text-white">绝对不能</strong>自动选日志或表的值，必须人工确认</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>所有人工改动都留痕：原始值、新值、操作人、时间、原始行号，<strong className="text-white">缺一不可</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>导出的CSV、页面展示、API返回，<strong className="text-white">必须</strong>读同一份数据，不能各算各的</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">•</span>
            <span>三步工作流：导入→许工复核→发布给现场，<strong className="text-white">不能跳步</strong>，每步有前置条件</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
