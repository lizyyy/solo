import { useNavigate } from 'react-router-dom'
import { Eye, MessageSquare, Clock, Thermometer, Droplets, Wind, FlaskConical } from 'lucide-react'
import type { AnomalyRecord } from '@/utils/types'
import { ANOMALY_TYPE_LABELS } from '@/utils/types'
import StatusBadge from './StatusBadge'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import { cn } from '@/lib/utils'

interface AnomalyTableProps {
  records: AnomalyRecord[]
}

const anomalyIcons = {
  TEMP_ANOMALY: Thermometer,
  SALINITY_ANOMALY: Droplets,
  DO_ANOMALY: Wind,
  PH_ANOMALY: FlaskConical,
  MULTI_ANOMALY: Eye,
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatFullTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export default function AnomalyTable({ records }: AnomalyTableProps) {
  const navigate = useNavigate()
  const { getShipRecordsByAnomalyId, getRemarksByRecordId } = useAnomalyStore()

  return (
    <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ocean-700 bg-ocean-800/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                浮标编号
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  传感器时间
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                异常类型
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                关键指标
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                船上记录
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                备注
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ocean-700/50">
            {records.map((record) => {
              const shipRecords = getShipRecordsByAnomalyId(record.id)
              const remarks = getRemarksByRecordId(record.id)
              const hasBoundarySample = shipRecords.some((s) => s.isBoundarySample)
              const Icon = anomalyIcons[record.anomalyType]

              return (
                <tr
                  key={record.id}
                  onClick={() => navigate(`/record/${record.id}`)}
                  className={cn(
                    'group cursor-pointer transition-all duration-200 hover:bg-neon/5',
                    record.status === 'SUSPENDED' && 'bg-alert/5'
                  )}
                >
                  <td className="px-4 py-3.5">
                    <span className="font-mono font-semibold text-surface">{record.buoyId}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="text-surface font-medium">{formatTime(record.sensorTimestamp)}</p>
                      <p className="text-xs text-muted font-mono">{formatFullTime(record.sensorTimestamp)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'p-1.5 rounded-lg',
                        record.anomalyType === 'MULTI_ANOMALY' ? 'bg-alert/10 text-alert' : 'bg-neon/10 text-neon'
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-surface">{ANOMALY_TYPE_LABELS[record.anomalyType]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs font-mono px-2 py-1 rounded bg-ocean-700/50 text-muted">
                        水温 {record.waterTemp.toFixed(1)}°C
                      </span>
                      <span className="text-xs font-mono px-2 py-1 rounded bg-ocean-700/50 text-muted">
                        盐度 {record.salinity.toFixed(1)}
                      </span>
                      <span className="text-xs font-mono px-2 py-1 rounded bg-ocean-700/50 text-muted">
                        DO {record.dissolvedOxygen.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {shipRecords.length > 0 ? (
                        <>
                          <span className="text-sm text-neon">{shipRecords.length} 条</span>
                          {hasBoundarySample && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              边界样本
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted">待导入</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-muted" />
                      <span className={cn(
                        'text-sm',
                        remarks.length > 0 ? 'text-surface' : 'text-muted'
                      )}>
                        {remarks.length}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-neon bg-neon/10 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neon/20">
                      <Eye className="w-3.5 h-3.5" />
                      详情
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
