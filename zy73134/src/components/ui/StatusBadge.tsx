import React from 'react'
import { StationRecord } from '@/types/station'

interface StatusBadgeProps {
  record: StationRecord
}

const badgeBase =
  'text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide inline-flex items-center gap-1 whitespace-nowrap'

const StatusBadge: React.FC<StatusBadgeProps> = ({ record }) => {
  const badges: React.ReactNode[] = []

  if (record.time_conflict) {
    badges.push(
      <span
        key="time-conflict"
        className={`${badgeBase} bg-alert-red/20 text-alert-red border border-alert-red/40 shadow-red-glow`}
      >
        ⏱时间冲突
      </span>,
    )
  }

  if (record.result_abnormal) {
    badges.push(
      <span
        key="result-abnormal"
        className={`${badgeBase} bg-alert-red/20 text-alert-red border border-alert-red/40 shadow-red-glow`}
      >
        ⚠️结果超阈
      </span>,
    )
  }

  if (record.cloud_impact === '严重') {
    badges.push(
      <span
        key="cloud-heavy"
        className={`${badgeBase} bg-alert-gray/20 text-alert-gray border border-alert-gray/40`}
      >
        ☁️云遮严重
      </span>,
    )
  } else if (record.cloud_impact === '部分') {
    badges.push(
      <span
        key="cloud-partial"
        className={`${badgeBase} bg-alert-yellow/15 text-alert-yellow border border-alert-yellow/40 shadow-yellow-glow`}
      >
        ☁️部分云遮
      </span>,
    )
  }

  if (record.status === '已核对') {
    badges.push(
      <span
        key="status-verified"
        className={`${badgeBase} bg-alert-green/20 text-alert-green border border-alert-green/40`}
      >
        ✓已核对
      </span>,
    )
  } else if (record.status === '已修正') {
    badges.push(
      <span
        key="status-fixed"
        className={`${badgeBase} bg-alert-yellow/20 text-alert-yellow border border-alert-yellow/40 shadow-yellow-glow`}
      >
        ⚒已修正
      </span>,
    )
  } else {
    badges.push(
      <span
        key="status-raw"
        className={`${badgeBase} bg-deepsea-400/25 text-deepsea-100 border border-deepsea-400/40`}
      >
        ◎原始
      </span>,
    )
  }

  return <div className="inline-flex flex-wrap items-center gap-1.5">{badges}</div>
}

export default StatusBadge
