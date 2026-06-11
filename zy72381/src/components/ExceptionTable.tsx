import { AlertTriangle, CheckCircle, Clock, History } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { getExceptionTypeLabel, getExceptionStatusLabel } from '@/utils/calibration'
import { formatDateTime } from '@/utils/formatters'
import { clsx } from 'clsx'

export function ExceptionTable() {
  const { exceptions, selectRecord, setShowDetailModal } = useAppStore()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <AlertTriangle className="w-4 h-4 text-warning-500" />
      case 'supplemented':
        return <History className="w-4 h-4 text-supplement-500" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-success-500" />
      default:
        return <Clock className="w-4 h-4 text-industrial-400" />
    }
  }

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'pending_review':
        return 'bg-warning-500/10'
      case 'supplemented':
        return 'bg-supplement-500/10'
      case 'resolved':
        return 'bg-success-500/10'
      default:
        return 'bg-industrial-700/50'
    }
  }

  const handleRowClick = (recordId: string) => {
    selectRecord(recordId)
    setShowDetailModal(true)
  }

  return (
    <div className="bg-industrial-800 rounded-lg card-shadow overflow-hidden">
      <div className="p-4 border-b border-industrial-700">
        <h2 className="text-lg font-bold text-industrial-100 font-serif flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-500" />
          异常工况表
          <span className="text-sm font-normal text-industrial-400">
            ({exceptions.length} 条)
          </span>
        </h2>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-industrial-900/50">
            <tr>
              <th className="text-left p-3 font-medium text-industrial-400">记录编号</th>
              <th className="text-left p-3 font-medium text-industrial-400">异常类型</th>
              <th className="text-left p-3 font-medium text-industrial-400">状态</th>
              <th className="text-left p-3 font-medium text-industrial-400">传感器</th>
              <th className="text-left p-3 font-medium text-industrial-400">描述</th>
              <th className="text-left p-3 font-medium text-industrial-400">操作人</th>
              <th className="text-left p-3 font-medium text-industrial-400">更新时间</th>
            </tr>
          </thead>
          <tbody>
            {exceptions.map((exception) => (
              <tr
                key={exception.id}
                onClick={() => handleRowClick(exception.recordId)}
                className={clsx(
                  'border-b border-industrial-700/50 cursor-pointer hover:bg-industrial-700/30 transition-colors',
                  getStatusBgColor(exception.status)
                )}
              >
                <td className="p-3">
                  <span className="font-mono font-semibold text-industrial-100">
                    {exception.recordNo}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-industrial-300">
                    {getExceptionTypeLabel(exception.exceptionType)}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(exception.status)}
                    <span className="text-industrial-300">
                      {getExceptionStatusLabel(exception.status)}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="font-mono text-industrial-400">
                    {exception.sensorId || '-'}
                  </span>
                </td>
                <td className="p-3 max-w-xs">
                  <span className="text-industrial-400 line-clamp-2">
                    {exception.description}
                  </span>
                </td>
                <td className="p-3">
                  <span className="text-industrial-400">{exception.operator}</span>
                </td>
                <td className="p-3">
                  <span className="text-industrial-500 text-xs">
                    {formatDateTime(exception.updatedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {exceptions.length === 0 && (
        <div className="p-8 text-center text-industrial-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-success-500/50" />
          <p>暂无异常记录</p>
        </div>
      )}
    </div>
  )
}
