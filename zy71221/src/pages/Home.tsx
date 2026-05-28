import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Warehouse, ClipboardList, AlertTriangle, Ban, FileBarChart, RefreshCw } from 'lucide-react'
import InventoryBoard from '@/components/InventoryBoard'
import ReservationList from '@/components/ReservationList'
import ReservationDrawer from '@/components/ReservationDrawer'
import OverdueAlert from '@/components/OverdueAlert'
import CancelledRecords from '@/components/CancelledRecords'
import AllocationReport from '@/components/AllocationReport'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const tabs = [
  { key: 'inventory' as const, label: '库存看板', icon: Warehouse },
  { key: 'reservations' as const, label: '预约单', icon: ClipboardList },
  { key: 'overdue' as const, label: '归还预警', icon: AlertTriangle },
  { key: 'cancelled' as const, label: '撤单记录', icon: Ban },
  { key: 'report' as const, label: '分配报告', icon: FileBarChart },
]

const tabComponents: Record<string, React.FC> = {
  inventory: InventoryBoard,
  reservations: ReservationList,
  overdue: OverdueAlert,
  cancelled: CancelledRecords,
  report: AllocationReport,
}

export default function Home() {
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const markOverdue = useStore((s) => s.markOverdue)
  const fetchInventory = useStore((s) => s.fetchInventory)
  const fetchReservations = useStore((s) => s.fetchReservations)

  useEffect(() => {
    fetchInventory()
    fetchReservations()
    markOverdue()
  }, [fetchInventory, fetchReservations, markOverdue])

  const ActiveComponent = tabComponents[activeTab]

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-surface flex flex-col border-r border-slate-700 shrink-0">
        <div className="px-5 py-6 border-b border-slate-700">
          <h1 className="text-lg font-bold text-primary tracking-wide">融券券源预约</h1>
          <p className="text-xs text-slate-400 mt-1">Securities Lending</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="px-3 pb-5">
          <button
            onClick={markOverdue}
            className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            标记逾期
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[#0F172A] p-6">
        {ActiveComponent && <ActiveComponent />}
      </main>

      <Toast />
      <ConfirmDialog />
      <ReservationDrawer />
    </div>
  )
}
