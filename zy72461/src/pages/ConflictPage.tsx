import { useParams, useNavigate } from 'react-router-dom'
import { useRecordStore } from '../store/useRecordStore'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import ConflictResolver from '../components/conflict/ConflictResolver'

export default function ConflictPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRecordById } = useRecordStore()
  const record = getRecordById(id || '')

  if (!record) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">未找到该记录</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const pendingConflicts = record.conflicts.filter((c) => c.status === 'pending').length

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate(`/record/${record.id}`)}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回记录详情</span>
        </button>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start space-x-4">
            <div className="bg-red-100 p-2 rounded">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-red-900 mb-1">
                {record.communityName} - 冲突复核
              </h1>
              <p className="text-red-700">
                施工告示与无障碍坡道记录存在 <span className="font-bold">{record.conflicts.length}</span> 处口径差异，
                其中 <span className="font-bold">{pendingConflicts}</span> 处待老马确认。
                请仔细核对后选择采信哪一方，或驳回待进一步核实。
              </p>
              <div className="mt-3 text-xs text-red-600 bg-red-100 inline-block px-3 py-1.5 rounded">
                ⚠️ 系统不会自动拍板，请老马人工判断后确认
              </div>
            </div>
          </div>
        </div>

        <ConflictResolver recordId={record.id} conflicts={record.conflicts} />
      </div>
    </div>
  )
}
