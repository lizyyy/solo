import { Filter, Search, X } from 'lucide-react'
import { useRecordStore } from '../../store/useRecordStore'
import { statusLabels, RecordStatus } from '../../types'

export default function Sidebar() {
  const { filterStatus, setFilterStatus, searchKeyword, setSearchKeyword, getStats } = useRecordStore()
  const stats = getStats()

  const statusOptions: { value: RecordStatus | null; label: string; count: number }[] = [
    { value: null, label: '全部记录', count: stats.total },
    { value: 'normal', label: statusLabels.normal, count: stats.normal },
    { value: 'name_conflict', label: statusLabels.name_conflict, count: stats.nameConflict },
    { value: 'data_conflict', label: statusLabels.data_conflict, count: stats.dataConflict },
    { value: 'ramp_supplemented', label: statusLabels.ramp_supplemented, count: stats.rampSupplemented },
    { value: 'completed', label: statusLabels.completed, count: stats.completed },
  ]

  return (
    <aside className="w-72 bg-white border-r border-gray-200 h-[calc(100vh-160px)] overflow-y-auto">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Search className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-700">搜索记录</h3>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="输入小区名称、地铁站、街道..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-700">按状态筛选</h3>
          </div>
          <div className="space-y-1">
            {statusOptions.map((option) => (
              <button
                key={option.value ?? 'all'}
                onClick={() => setFilterStatus(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                  filterStatus === option.value
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{option.label}</span>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    filterStatus === option.value
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 text-sm mb-2">温馨提示</h4>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• 施工告示与坡道记录冲突时，先列出证据</li>
            <li>• 同一小区新旧名称，留给巡检员复核</li>
            <li>• 每步操作都记录变更历史</li>
          </ul>
        </div>
      </div>
    </aside>
  )
}
