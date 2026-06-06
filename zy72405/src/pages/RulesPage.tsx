import { BOUNDARY_RULES } from '@/utils/boundaryRules';
import { BookOpen, AlertTriangle, Search, Wrench, RotateCcw, Lightbulb } from 'lucide-react';

export function RulesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800 mb-1">边界规则说明</h1>
        <p className="text-stone-500 text-sm">所有规则已代码化，不靠口头约定。判定、修改、回滚方式均在此说明</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800 mb-1">核心原则</h3>
            <p className="text-sm text-amber-700">
              边界场景不自动确认，留给人工判断空间。请假课时被算进已消耗这种记录不要自动吞掉，音乐老师许老师确认前先停在待处理。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {BOUNDARY_RULES.map((rule, idx) => (
          <div
            key={rule.id}
            className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden"
          >
            <div className="p-5 border-b border-stone-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-red-700 font-bold text-sm">{idx + 1}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-stone-800">{rule.name}</h3>
                  <p className="text-sm text-stone-600 mt-0.5">{rule.description}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500" />
                  判定逻辑（如何检测）
                </h4>
                <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-700 font-mono text-xs">
                  {rule.detectionLogic}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-green-500" />
                  处理方式（怎么改）
                </h4>
                <div className="bg-green-50 rounded-lg p-3 text-sm text-green-800 whitespace-pre-line">
                  {rule.handlingGuide}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  回滚方式（怎么撤）
                </h4>
                <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800 whitespace-pre-line">
                  {rule.rollbackGuide}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-purple-500" />
                  场景示例
                </h4>
                <div className="bg-purple-50 rounded-lg p-3 text-sm text-purple-800 border border-purple-100">
                  {rule.example}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
        <h3 className="font-medium text-stone-800 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-600" />
          三步流程规范
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-stone-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center mb-2 font-bold">1</div>
            <h4 className="font-medium text-stone-800 text-sm mb-1">合同页截图第一次导入</h4>
            <p className="text-xs text-stone-600">系统识别原始行号与内容，去重检测后生成待处理记录。原始行号和内容永久保留，不可修改。</p>
          </div>
          <div className="p-4 bg-stone-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center mb-2 font-bold">2</div>
            <h4 className="font-medium text-stone-800 text-sm mb-1">音乐老师许老师补看曲目别名表</h4>
            <p className="text-xs text-stone-600">将合同中的曲目名与标准曲目名进行映射匹配。别名表后来才补的也没关系，随时可以补充映射。</p>
          </div>
          <div className="p-4 bg-stone-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center mb-2 font-bold">3</div>
            <h4 className="font-medium text-stone-800 text-sm mb-1">曲目核对表更新</h4>
            <p className="text-xs text-stone-600">核对完成后，异常记录标记为"待巡演统筹复核"，正常记录可确认。边界场景不自动归为正常。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
