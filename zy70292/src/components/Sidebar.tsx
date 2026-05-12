import type { ViewType } from '../types'

interface Props {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const menuItems: { id: ViewType; label: string; icon: string }[] = [
  { id: 'appointments', label: '预约列表', icon: '📋' },
  { id: 'schedule', label: '排班管理', icon: '📅' },
  { id: 'counselors', label: '咨询师', icon: '👨‍⚕️' },
  { id: 'history', label: '历史追踪', icon: '📜' },
  { id: 'stats', label: '统计面板', icon: '📊' }
]

export default function Sidebar({ currentView, onViewChange }: Props) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-900">心理咨询室</h1>
        <p className="text-sm text-muted mt-1">预约保密台</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              currentView === item.id
                ? 'bg-primary text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-xs text-indigo-800 font-medium">隐私保护</p>
          <p className="text-xs text-indigo-600 mt-1">
            所有记录采用匿名编号管理，仅授权人员可查看敏感信息
          </p>
        </div>
      </div>
    </aside>
  )
}
