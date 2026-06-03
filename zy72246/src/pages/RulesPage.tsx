import { BookOpen, Code, AlertTriangle, RotateCcw, FileText } from 'lucide-react';
import { getBoundaryRules } from '@/utils/boundaryRules';
import { STATUS_TRANSITIONS, STEP_TRANSITIONS, getStatusDisplayName, getStepDisplayName } from '@/utils/stateMachine';
import { Layout } from '@/components/Layout';

export default function RulesPage() {
  const boundaryRules = getBoundaryRules();

  return (
    <Layout>
      <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800" style={{ fontFamily: "'Noto Serif SC', serif" }}>
          边界规则说明
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          所有规则均已在代码中定义，此处为可查阅的文档版本
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">重要提示</p>
          <p className="mt-1 text-blue-700">
            本页面展示的所有规则均为系统强制执行的逻辑，不存在口头约定。如需修改规则，必须同时更新代码和本文档。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-800 flex items-center space-x-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <span>核心边界规则</span>
        </h3>

        {boundaryRules.map((rule) => (
          <div
            key={rule.id}
            className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="bg-slate-700 text-white px-2 py-0.5 rounded text-xs font-mono font-medium">
                  {rule.id}
                </span>
                <span className="font-medium text-slate-800">{rule.name}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Code className="w-3.5 h-3.5" />
                <a
                  href={`vscode://file/${process.cwd()}/${rule.codeReference}`}
                  className="text-blue-600 hover:underline font-mono"
                >
                  {rule.codeReference}
                </a>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">{rule.description}</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                  <h4 className="text-xs font-medium text-amber-800 mb-2 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>判断条件</span>
                  </h4>
                  <code className="text-xs bg-white p-2 rounded block text-amber-900 font-mono border border-amber-200">
                    {rule.condition}
                  </code>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="text-xs font-medium text-green-800 mb-2">处理动作</h4>
                  <p className="text-sm text-green-700">{rule.action}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="text-xs font-medium text-red-800 mb-2 flex items-center space-x-1">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>回滚方式</span>
                  </h4>
                  <p className="text-sm text-red-700">{rule.rollbackMethod}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-800 flex items-center space-x-2">
          <RotateCcw className="w-5 h-5 text-slate-600" />
          <span>状态流转规则</span>
        </h3>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-700 mb-4">处理状态流转路径</h4>
            <div className="space-y-3">
              {Object.entries(STATUS_TRANSITIONS).map(([fromStatus, toStatuses]) => (
                <div key={fromStatus} className="flex items-start space-x-4">
                  <div className="w-48 flex-shrink-0">
                    <span className="inline-block px-3 py-1 bg-slate-100 rounded text-sm font-medium text-slate-700">
                      {getStatusDisplayName(fromStatus as any)}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    {toStatuses.length > 0 ? (
                      toStatuses.map((toStatus) => (
                        <div key={toStatus} className="flex items-center space-x-2">
                          <span className="text-slate-400">→</span>
                          <span className="inline-block px-3 py-1 bg-blue-50 rounded text-sm font-medium text-blue-700">
                            {getStatusDisplayName(toStatus)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">（无后续状态）</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-4">三步流程阶段流转路径</h4>
            <div className="space-y-3">
              {Object.entries(STEP_TRANSITIONS).map(([fromStep, toSteps]) => (
                <div key={fromStep} className="flex items-start space-x-4">
                  <div className="w-48 flex-shrink-0">
                    <span className="inline-block px-3 py-1 bg-purple-100 rounded text-sm font-medium text-purple-700">
                      {getStepDisplayName(fromStep as any)}
                    </span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    {toSteps.length > 0 ? (
                      toSteps.map((toStep) => (
                        <div key={toStep} className="flex items-center space-x-2">
                          <span className="text-slate-400">→</span>
                          <span className="inline-block px-3 py-1 bg-green-50 rounded text-sm font-medium text-green-700">
                            {getStepDisplayName(toStep)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">（无后续阶段）</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-800 flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-slate-600" />
          <span>三步流程详解</span>
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-4 py-3 text-white">
              <h4 className="font-medium">第一步：导入</h4>
              <p className="text-blue-100 text-xs mt-1">税费率备注第一次导入</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">触发条件</p>
                <p className="text-slate-600">投研助理上传原始文件</p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">系统动作</p>
                <ul className="text-slate-600 space-y-1">
                  <li>• 自动解析并保留原始行号</li>
                  <li>• 检测边界情况（金额为0且备注已冲正）</li>
                  <li>• 异常记录标记为「已冲正待复核」</li>
                  <li>• 正常记录标记为「待处理」</li>
                </ul>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">不可清洗字段</p>
                <ul className="text-slate-600 space-y-1">
                  <li>• 原始行号（永久保留）</li>
                  <li>• 原始备注（永久保留）</li>
                  <li>• 柜台流水尾号</li>
                  <li>• 冲正标记</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-purple-600 px-4 py-3 text-white">
              <h4 className="font-medium">第二步：补看流水</h4>
              <p className="text-purple-100 text-xs mt-1">投研助理补看柜台流水尾号</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">触发条件</p>
                <p className="text-slate-600">投研助理查看原始备注后操作</p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">系统动作</p>
                <ul className="text-slate-600 space-y-1">
                  <li>• 根据柜台流水尾号补充或修正备注</li>
                  <li>• 记录每次人工改动的前后对比</li>
                  <li>• 状态更新为「补看完成」</li>
                  <li>• 创建历史版本记录</li>
                </ul>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">版本追踪</p>
                <ul className="text-slate-600 space-y-1">
                  <li>• 每次修改版本号+1</li>
                  <li>• 记录变更字段、前后值</li>
                  <li>• 记录操作人、时间、原因</li>
                  <li>• 支持版本对比和回滚</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-emerald-600 px-4 py-3 text-white">
              <h4 className="font-medium">第三步：摘要更新</h4>
              <p className="text-emerald-100 text-xs mt-1">给负责人看的摘要更新</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">触发条件</p>
                <p className="text-slate-600">补看流水完成后生成摘要</p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">系统动作</p>
                <ul className="text-slate-600 space-y-1">
                  <li>• 自动生成摘要信息</li>
                  <li>• 投研助理可调整摘要内容</li>
                  <li>• 状态更新为「待负责人审阅」</li>
                  <li>• 负责人审阅后标记为「已完成」</li>
                </ul>
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-700 mb-1">特殊情况处理</p>
                <ul className="text-slate-600 space-y-1">
                  <li>• 金额为0已冲正：强制风控复核</li>
                  <li>• 不归为「正常」状态</li>
                  <li>• 留给风控同事复核判断</li>
                  <li>• 支持驳回重处理和回滚</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-amber-800 mb-4">证据链完整性承诺</h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-amber-700">
          <div className="flex items-start space-x-3">
            <span className="text-amber-500 font-bold">✓</span>
            <p>原始行号永久保留，不可修改，不可删除</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-amber-500 font-bold">✓</span>
            <p>原始备注永久保留，不可修改，不可删除</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-amber-500 font-bold">✓</span>
            <p>每次修改记录版本，变更前后对比可查</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-amber-500 font-bold">✓</span>
            <p>状态流转全程留痕，操作人、时间、原因完整</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-amber-500 font-bold">✓</span>
            <p>重复导入不增加记录数，仅更新变更字段</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-amber-500 font-bold">✓</span>
            <p>风控复核记录不可删除，支持回滚但保留痕迹</p>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
}
