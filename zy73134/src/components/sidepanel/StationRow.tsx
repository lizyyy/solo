import React from 'react'
import { StationRecord } from '@/types/station'
import { useStationStore } from '@/store/stationStore'
import StatusBadge from '@/components/ui/StatusBadge'

interface StationRowProps {
  record: StationRecord
}

const getRowStripeColor = (record: StationRecord): string => {
  if (record.time_conflict || record.result_abnormal) return 'bg-alert-red/60'
  if (record.cloud_impact === '严重') return 'bg-alert-gray/70'
  if (record.status === '原始') return 'bg-alert-yellow/70'
  return 'bg-alert-green/60'
}

const formatTime = (iso: string): string => {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

const StationRow: React.FC<StationRowProps> = ({ record }) => {
  const selectStation = useStationStore((s) => s.selectStation)

  const handleClick = () => {
    selectStation(record.id)
    window.dispatchEvent(
      new CustomEvent('fly-to-station', { detail: { id: record.id } }),
    )
  }

  return (
    <div
      onClick={handleClick}
      className="relative cursor-pointer px-4 py-3 hover:bg-teal-glow/10 transition-colors duration-150 group border-b border-deepsea-600/30"
    >
      <div className="flex items-start gap-0">
        <div
          className={`w-1 rounded-full mr-3 self-stretch min-h-[52px] ${getRowStripeColor(
            record,
          )} group-hover:shadow-[0_0_8px_currentColor] transition-shadow`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono font-semibold text-[13px] text-teal-glow shrink-0">
              {record.station_code}
            </span>
            <span className="text-[14px] font-medium text-deepsea-50 truncate">
              {record.station_name}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-deepsea-200/75">
            <span>
              采样时间:{' '}
              <span className="font-mono text-deepsea-100/90">
                {formatTime(record.sampling_time)}
              </span>
            </span>
            <span>
              能量:{' '}
              <span className="font-mono text-teal-glow/90">
                {record.energy_output.toFixed(1)} MW
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap justify-end items-end gap-1.5 max-w-[60%] ml-3 shrink-0">
          <StatusBadge record={record} />
        </div>
      </div>
    </div>
  )
}

export default StationRow
