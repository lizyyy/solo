import FilterPanel from '@/components/FilterPanel'
import RecordList from '@/components/RecordList'
import BatchActionBar from '@/components/BatchActionBar'
import { Scale } from 'lucide-react'

export default function Workspace() {
  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-3 px-5 py-3 bg-slate-900 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-blue-400" />
          <h1 className="text-sm font-semibold text-slate-100">经纪商撮合费对账</h1>
        </div>
        <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">对账工作台</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <FilterPanel />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <RecordList />
          </div>
          <BatchActionBar />
        </div>
      </div>
    </div>
  )
}
