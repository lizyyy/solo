import { useEffect } from 'react'
import { useScheduleStore } from '@/stores/scheduleStore'
import FilterBar from '@/components/FilterBar'
import ScheduleTable from '@/components/ScheduleTable'
import AuditDrawer from '@/components/AuditDrawer'
import AddRecordModal from '@/components/AddRecordModal'
import { Download, Plus, Wrench, User } from 'lucide-react'

export default function Home() {
  const { fetchSchedules, items, filters, operatorName, setOperatorName, setShowAddModal } = useScheduleStore()

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.source) params.set('source', filters.source)
    if (filters.keyword) params.set('keyword', filters.keyword)
    const qs = params.toString()
    window.open(`/api/export${qs ? '?' + qs : ''}`, '_blank')
  }

  const statusCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="h-screen flex flex-col bg-[#F1F5F0]">
      <header className="bg-[#2D3A4A] text-white px-6 py-3 flex items-center gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shadow-inner">
            <Wrench size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg leading-tight tracking-wide">乐器维修备件排程</h1>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Instrument Repair Parts Scheduling</p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 mr-4">
            {Object.entries(statusCounts).map(([status, count]) => {
              const labels: Record<string, string> = {
                pending: '待排程', scheduled: '已排程', missing_auth: '缺授权',
                version_conflict: '版本冲突', duplicate: '重复项',
              }
              const colors: Record<string, string> = {
                pending: 'bg-slate-500', scheduled: 'bg-emerald-500',
                missing_auth: 'bg-orange-500', version_conflict: 'bg-pink-500', duplicate: 'bg-amber-500',
              }
              return (
                <span key={status} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-slate-400'}`} />
                  {labels[status] || status} <span className="font-bold text-white">{count}</span>
                </span>
              )
            })}
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
            <User size={14} className="text-slate-400" />
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="操作人姓名"
              className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none w-24"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <FilterBar />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-slate-400">
                共 <span className="font-bold text-slate-600">{items.length}</span> 条记录
                {(filters.status || filters.source || filters.keyword) && (
                  <span className="ml-1 text-amber-600">（已筛选）</span>
                )}
              </span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
            >
              <Plus size={14} />
              新增记录
            </button>

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
            >
              <Download size={14} />
              导出清单
              {items.length > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{items.length}</span>
              )}
            </button>
          </div>

          <ScheduleTable />
        </div>
      </div>

      <AuditDrawer />
      <AddRecordModal />
    </div>
  )
}
