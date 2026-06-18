import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, PauseCircle, RotateCcw, AlertTriangle } from 'lucide-react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import { detectCoordReversal } from '@/utils/coordCheck'
import CoordWarning from '@/components/CoordWarning'
import ComparisonView from '@/components/ComparisonView'
import RemarkTimeline from '@/components/RemarkTimeline'
import StatusBadge from '@/components/StatusBadge'
import { ANOMALY_TYPE_LABELS } from '@/utils/types'
import type { RecordStatus } from '@/utils/types'
import { cn } from '@/lib/utils'

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    initialize,
    getAnomalyById,
    getShipRecordsByAnomalyId,
    getRemarksByRecordId,
    updateAnomalyStatus,
    addRemark,
  } = useAnomalyStore()

  const [showConfirmDialog, setShowConfirmDialog] = useState<RecordStatus | null>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

  const anomaly = id ? getAnomalyById(id) : undefined
  const shipRecords = id ? getShipRecordsByAnomalyId(id) : []
  const remarks = id ? getRemarksByRecordId(id) : []

  if (!anomaly) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-12 h-12 text-alert mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-surface mb-2">记录不存在</h2>
        <p className="text-muted mb-4">该异常记录可能已被删除或ID无效</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-lg bg-neon text-ocean-950 font-medium"
        >
          返回队列
        </button>
      </div>
    )
  }

  const coordCheck = detectCoordReversal(anomaly.sensorLat, anomaly.sensorLng)

  const handleStatusChange = (newStatus: RecordStatus) => {
    if (newStatus === 'SUSPENDED' && coordCheck.reversed) {
      updateAnomalyStatus(anomaly.id, newStatus)
      addRemark(anomaly.id, '系统', `系统检测：经纬度疑似反写 - ${coordCheck.reason}，已挂起待确认`)
      setShowConfirmDialog(null)
    } else if (newStatus === 'CONFIRMED' && anomaly.status === 'SUSPENDED') {
      updateAnomalyStatus(anomaly.id, newStatus)
      addRemark(anomaly.id, '接手同事', '已确认经纬度信息，解除挂起状态')
      setShowConfirmDialog(null)
    } else {
      updateAnomalyStatus(anomaly.id, newStatus)
      setShowConfirmDialog(null)
    }
  }

  const handleSuspend = () => {
    handleStatusChange('SUSPENDED')
  }

  const handleConfirmSuspended = () => {
    handleStatusChange('CONFIRMED')
  }

  const handleAddRemark = (author: string, content: string) => {
    addRemark(anomaly.id, author, content)
  }

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-muted hover:text-surface transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回异常队列
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-surface font-display">
              {anomaly.buoyId} - {ANOMALY_TYPE_LABELS[anomaly.anomalyType]}
            </h1>
            <StatusBadge status={anomaly.status} />
          </div>
          <p className="text-sm text-muted">
            传感器时间：{new Date(anomaly.sensorTimestamp).toLocaleString('zh-CN')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {anomaly.status !== 'SUSPENDED' && anomaly.status !== 'CONFIRMED' && (
            <button
              onClick={() => setShowConfirmDialog('CONFIRMED')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neon text-ocean-950 font-semibold hover:bg-neon/90 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              确认正常
            </button>
          )}
          {anomaly.status !== 'SUSPENDED' && (
            <button
              onClick={() => setShowConfirmDialog('SUSPENDED')}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all',
                coordCheck.reversed
                  ? 'bg-alert text-white hover:bg-alert/90 animate-pulse-alert'
                  : 'bg-ocean-700 text-surface hover:bg-ocean-600'
              )}
            >
              <PauseCircle className="w-4 h-4" />
              挂起待确认
            </button>
          )}
          {anomaly.status === 'RESOLVED' && (
            <button
              onClick={() => setShowConfirmDialog('UNCONFIRMED')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ocean-700 text-surface hover:bg-ocean-600 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              重新确认
            </button>
          )}
        </div>
      </div>

      <CoordWarning
        lat={anomaly.sensorLat}
        lng={anomaly.sensorLng}
        status={anomaly.status}
        onSuspend={handleSuspend}
        onConfirm={handleConfirmSuspended}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ComparisonView anomaly={anomaly} shipRecords={shipRecords} />

          <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 p-5">
            <h3 className="font-semibold text-surface font-display mb-4">完整数据</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted mb-1">创建时间</p>
                <p className="text-sm text-surface font-mono">
                  {new Date(anomaly.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">更新时间</p>
                <p className="text-sm text-surface font-mono">
                  {new Date(anomaly.updatedAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">记录ID</p>
                <p className="text-sm text-surface font-mono truncate">{anomaly.id.slice(0, 8)}...</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">关联船上记录</p>
                <p className="text-sm text-surface font-mono">{shipRecords.length} 条</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <RemarkTimeline remarks={remarks} onAddRemark={handleAddRemark} />
        </div>
      </div>

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-ocean-800 border border-ocean-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-surface font-display mb-2">
              {showConfirmDialog === 'CONFIRMED' && anomaly.status === 'SUSPENDED'
                ? '确认解除挂起'
                : showConfirmDialog === 'CONFIRMED'
                ? '确认异常记录'
                : '挂起待确认'}
            </h3>
            <p className="text-muted text-sm mb-6">
              {showConfirmDialog === 'CONFIRMED' && anomaly.status === 'SUSPENDED'
                ? '确认经纬度信息无误，将该记录从挂起状态转为已确认。此操作将被记录到备注中。'
                : showConfirmDialog === 'CONFIRMED'
                ? '确认该异常记录已核实，状态将更新为"已确认"。'
                : coordCheck.reversed
                ? `检测到经纬度疑似反写：${coordCheck.reason}。挂起后需接手同事确认方可解除。`
                : '将该记录标记为"挂起待确认"，等待接手同事核实。'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-4 py-2 rounded-lg bg-ocean-700 text-surface hover:bg-ocean-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleStatusChange(showConfirmDialog)}
                className={cn(
                  'px-4 py-2 rounded-lg font-semibold transition-colors',
                  showConfirmDialog === 'SUSPENDED'
                    ? 'bg-alert text-white hover:bg-alert/90'
                    : 'bg-neon text-ocean-950 hover:bg-neon/90'
                )}
              >
                {showConfirmDialog === 'CONFIRMED' ? '确认' : '挂起'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
