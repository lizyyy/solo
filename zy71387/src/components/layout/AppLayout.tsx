import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

const pageTitles: Record<string, string> = {
  '/lineage': '血缘图谱',
  '/scan': '影响扫描',
  '/alias': '别名归并',
  '/risk': '风险清单',
  '/report': '巡检报告',
}

export default function AppLayout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? '血缘追踪'

  return (
    <div className="flex h-screen bg-base-900">
      <Sidebar />

      <div className="ml-60 flex flex-col flex-1 min-w-0">
        <header className="h-14 bg-base-800 border-b border-base-600 flex items-center px-6 shrink-0">
          <span className="text-muted text-sm">血缘追踪</span>
          <span className="text-muted text-sm mx-2">/</span>
          <span className="text-white text-sm font-medium">{title}</span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
