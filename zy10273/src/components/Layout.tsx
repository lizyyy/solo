import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, ClipboardList, BarChart3, DollarSign } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Home, label: '工作台' },
    { path: '/appointments', icon: ClipboardList, label: '预约管理' },
    { path: '/approvals', icon: BarChart3, label: '改价审批' },
    { path: '/settlement', icon: DollarSign, label: '结算管理' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen fixed">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">二手家电上门检测台</h1>
          </div>
          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map(item => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="ml-64 flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
