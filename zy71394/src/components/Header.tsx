import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Search, Plus, User, Settings, Bell, PanelLeft } from 'lucide-react'
import { useStore } from '@/store/app'

interface HeaderProps {
  onToggleSidebar?: () => void
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser, searchQuery, setSearchQuery } = useStore()

  const getTitle = () => {
    const titles: Record<string, string> = {
      '/archive': '提示词归档',
      '/search': '相似检索',
      '/compare': '版本对比',
      '/issues': '问题追踪',
      '/dashboard': '数据看板',
      '/export': '报告导出',
    }
    for (const [path, title] of Object.entries(titles)) {
      if (location.pathname.startsWith(path)) return title
    }
    return '提示词仓库'
  }

  return (
    <header className="h-16 bg-bg-lighter border-b border-bg-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-md transition-colors"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-100">{getTitle()}</h1>
      </div>

      <div className="flex items-center gap-4">
        {location.pathname === '/archive' && (
          <button
            onClick={() => navigate('/archive/new')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>新增提示词</span>
          </button>
        )}

        {location.pathname !== '/search' && (
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索提示词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
                }
              }}
            />
          </div>
        )}

        <button className="p-2 text-gray-400 hover:text-gray-200 hover:bg-bg-hover rounded-md transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-danger rounded-full" />
        </button>

        <div className="flex items-center gap-2 pl-4 border-l border-bg-border">
          <div className="w-8 h-8 rounded-full bg-status-info/20 text-status-info flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-gray-300">{currentUser}</span>
        </div>
      </div>
    </header>
  )
}
