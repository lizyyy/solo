import { useRecordStore } from '../store/useRecordStore'
import { useNavigate } from 'react-router-dom'
import RecordCard from '../components/record/RecordCard'
import { List, Plus } from 'lucide-react'

export default function RecordList() {
  const { getFilteredRecords, filterStatus, searchKeyword } = useRecordStore()
  const records = getFilteredRecords()
  const navigate = useNavigate()

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <List className="w-6 h-6 text-blue-800" />
            <h2 className="text-xl font-bold text-gray-800">无障碍绕行记录</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/wizard')}
              className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded font-medium text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>三步流程导入</span>
            </button>
            <div className="text-sm text-gray-500">
              共 <span className="font-medium text-blue-800">{records.length}</span> 条记录
              {filterStatus && <span> · 已筛选</span>}
              {searchKeyword && <span> · 搜索："{searchKeyword}"</span>}
            </div>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <List className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">暂无记录</h3>
            <p className="text-gray-500 mb-4">
              {searchKeyword || filterStatus
                ? '没有找到符合条件的记录，请尝试调整筛选条件'
                : '还没有导入任何绕行记录，请通过三步流程导入'}
            </p>
            <button
              onClick={() => navigate('/wizard')}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
            >
              开始导入
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
