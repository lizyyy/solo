import { MapPin, Clock, AlertTriangle, CheckCircle, FileText, Eye } from 'lucide-react'
import { DetourRecord, statusLabels, statusColors } from '../../types'
import { useNavigate } from 'react-router-dom'

interface RecordCardProps {
  record: DetourRecord
}

export default function RecordCard({ record }: RecordCardProps) {
  const navigate = useNavigate()

  const hasConflict = record.status === 'data_conflict' || record.status === 'name_conflict'
  const pendingConflicts = record.conflicts.filter((c) => c.status === 'pending').length

  return (
    <div
      className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        hasConflict ? 'border-l-4 border-l-red-500' : 'border-gray-200'
      }`}
      onClick={() => navigate(`/record/${record.id}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">
            {record.communityName}
            {record.oldCommunityName && (
              <span className="text-sm text-gray-500 font-normal ml-2">
                （旧名：{record.oldCommunityName}）
              </span>
            )}
          </h3>
          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <MapPin className="w-4 h-4" />
              <span>{record.metroStation}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>{record.updatedAt}</span>
            </span>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[record.status]}`}
        >
          {statusLabels[record.status]}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        <span className="font-medium">绕行路线：</span>
        {record.constructionNotice.detourRoute}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <span className="flex items-center space-x-1">
            <FileText className="w-3.5 h-3.5" />
            <span>告示日期：{record.constructionNotice.sourceDate}</span>
          </span>
          {record.rampRecord && (
            <span className="flex items-center space-x-1">
              <Eye className="w-3.5 h-3.5" />
              <span>坡道记录：{record.rampRecord.sourceDate}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {pendingConflicts > 0 && (
            <span className="flex items-center space-x-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{pendingConflicts} 处待处理</span>
            </span>
          )}
          {record.conflicts.length > 0 && pendingConflicts === 0 && (
            <span className="flex items-center space-x-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>冲突已处理</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
