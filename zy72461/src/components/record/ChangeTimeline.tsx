import { History, User, Clock, ArrowRight, AlertTriangle, CheckCircle, FileText, Eye } from 'lucide-react'
import { ChangeHistory } from '../../types'

interface ChangeTimelineProps {
  history: ChangeHistory[]
}

const getIconForAction = (action: string) => {
  if (action.includes('导入')) return FileText
  if (action.includes('看') || action.includes('匹配')) return Eye
  if (action.includes('确认') || action.includes('标记')) return CheckCircle
  return AlertTriangle
}

export default function ChangeTimeline({ history }: ChangeTimelineProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center space-x-2">
        <History className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-gray-800">变更历史记录</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          共 {history.length} 条
        </span>
      </div>
      <div className="p-4">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-6">
            {history.map((item, index) => {
              const Icon = getIconForAction(item.action)
              const isFirst = index === 0

              return (
                <div key={item.id} className="relative pl-10">
                  <div
                    className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isFirst
                        ? 'bg-blue-100 text-blue-600 ring-4 ring-blue-50'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div
                    className={`p-3 rounded-lg border ${
                      isFirst ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-medium text-sm ${
                            isFirst ? 'text-blue-800' : 'text-gray-800'
                          }`}
                        >
                          {item.action}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <User className="w-3.5 h-3.5" />
                        <span>{item.operator}</span>
                        <span className="text-gray-300">|</span>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{item.changedAt}</span>
                      </div>
                    </div>

                    {item.fieldChanged && (
                      <div className="mb-2 text-sm">
                        <span className="text-gray-500">变更字段：</span>
                        <span className="font-medium text-gray-700">{item.fieldChanged}</span>
                      </div>
                    )}

                    {item.oldValue && item.newValue && (
                      <div className="mb-2 flex items-center space-x-2 text-sm">
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                          {item.oldValue}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                          {item.newValue}
                        </span>
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      <span className="text-gray-500">变更原因：</span>
                      {item.reason}
                    </div>

                    {item.impact && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="text-gray-500">影响范围：</span>
                        <span className="text-orange-600">{item.impact}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
