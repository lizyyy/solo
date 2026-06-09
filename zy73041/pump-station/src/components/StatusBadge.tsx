import React from 'react'
import type { PumpStatus, ShiftType, RecordSource } from '../types'
import clsx from 'clsx'

export const StatusBadge: React.FC<{ status: PumpStatus }> = ({ status }) => {
  const map: Record<PumpStatus, { label: string; cls: string }> = {
    normal: { label: '正常', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
    warning: { label: '预警', cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
    critical: { label: '超限', cls: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
    suspended: { label: '挂起', cls: 'bg-slate-200 text-slate-700 ring-1 ring-slate-300' },
    pending_confirm: { label: '待主管确认', cls: 'bg-violet-100 text-violet-700 ring-1 ring-violet-200' },
  }
  const cfg = map[status]
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full mr-1.5', {
        'bg-emerald-500': status === 'normal',
        'bg-amber-500': status === 'warning',
        'bg-red-500': status === 'critical',
        'bg-slate-500': status === 'suspended',
        'bg-violet-500': status === 'pending_confirm',
      })} />
      {cfg.label}
    </span>
  )
}

export const ShiftBadge: React.FC<{ shift: ShiftType }> = ({ shift }) => {
  const map: Record<ShiftType, { label: string; cls: string }> = {
    morning: { label: '早班 08-16', cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
    afternoon: { label: '中班 16-24', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' },
    night: { label: '夜班 00-08', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' },
  }
  const cfg = map[shift]
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.cls)}>{cfg.label}</span>
}

export const SourceBadge: React.FC<{ source: RecordSource }> = ({ source }) => {
  const map: Record<RecordSource, { label: string; cls: string }> = {
    routine: { label: '常规巡检', cls: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200' },
    supplement: { label: '补录', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    rerun: { label: '重跑', cls: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
  }
  const cfg = map[source]
  return <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', cfg.cls)}>{cfg.label}</span>
}

export const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
