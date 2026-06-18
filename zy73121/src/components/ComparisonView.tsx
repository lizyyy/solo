import { Ship, Radio, Clock, MapPin, Thermometer, Droplets, Wind, FlaskConical } from 'lucide-react'
import type { AnomalyRecord, ShipRecord } from '@/utils/types'
import { cn } from '@/lib/utils'

interface ComparisonViewProps {
  anomaly: AnomalyRecord
  shipRecords: ShipRecord[]
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getTimeDiff(sensorTime: string, shipTime: string): string {
  const diff = new Date(shipTime).getTime() - new Date(sensorTime).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `晚 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `晚 ${hours}小时${mins > 0 ? mins + '分钟' : ''}`
}

interface DataRowProps {
  label: React.ReactNode
  sensorValue: string | number
  shipValue?: string | number
  unit?: string
  hasDiff?: boolean
}

function DataRow({ label, sensorValue, shipValue, unit, hasDiff }: DataRowProps) {
  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-ocean-700/50 last:border-0">
      <div className="text-muted text-sm flex items-center gap-2">
        {label}
      </div>
      <div className="font-mono text-surface">
        {sensorValue}
        {unit && <span className="text-muted ml-1 text-xs">{unit}</span>}
      </div>
      <div className={cn(
        'font-mono',
        shipValue !== undefined ? 'text-surface' : 'text-muted',
        hasDiff && 'text-alert'
      )}>
        {shipValue !== undefined ? (
          <>
            {shipValue}
            {unit && <span className="text-muted ml-1 text-xs">{unit}</span>}
            {hasDiff && <span className="ml-2 text-xs">⚠️</span>}
          </>
        ) : (
          <span className="text-xs">—</span>
        )}
      </div>
    </div>
  )
}

export default function ComparisonView({ anomaly, shipRecords }: ComparisonViewProps) {
  const latestShip = shipRecords[shipRecords.length - 1]
  const hasShipRecord = shipRecords.length > 0

  const timeDiff = hasShipRecord
    ? getTimeDiff(anomaly.sensorTimestamp, latestShip.recordTimestamp)
    : null

  const tempDiff = hasShipRecord ? Math.abs(anomaly.waterTemp - latestShip.waterTemp) > 1 : false
  const salDiff = hasShipRecord ? Math.abs(anomaly.salinity - latestShip.salinity) > 2 : false
  const doDiff = hasShipRecord ? Math.abs(anomaly.dissolvedOxygen - latestShip.dissolvedOxygen) > 1 : false
  const phDiff = hasShipRecord ? Math.abs(anomaly.phValue - latestShip.phValue) > 0.3 : false

  return (
    <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 overflow-hidden">
      <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-ocean-800/50 border-b border-ocean-700">
        <div className="text-muted text-xs font-medium uppercase tracking-wider">指标</div>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-neon" />
          <span className="text-xs font-medium text-neon uppercase tracking-wider">传感器数据</span>
        </div>
        <div className="flex items-center gap-2">
          <Ship className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">船上记录</span>
          {latestShip?.isBoundarySample && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
              边界样本
            </span>
          )}
        </div>
      </div>

      <div className="px-6">
        <div className="grid grid-cols-3 gap-4 py-4 border-b border-ocean-700/50">
          <div className="text-muted text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            采集时间
          </div>
          <div className="font-mono text-surface">
            {formatTime(anomaly.sensorTimestamp)}
          </div>
          <div>
            {hasShipRecord ? (
              <div>
                <div className="font-mono text-surface">{formatTime(latestShip.recordTimestamp)}</div>
                {timeDiff && (
                  <div className="text-xs text-alert mt-0.5">{timeDiff}</div>
                )}
              </div>
            ) : (
              <span className="text-muted text-xs">待导入</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 py-3 border-b border-ocean-700/50">
          <div className="text-muted text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            经纬度
          </div>
          <div className="font-mono text-surface">
            {anomaly.sensorLat.toFixed(4)}, {anomaly.sensorLng.toFixed(4)}
          </div>
          <div className="font-mono">
            {hasShipRecord ? (
              `${latestShip.recordLat.toFixed(4)}, ${latestShip.recordLng.toFixed(4)}`
            ) : (
              <span className="text-muted text-xs">—</span>
            )}
          </div>
        </div>

        <DataRow
          label={<><Thermometer className="w-4 h-4" /> 水温</>}
          sensorValue={anomaly.waterTemp.toFixed(1)}
          shipValue={latestShip?.waterTemp.toFixed(1)}
          unit="°C"
          hasDiff={tempDiff}
        />

        <DataRow
          label={<><Droplets className="w-4 h-4" /> 盐度</>}
          sensorValue={anomaly.salinity.toFixed(1)}
          shipValue={latestShip?.salinity.toFixed(1)}
          unit="PSU"
          hasDiff={salDiff}
        />

        <DataRow
          label={<><Wind className="w-4 h-4" /> 溶解氧</>}
          sensorValue={anomaly.dissolvedOxygen.toFixed(1)}
          shipValue={latestShip?.dissolvedOxygen.toFixed(1)}
          unit="mg/L"
          hasDiff={doDiff}
        />

        <DataRow
          label={<><FlaskConical className="w-4 h-4" /> pH值</>}
          sensorValue={anomaly.phValue.toFixed(1)}
          shipValue={latestShip?.phValue.toFixed(1)}
          hasDiff={phDiff}
        />

        {shipRecords.length > 1 && (
          <div className="py-4 text-center text-xs text-muted">
            另有 {shipRecords.length - 1} 条历史船上记录已关联
          </div>
        )}
      </div>
    </div>
  )
}
