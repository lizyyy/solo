import { FileText, Eye, AlertCircle, CheckCircle2 } from 'lucide-react'
import { SourceData, Conflict } from '../../types'

interface SourceComparisonProps {
  constructionNotice: SourceData
  rampRecord?: SourceData
  conflicts: Conflict[]
}

const fieldLabels: Record<string, string> = {
  communityName: '小区名称',
  metroStation: '地铁站',
  detourRoute: '绕行路线',
  hasRamp: '有无障碍坡道',
  rampCondition: '坡道状态',
  barrierFreeInfo: '无障碍设施说明',
  sourceDate: '数据日期',
}

export default function SourceComparison({
  constructionNotice,
  rampRecord,
  conflicts,
}: SourceComparisonProps) {
  const fields = [
    'communityName',
    'metroStation',
    'detourRoute',
    'hasRamp',
    'rampCondition',
    'barrierFreeInfo',
    'sourceDate',
  ] as const

  const getConflictForField = (field: string) => {
    return conflicts.find((c) => c.fieldName === field)
  }

  const formatValue = (field: string, value: string | boolean) => {
    if (field === 'hasRamp') {
      return value ? '有' : '无'
    }
    return String(value)
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">施工告示</h3>
          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
            来源：施工方
          </span>
        </div>
        <div className="p-4 space-y-4">
          {fields.map((field) => {
            const conflict = getConflictForField(field)
            const hasConflict = conflict && conflict.status === 'pending'
            const isResolved = conflict && conflict.status !== 'pending'

            return (
              <div key={field} className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">
                    {fieldLabels[field]}
                  </span>
                  {hasConflict && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  {isResolved && conflict?.status === 'resolved_construction' && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <p
                  className={`text-sm p-2 rounded ${
                    hasConflict
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : isResolved && conflict?.status === 'resolved_construction'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  {formatValue(field, constructionNotice[field as keyof SourceData])}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-orange-50 px-4 py-3 border-b border-orange-100 flex items-center space-x-2">
          <Eye className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-orange-900">无障碍坡道记录</h3>
          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
            来源：市政巡检
          </span>
        </div>
        <div className="p-4 space-y-4">
          {fields.map((field) => {
            const conflict = getConflictForField(field)
            const hasConflict = conflict && conflict.status === 'pending'
            const isResolvedRamp = conflict?.status === 'resolved_ramp'

            const value = rampRecord
              ? formatValue(field, rampRecord[field as keyof SourceData])
              : '暂无数据'

            return (
              <div key={field} className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">
                    {fieldLabels[field]}
                  </span>
                  {hasConflict && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  {isResolvedRamp && (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <p
                  className={`text-sm p-2 rounded ${
                    hasConflict
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : isResolvedRamp
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : rampRecord
                      ? 'bg-gray-50 text-gray-800'
                      : 'bg-gray-100 text-gray-500 italic'
                  }`}
                >
                  {value}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
