import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FileText, Calculator, CheckCircle, Download, Database } from 'lucide-react'
import { useAppStore } from '@/store'
import { generateMockData } from '@/utils/mockData'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/', label: '收款登记', icon: FileText },
  { path: '/allocation', label: '费用分摊', icon: Calculator },
  { path: '/review', label: '复核工作台', icon: CheckCircle },
  { path: '/export', label: '数据导出', icon: Download },
]

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { receipts, importData } = useAppStore()

  useEffect(() => {
    if (receipts.length === 0) {
      const mockData = generateMockData()
      importData(mockData)
    }
  }, [])

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-primary-700 min-h-screen">
        <div className="p-6">
          <h1 className="text-white text-xl font-bold mb-2">跨境收款手续费分摊</h1>
          <p className="text-primary-200 text-sm">外贸财务专用工具</p>
        </div>
        <nav className="mt-6">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-6 py-3 text-white transition-colors ${
                  isActive
                    ? 'bg-primary-600 border-l-4 border-warning-500'
                    : 'hover:bg-primary-600/50'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-0 w-64 p-4 text-primary-300 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} />
            <span>数据存储于浏览器本地</span>
          </div>
          <p>支持导出备份，请勿清除缓存不丢失数据</p>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
