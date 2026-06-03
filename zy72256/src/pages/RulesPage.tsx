import { useEffect } from 'react'
import { useStore } from '@/store'
import { CheckCircle, Code, Shield, RotateCcw, Search } from 'lucide-react'
import type { RuleCategory } from '@shared/types'

const categoryInfo: Record<RuleCategory, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  detection: { label: '判断规则', icon: Search, color: 'border-blue-500 bg-blue-50' },
  correction: { label: '修改规则', icon: Shield, color: 'border-purple-500 bg-purple-50' },
  rollback: { label: '回滚规则', icon: RotateCcw, color: 'border-red-500 bg-red-50' },
}

export default function RulesPage() {
  const rules = useStore((s) => s.rules)
  const loading = useStore((s) => s.loading)
  const fetchRules = useStore((s) => s.fetchRules)

  useEffect(() => {
    fetchRules()
  }, [])

  const grouped = rules.reduce<Record<string, typeof rules>>((acc, rule) => {
    const cat = rule.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(rule)
    return acc
  }, {})

  const categories: RuleCategory[] = ['detection', 'correction', 'rollback']

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">边界规则</h2>
        <p className="text-gray-500 mt-1">系统内置的坐标判断、修改与回滚规则，与代码和 README 同源</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#1a3a4a] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const info = categoryInfo[cat]
            const catRules = grouped[cat] || []
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-4">
                  <info.icon size={20} className="text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">{info.label}</h3>
                  <span className="text-xs text-gray-400">({catRules.length}条)</span>
                </div>
                {catRules.length === 0 ? (
                  <div className="text-sm text-gray-400 pl-7">暂无规则</div>
                ) : (
                  <div className="grid gap-4">
                    {catRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`bg-white rounded-xl shadow-sm border-l-4 ${info.color} p-5 card-hover`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-sm font-semibold text-gray-900">{rule.rule_name}</h4>
                              {rule.is_active && (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle size={12} />
                                  活跃
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{rule.rule_description}</p>
                            <div className="flex items-center gap-1.5">
                              <Code size={14} className="text-gray-400" />
                              <code className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {rule.code_reference}
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
