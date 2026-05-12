import React from 'react'
import { OrderStatus } from '../types'
import { useOrderContext } from '../store/OrderContext'
import { STATUS_LABELS } from '../utils/statusUtils'
import { Search, Filter } from 'lucide-react'

const FILTER_OPTIONS: (OrderStatus | 'rework')[] = [
  'pending',
  'measuring',
  'cutting',
  'polishing',
  'edging',
  'quality-check',
  'rework',
  'ready',
  'picked-up'
]

export const FilterBar: React.FC = () => {
  const { filters, setFilters } = useOrderContext()

  const handleStatusToggle = (status: OrderStatus | 'rework') => {
    const currentStatus = filters.status || []
    let newStatus: OrderStatus[]
    
    if (status === 'rework') {
      setFilters({ hasRework: !filters.hasRework })
      return
    }
    
    if (currentStatus.includes(status)) {
      newStatus = currentStatus.filter(s => s !== status)
    } else {
      newStatus = [...currentStatus, status]
    }
    
    setFilters({ status: newStatus.length > 0 ? newStatus : undefined })
  }

  const isActive = (status: OrderStatus | 'rework') => {
    if (status === 'rework') return filters.hasRework
    return filters.status?.includes(status as OrderStatus)
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={18} className="text-gray-500" />
        <span className="font-medium text-gray-700">筛选</span>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => handleStatusToggle(status)}
            className={`px-3 py-1.5 rounded-full text-sm transition ${
              isActive(status)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status === 'rework' ? '返工中' : STATUS_LABELS[status]}
          </button>
        ))}
        
        <button
          onClick={() => setFilters({ status: undefined, hasRework: undefined })}
          className="px-3 py-1.5 rounded-full text-sm bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
        >
          清除筛选
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="搜索订单号、客户名、电话..."
          value={filters.search || ''}
          onChange={(e) => setFilters({ search: e.target.value || undefined })}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  )
}
