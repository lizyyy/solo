import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Save, X, ChevronDown, ChevronUp, Clock, Link as LinkIcon } from 'lucide-react'
import { useStore } from '@/store'

function EditableValue({ param, onUpdate }: { param: any; onUpdate: (id: string, data: { value?: number; description?: string }) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(param.value))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const numVal = Number(value)
    if (isNaN(numVal)) {
      setError('请输入有效数字')
      return
    }
    if (numVal < 0 || numVal > 999999) {
      setError('参数值超出合理范围（0 ~ 999999），请检查后重新输入')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onUpdate(param.id, { value: numVal })
      setEditing(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(String(param.value))
    setEditing(false)
    setError(null)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-28 bg-slate-700/50 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 font-mono"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
        />
        <button onClick={handleSave} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-400 disabled:opacity-50">
          <Save size={14} />
        </button>
        <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-200">
          <X size={14} />
        </button>
        {error && <span className="text-rose-500 text-xs">{error}</span>}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="text-amber-500 font-mono hover:underline cursor-pointer text-sm">
      {param.value}
    </button>
  )
}

const boundaryRules = [
  {
    id: 'BR-001',
    scenario: '负数样本被旧表当成缺失',
    logic: '值 < 0 且旧表标记为"缺失"',
    correction: '标记为边界样本，状态设为"待处理"',
    rollback: '从变更历史回滚至标记前状态',
  },
  {
    id: 'BR-002',
    scenario: '重复导入同一批名单',
    logic: '名单指纹（hash）已存在',
    correction: '跳过重复记录，仅更新元数据',
    rollback: '删除本次导入的元数据更新',
  },
  {
    id: 'BR-003',
    scenario: '参数值异常（超出合理范围）',
    logic: '参数值 < 0 或 > 999999',
    correction: '拒绝保存，提示合理范围',
    rollback: '无需回滚，操作被阻止',
  },
  {
    id: 'BR-004',
    scenario: '备注仅修改单条',
    logic: '检测到仅备注字段变更',
    correction: '正常保存，历史记录标记为"备注修改"',
    rollback: '从变更历史回滚备注',
  },
]

function RuleCard({ rule }: { rule: typeof boundaryRules[0] }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-purple-500/10 text-purple-400">{rule.id}</span>
          <span className="text-slate-200 text-sm">{rule.scenario}</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="px-4 py-3 border-t border-slate-700/50 space-y-2 text-sm">
          <div><span className="text-slate-500">判定逻辑：</span><span className="text-slate-300">{rule.logic}</span></div>
          <div><span className="text-slate-500">修正方式：</span><span className="text-emerald-400">{rule.correction}</span></div>
          <div><span className="text-slate-500">回滚方式：</span><span className="text-amber-400">{rule.rollback}</span></div>
        </div>
      )}
    </div>
  )
}

export default function Params() {
  const { params, loading, fetchParams, updateParam } = useStore()

  useEffect(() => {
    fetchParams()
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>参数调试表</h2>

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">参数键</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">值</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">描述</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            {params.map(param => (
              <tr key={param.id} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-200 font-mono text-sm">{param.key}</td>
                <td className="px-4 py-3">
                  <EditableValue param={param} onUpdate={updateParam} />
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm">{param.description}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-slate-500 text-xs">
                    <Clock size={12} />
                    {new Date(param.updatedAt).toLocaleString('zh-CN')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-200" style={{ fontFamily: 'var(--font-title)' }}>边界规则配置</h3>
        {boundaryRules.map(rule => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>

      <Link to="/params/history" className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 text-sm transition-colors">
        <LinkIcon size={14} />
        查看参数变更历史
      </Link>
    </div>
  )
}
