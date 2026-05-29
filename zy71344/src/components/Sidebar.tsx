import { Link, useLocation } from 'react-router-dom'
import { Music, List } from 'lucide-react'

export function Sidebar() {
  const location = useLocation()

  const isHome = location.pathname === '/'
  const isProject = location.pathname.startsWith('/project/')

  return (
    <aside className="w-16 bg-surface-card border-r border-surface-border flex flex-col items-center py-6 gap-4 min-h-screen">
      <Link
        to="/"
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
          isHome
            ? 'bg-brand text-white shadow-lg shadow-brand/30'
            : 'text-gray-500 hover:text-white hover:bg-surface-hover'
        }`}
        title="项目列表"
      >
        <List size={20} />
      </Link>
      <div className="w-6 h-px bg-surface-border my-1" />
      {isProject && (
        <Link
          to={location.pathname.split('/edit')[0].split('/compare')[0].split('/history')[0]}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 bg-brand-light/30 text-brand-light`}
          title="当前项目"
        >
          <Music size={20} />
        </Link>
      )}
      {!isProject && (
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-600" title="选择项目">
          <Music size={20} />
        </div>
      )}
    </aside>
  )
}
