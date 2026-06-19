import { AlertTriangle, CheckCircle, XCircle, FileText, Eye } from 'lucide-react'
import { Conflict } from '../../types'
import { useRecordStore } from '../../store/useRecordStore'
import { useState } from 'react'

interface ConflictResolverProps {
  recordId: string
  conflicts: Conflict[]
}

export default function ConflictResolver({ recordId, conflicts }: ConflictResolverProps) {
  const { resolveConflict } = useRecordStore()
  const [processingId, setProcessingId] = useState<string | null>(null)

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
  const resolvedConflicts = conflicts.filter((c) => c.status !== 'pending')

  const handleResolve = (conflictId: string, choice: 'construction' | 'ramp' | 'reject') => {
    setProcessingId(conflictId)
    setTimeout(() => {
      resolveConflict(recordId, conflictId, choice)
      setProcessingId(null)
    }, 300)
  }

  if (conflicts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-green-800 font-medium">未检测到冲突</p>
        <p className="text-green-600 text-sm mt-1">施工告示与坡道记录口径一致</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pendingConflicts.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-gray-800">待处理冲突（{pendingConflicts.length} 项）</h3>
          </div>
          <div className="space-y-4">
            {pendingConflicts.map((conflict) => (
              <div
                key={conflict.id}
                className={`bg-white border-2 border-red-200 rounded-lg p-4 transition-all ${
                  processingId === conflict.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="inline-block bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded mb-2">
                      字段：{conflict.fieldLabel}
                    </span>
                    <p className="text-sm text-gray-500">
                      施工告示与无障碍坡道记录在此字段上存在矛盾，请老马确认采信哪一方口径
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <div className="flex items-center space-x-1 text-xs text-blue-600 mb-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="font-medium">施工告示口径</span>
                    </div>
                    <p className="text-sm text-blue-900 font-medium">
                      {conflict.constructionValue}
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded p-3">
                    <div className="flex items-center space-x-1 text-xs text-orange-600 mb-2">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="font-medium">坡道记录口径</span>
                    </div>
                    <p className="text-sm text-orange-900 font-medium">
                      {conflict.rampValue}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleResolve(conflict.id, 'construction')}
                    disabled={processingId === conflict.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>采信施工告示</span>
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'ramp')}
                    disabled={processingId === conflict.id}
                    className="flex-1 flex items-center justify-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>采信坡道记录</span>
                  </button>
                  <button
                    onClick={() => handleResolve(conflict.id, 'reject')}
                    disabled={processingId === conflict.id}
                    className="flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2.5 rounded font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>驳回待查</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolvedConflicts.length > 0 && (
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-gray-800">已处理冲突（{resolvedConflicts.length} 项）</h3>
          </div>
          <div className="space-y-3">
            {resolvedConflicts.map((conflict) => {
              const statusText = {
                resolved_construction: '已采信施工告示',
                resolved_ramp: '已采信坡道记录',
                rejected: '已驳回待进一步核实',
              }[conflict.status]

              const statusColor = {
                resolved_construction: 'bg-blue-100 text-blue-800 border-blue-200',
                resolved_ramp: 'bg-orange-100 text-orange-800 border-orange-200',
                rejected: 'bg-gray-100 text-gray-800 border-gray-200',
              }[conflict.status]

              const StatusIcon = conflict.status === 'rejected' ? XCircle : CheckCircle

              return (
                <div
                  key={conflict.id}
                  className={`border rounded-lg p-3 ${statusColor}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <StatusIcon className={`w-4 h-4 ${conflict.status === 'rejected' ? 'text-gray-500' : ''}`} />
                      <span className="font-medium text-sm">{conflict.fieldLabel}</span>
                      <span className="text-xs">→</span>
                      <span className="text-sm">
                        {conflict.status === 'resolved_construction'
                          ? conflict.constructionValue
                          : conflict.status === 'resolved_ramp'
                          ? conflict.rampValue
                          : '待进一步核实'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span>{conflict.resolvedBy}</span>
                      <span className="text-gray-400">|</span>
                      <span>{conflict.resolvedAt}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
