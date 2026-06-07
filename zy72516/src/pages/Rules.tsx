import { BookOpen, AlertTriangle, Check, RotateCcw, FileCode } from 'lucide-react';
import { getAllRuleDescriptions, BOUNDARY_RULES_VERSION } from '../utils/boundaryRules';
import { StatusLabelMap, RecordStatus } from '../types';

export default function Rules() {
  const rules = getAllRuleDescriptions();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">边界规则</h1>
          <p className="text-slate-500 mt-1">
            售后机器人转人工判断的边界规则定义，版本：{BOUNDARY_RULES_VERSION}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
          <FileCode className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">v{BOUNDARY_RULES_VERSION}</span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">规则说明</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              本页面定义了售后机器人转人工判断的所有边界规则。所有规则已固化在代码中，
              禁止口头约定。当样本触发边界规则时，系统会自动标记相应状态和异常类型，
              部分规则允许回滚操作。特别是"引用链接404仍被判通过"这种情况，
              系统会强制标记为"待产品经理复核"，不得直接归为正常。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">规则列表</h3>

        {rules.map((rule, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-slate-900">{rule.name}</h4>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium">
                      优先级 {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{rule.description}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">建议状态</p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-200 text-slate-700 text-sm font-medium">
                    {StatusLabelMap[rule.suggestedAction as RecordStatus]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">允许回滚</p>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700 font-medium">是</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">回滚目标</p>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200 text-slate-700 text-sm font-medium">
                    <RotateCcw className="w-3 h-3" />
                    待处理
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900">处理流程说明</h3>
        </div>
        <div className="px-6 py-5">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-slate-900">标注员留言导入</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  标注员上传CSV文件，系统保留原始行号和完整内容，不做任何删改。
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-slate-900">边界规则自动检测</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  系统自动应用边界规则，检测异常情况并标记相应状态。特别是引用链接404仍被判通过的情况，会强制标记为"待产品经理复核"。
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-slate-900">AI产品经理补看模型输出</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  产品经理逐条查看模型推理片段，结合标注员留言进行初步判断。
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                4
              </div>
              <div>
                <p className="font-medium text-slate-900">产品经理复核（404专用）</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  对于引用链接404仍被判通过的样本，必须经过产品经理最终复核，才能确定通过或驳回。
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                5
              </div>
              <div>
                <p className="font-medium text-slate-900">冲突样本表更新</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  所有状态变更同步更新到冲突样本表，操作日志完整记录，可追溯可回滚。
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 mb-1">重要提醒</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>引用链接404仍被判通过的样本，不允许直接标记为"通过"，必须走产品经理复核流程</li>
              <li>所有操作都保留完整日志，包括操作人、前后状态、备注、时间戳</li>
              <li>页面展示、导出明细、接口返回读取同一份数据源，确保一致性</li>
              <li>错口径和补录返工作为优先处理的常见问题分类，单独筛选</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
