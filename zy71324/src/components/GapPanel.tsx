import { X, AlertTriangle, AlertCircle } from 'lucide-react'
import { ValidationIssue } from '@/types'

interface GapPanelProps {
  issues: ValidationIssue[]
  isOpen: boolean
  onClose: () => void
  onNavigate: (materialId: string) => void
}

type IssueGroup = {
  type: ValidationIssue['type']
  label: string
  icon: React.ReactNode
  items: ValidationIssue[]
}

export default function GapPanel({ issues, isOpen, onClose, onNavigate }: GapPanelProps) {
  const groups = ([
    {
      type: 'coefficient_out_of_range' as const,
      label: '系数越界',
      icon: <AlertTriangle size={16} className="text-red-400" />,
      items: issues.filter((i) => i.type === 'coefficient_out_of_range'),
    },
    {
      type: 'frequency_missing' as const,
      label: '频率数据缺失',
      icon: <AlertCircle size={16} className="text-amber-400" />,
      items: issues.filter((i) => i.type === 'frequency_missing'),
    },
    {
      type: 'field_empty' as const,
      label: '字段为空',
      icon: <AlertTriangle size={16} className="text-red-400" />,
      items: issues.filter((i) => i.type === 'field_empty'),
    },
  ] as IssueGroup[]).filter((g) => g.items.length > 0)

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 w-80 transform bg-[#1e3a33] border-l border-[#2a4a40] shadow-2xl transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#2a4a40] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">缺口识别</h3>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-white transition">
          <X size={18} />
        </button>
      </div>

      <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 52px)' }}>
        {groups.length === 0 && (
          <p className="text-center text-sm text-gray-500">暂无问题</p>
        )}

        {groups.map((group) => (
          <div key={group.type} className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              {group.icon}
              <span className="text-xs font-semibold text-gray-300">{group.label}</span>
              <span className="rounded bg-[#142420] px-1.5 py-0.5 text-[10px] text-gray-400">
                {group.items.length}
              </span>
            </div>

            <div className="space-y-1">
              {group.items.map((issue, idx) => (
                <button
                  key={`${issue.materialId}-${issue.frequency}-${idx}`}
                  onClick={() => onNavigate(issue.materialId)}
                  className="w-full rounded bg-[#142420] px-3 py-2 text-left transition hover:bg-[#2a4a40]"
                >
                  <p className="text-xs font-medium text-white">{issue.materialName}</p>
                  <p className="text-[11px] text-gray-400">
                    {issue.frequency && <span className="text-amber-400">{issue.frequency} </span>}
                    {issue.detail}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
