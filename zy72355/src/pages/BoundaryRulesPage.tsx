import { useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import { useAssessmentStore } from '@/stores/assessmentStore'

export default function BoundaryRulesPage() {
  const { boundaryRules, fetchBoundaryRules } = useAssessmentStore()

  useEffect(() => {
    fetchBoundaryRules()
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">边界规则</h1>
        <p className="text-sm text-zinc-500 mt-1">所有判定规则写在代码和数据库中，不靠口头约定</p>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <span className="text-sm font-medium text-zinc-700">当前生效的方向边界规则</span>
        </div>
        <div className="divide-y divide-zinc-100">
          {boundaryRules.map(rule => (
            <div key={rule.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <AlertTriangle size={18} className="text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="px-2 py-0.5 bg-zinc-100 rounded text-xs font-mono">{rule.pattern}</code>
                    <span className="text-xs text-zinc-400">→</span>
                    <code className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">{rule.normalized_value}</code>
                    <ArrowRight size={12} className="text-zinc-300" />
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">待实验老师复核</span>
                  </div>
                  <p className="text-sm text-zinc-600">{rule.description}</p>
                  <div className="text-xs text-zinc-400 mt-1.5">
                    规则ID：{rule.id} · 类别：{rule.category}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
          <span className="text-sm font-medium text-zinc-700">判定流程</span>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-600">1</div>
              <span>检测到非标方向（如"向左"）</span>
            </div>
            <ArrowRight size={16} className="text-zinc-300" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-700">2</div>
              <span>boundary_flag = 1</span>
            </div>
            <ArrowRight size={16} className="text-zinc-300" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-medium text-amber-700">3</div>
              <span>状态 = 待实验老师复核</span>
            </div>
            <ArrowRight size={16} className="text-zinc-300" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#1B3A4B] flex items-center justify-center text-xs font-medium text-white">4</div>
              <span>实验老师人工判定</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-800">
            <p className="font-bold mb-1">规则保障</p>
            <ul className="list-disc list-inside space-y-1 text-emerald-700">
              <li>边界规则存储于 <code className="bg-emerald-100 px-1 rounded">boundary_rules</code> 表，可新增/修改/停用</li>
              <li>命中规则的条目<strong>不会自动归正常</strong>，必须经过人工复核</li>
              <li>所有判定均留痕，可在变更历史中查看复核理由</li>
              <li>重复导入按 <code className="bg-emerald-100 px-1 rounded">file_hash + line_number</code> 唯一约束去重</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
