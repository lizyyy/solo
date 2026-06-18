import { AlertTriangle, CheckCircle, XCircle, MapPin, Info } from 'lucide-react'
import type { ShipRecord, AnomalyRecord } from '@/utils/types'
import { detectCoordReversal } from '@/utils/coordCheck'
import { makeShipKey } from '@/utils/dedup'
import { cn } from '@/lib/utils'

interface PreviewItem {
  record: ShipRecord
  isDuplicate: boolean
  isCoordReversed: boolean
  coordReason: string
  isBoundary: boolean
  linkedAnomaly?: AnomalyRecord
}

interface ImportPreviewProps {
  records: ShipRecord[]
  existingShipRecords: ShipRecord[]
  existingAnomalies: AnomalyRecord[]
}

export default function ImportPreview({ records, existingShipRecords, existingAnomalies }: ImportPreviewProps) {
  const existingShipKeys = new Set(existingShipRecords.map(makeShipKey))

  const previewItems: PreviewItem[] = records.map((record) => {
    const isDuplicate = existingShipKeys.has(makeShipKey(record))
    const coordCheck = detectCoordReversal(record.recordLat, record.recordLng)
    const linkedAnomaly = existingAnomalies.find((a) => a.id === record.linkedAnomalyId)

    return {
      record,
      isDuplicate,
      isCoordReversed: coordCheck.reversed,
      coordReason: coordCheck.reason,
      isBoundary: record.isBoundarySample,
      linkedAnomaly,
    }
  })

  const duplicateCount = previewItems.filter((p) => p.isDuplicate).length
  const coordReversedCount = previewItems.filter((p) => p.isCoordReversed).length
  const boundaryCount = previewItems.filter((p) => p.isBoundary).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2 text-muted">
          <CheckCircle className="w-4 h-4 text-neon" />
          <span>待导入：<strong className="text-surface">{previewItems.length}</strong> 条</span>
        </div>
        {duplicateCount > 0 && (
          <div className="flex items-center gap-2 text-muted">
            <XCircle className="w-4 h-4 text-muted" />
            <span>重复：<strong className="text-muted">{duplicateCount}</strong> 条（跳过）</span>
          </div>
        )}
        {coordReversedCount > 0 && (
          <div className="flex items-center gap-2 text-alert">
            <AlertTriangle className="w-4 h-4" />
            <span>经纬度反写：<strong>{coordReversedCount}</strong> 条（挂起）</span>
          </div>
        )}
        {boundaryCount > 0 && (
          <div className="flex items-center gap-2 text-blue-400">
            <Info className="w-4 h-4" />
            <span>边界样本：<strong>{boundaryCount}</strong> 条</span>
          </div>
        )}
      </div>

      <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ocean-700 bg-ocean-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  浮标编号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  记录时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  经纬度
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  关联异常
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  标记
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ocean-700/50">
              {previewItems.map((item, idx) => (
                <tr
                  key={idx}
                  className={cn(
                    'transition-colors',
                    item.isDuplicate && 'opacity-50',
                    item.isCoordReversed && 'bg-alert/10',
                    item.isBoundary && !item.isCoordReversed && 'bg-blue-500/5'
                  )}
                >
                  <td className="px-4 py-3">
                    {item.isDuplicate ? (
                      <div className="flex items-center gap-1.5 text-muted">
                        <XCircle className="w-4 h-4" />
                        <span className="text-xs line-through">重复</span>
                      </div>
                    ) : item.isCoordReversed ? (
                      <div className="flex items-center gap-1.5 text-alert">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs">挂起</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-neon">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs">新增</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'font-mono text-surface',
                      item.isDuplicate && 'line-through'
                    )}>
                      {item.record.buoyId}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-sm font-mono',
                      item.isDuplicate ? 'text-muted line-through' : 'text-surface'
                    )}>
                      {new Date(item.record.recordTimestamp).toLocaleString('zh-CN')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin className={cn(
                        'w-3.5 h-3.5',
                        item.isCoordReversed ? 'text-alert' : 'text-muted'
                      )} />
                      <span className={cn(
                        'text-sm font-mono',
                        item.isDuplicate && 'line-through',
                        item.isCoordReversed ? 'text-alert' : 'text-surface'
                      )}>
                        {item.record.recordLat.toFixed(2)}, {item.record.recordLng.toFixed(2)}
                      </span>
                    </div>
                    {item.isCoordReversed && (
                      <p className="text-xs text-alert mt-1">{item.coordReason}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.linkedAnomaly ? (
                      <span className="text-sm text-neon">{item.linkedAnomaly.buoyId}</span>
                    ) : (
                      <span className="text-xs text-muted">新建异常</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.isBoundary && (
                      <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        边界样本
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 p-4 rounded-lg bg-ocean-800/30 border border-ocean-700">
        <Info className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
        <div className="text-xs text-muted">
          <p className="mb-1">• 重复记录将被跳过，不会覆盖原有数据和备注</p>
          <p className="mb-1">• 经纬度疑似反写的记录将自动标记为"挂起待确认"，并生成系统备注</p>
          <p>• 边界样本用于验证异常判定逻辑的临界阈值，建议每次导入至少包含1条</p>
        </div>
      </div>
    </div>
  )
}
