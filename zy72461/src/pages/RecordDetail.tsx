import { useParams, useNavigate, Link } from 'react-router-dom'
import { useRecordStore } from '../store/useRecordStore'
import { ArrowLeft, MapPin, Building2, AlertTriangle, CheckCircle, FileText, Eye } from 'lucide-react'
import { statusLabels, statusColors } from '../types'
import SourceComparison from '../components/record/SourceComparison'
import ChangeTimeline from '../components/record/ChangeTimeline'

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRecordById, resolveNameConflict } = useRecordStore()
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
  const hasDataConflict = record.status === 'data_conflict'
  const hasNameConflict = record.status === 'name_conflict'

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回记录列表</span>
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {record.communityName}
                </h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[record.status]}`}
                >
                  {statusLabels[record.status]}
                </span>
              </div>
              {record.oldCommunityName && (
                <p className="text-gray-500 mb-3">
                  历史曾用名：<span className="font-medium">{record.oldCommunityName}</span>
                </p>
              )}
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span>{record.metroStation}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Building2 className="w-4 h-4" />
                  <span>{record.street}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {hasNameConflict && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">名称待复核</span>
                  </div>
                  <p className="text-xs text-yellow-700 mb-3">
                    市政巡检员需现场核实小区标准名称
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => resolveNameConflict(record.id, record.communityName)}
                      className="w-full text-xs bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded"
                    >
                      确认新名「{record.communityName}」
                    </button>
                    {record.oldCommunityName && (
                      <button
                        onClick={() => resolveNameConflict(record.id, record.oldCommunityName!)}
                        className="w-full text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded"
                      >
                        确认旧名「{record.oldCommunityName}」
                      </button>
                    )}
                  </div>
                </div>
              )}

              {hasDataConflict && (
                <Link
                  to={`/conflict/${record.id}`}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium text-sm flex items-center space-x-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>处理 {pendingConflicts} 处冲突</span>
                </Link>
              )}

              {pendingConflicts === 0 && record.conflicts.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800 text-sm font-medium">所有冲突已处理</span>
                </div>
              )}
            </div>
          </div>

          {record.reviewer && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
              最后复核人：<span className="font-medium text-gray-700">{record.reviewer}</span>
              <span className="mx-2 text-gray-300">|</span>
              更新时间：<span className="font-medium text-gray-700">{record.updatedAt}</span>
              {record.finalSource && (
                <>
                  <span className="mx-2 text-gray-300">|</span>
                  最终口径：
                  <span className="font-medium text-gray-700">
                    {record.finalSource === 'construction' ? (
                      <span className="flex items-center space-x-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>以施工告示为准</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>以坡道记录为准</span>
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">来源数据对比</h2>
          <SourceComparison
            constructionNotice={record.constructionNotice}
            rampRecord={record.rampRecord}
            conflicts={record.conflicts}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">变更历史</h2>
          <ChangeTimeline history={record.changeHistory} />
        </div>
      </div>
    </div>
  )
}
