import { AlertTriangle } from 'lucide-react'
import type { SampleRecord } from '@/types'
import { formatDateTime } from '@/utils'

interface RecordInfoProps {
  record: SampleRecord
}

export default function RecordInfo({ record }: RecordInfoProps) {
  const exceedsThreshold = record.value > record.threshold

  return (
    <div className="rounded-lg border border-ocean-700/50 bg-ocean-900 p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <FieldRow label="采样瓶编号" value={record.bottleNumber} />
        <FieldRow label="站点" value={record.stationName} />
        <FieldRow label="纬度" value={record.latitude.toFixed(4)} mono />
        <FieldRow label="经度" value={record.longitude.toFixed(4)} mono />
        <FieldRow label="采样时间" value={formatDateTime(record.sampleTime)} />
        <FieldRow label="检测参数" value={record.parameter} />

        <div className="flex items-center gap-2">
          <span className="text-sm text-foam/60">检测值</span>
          <span
            className={`font-mono text-lg font-semibold ${
              record.isAnomaly ? 'text-rust' : 'text-foam'
            }`}
          >
            {record.value}
          </span>
          {record.isAnomaly && <AlertTriangle className="h-4 w-4 text-rust" />}
          {exceedsThreshold && (
            <span className="rounded bg-rust/20 px-1.5 py-0.5 text-xs font-medium text-rust border border-rust/30">
              超标
            </span>
          )}
        </div>

        <FieldRow label="单位" value={record.unit || '--'} />
        <FieldRow label="阈值" value={String(record.threshold)} mono />
      </div>

      <div className="mt-4 border-t border-ocean-700/40 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              record.conclusion === '正常' ? 'bg-tide' : 'bg-rust'
            }`}
          />
          <span className="text-sm text-foam/60">结论</span>
          <span className="text-sm font-medium text-foam">{record.conclusion}</span>
        </div>
      </div>
    </div>
  )
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-foam/60">{label}</span>
      <span className={`text-sm text-foam ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}
