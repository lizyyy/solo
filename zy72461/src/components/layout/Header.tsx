import { Train, User, Home, FileBarChart, FileText } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import StepProgress from './StepProgress'

export default function Header() {
  const location = useLocation()

  const links = [
    { path: '/wizard', label: '三步流程', icon: FileText },
    { path: '/', label: '记录列表', icon: Home },
    { path: '/summary', label: '街道摘要', icon: FileBarChart },
  ]

  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-700 p-2 rounded">
                <Train className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">地铁口无障碍绕行管理系统</h1>
                <p className="text-blue-200 text-sm">施工告示 · 坡道记录 · 冲突复核 · 街道摘要</p>
              </div>
            </div>

            <div className="flex items-center space-x-1 ml-8">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center space-x-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white text-blue-900'
                        : 'text-blue-100 hover:bg-blue-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-blue-800 px-4 py-2 rounded">
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">交通协管 老马</span>
          </div>
        </div>
      </div>
    </header>
  )
}
