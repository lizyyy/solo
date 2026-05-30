import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import {
  LayoutDashboard,
  Bell,
  Upload,
  Wallet,
  FileText,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp,
  Search,
} from 'lucide-react'
import MarketPanel from '@/components/MarketPanel'
import ConfirmModal from '@/components/ConfirmModal'

const NAV_ITEMS = [
  { to: '/', label: '风险总览', icon: LayoutDashboard },
  { to: '/notifications', label: '通知管理', icon: Bell },
  { to: '/import', label: '数据导入', icon: Upload },
  { to: '/deposits', label: '入金流水', icon: Wallet },
  { to: '/reports', label: '催缴报告', icon: FileText },
]

const PAGE_TITLES: Record<string, string> = {
  '/': '风险总览',
  '/notifications': '通知管理',
  '/import': '数据导入',
  '/deposits': '入金流水',
  '/reports': '催缴报告',
}

export default function Layout() {
  const sidebarCollapsed = useAppStore(s => s.ui.sidebarCollapsed)
  const marketPanelOpen = useAppStore(s => s.ui.marketPanelOpen)
  const toggleSidebar = useAppStore(s => s.toggleSidebar)
  const toggleMarketPanel = useAppStore(s => s.toggleMarketPanel)
  const confirmModal = useAppStore(s => s.ui.confirmModal)
  const hideConfirmModal = useAppStore(s => s.hideConfirmModal)
  const location = useLocation()

  const pageTitle = PAGE_TITLES[location.pathname] || '保证金催缴系统'

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <aside
        className={`fixed left-0 top-0 h-full bg-bg-secondary border-r border-border z-30 transition-all duration-300 flex flex-col ${
          sidebarCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
        }`}
      >
        <div className="flex items-center h-topbar px-4 border-b border-border">
          {!sidebarCollapsed && (
            <span className="font-heading font-bold text-lg text-accent whitespace-nowrap">
              催缴系统
            </span>
          )}
          <button
            onClick={toggleSidebar}
            className="ml-auto p-1.5 rounded hover:bg-bg-card text-text-secondary hover:text-text-primary transition-colors"
          >
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                } ${sidebarCollapsed ? 'justify-center' : ''}`
              }
            >
              <Icon size={20} />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'ml-sidebar-collapsed' : 'ml-sidebar'
        }`}
      >
        <header className="h-topbar flex items-center gap-4 px-6 border-b border-border bg-bg-secondary shrink-0">
          <h1 className="font-heading font-semibold text-lg text-text-primary">{pageTitle}</h1>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="搜索客户、合约..."
                className="w-full bg-bg-card border border-border rounded-md pl-9 pr-4 py-1.5 text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <button
            onClick={toggleMarketPanel}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              marketPanelOpen
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
            }`}
          >
            <TrendingUp size={16} />
            <span>行情</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {marketPanelOpen && <MarketPanel />}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={hideConfirmModal}
        />
      )}
    </div>
  )
}
