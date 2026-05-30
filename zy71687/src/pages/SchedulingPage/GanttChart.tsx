import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const ROW_LABELS = ['锁汇到期', '提现到账', '结汇执行'] as const
const START_DATE = '2026-05-20'
const END_DATE = '2026-06-15'

function parseDate(s: string): number {
  return new Date(s).getTime()
}

function dateToOffset(dateStr: string, start: number, totalDays: number): number {
  const diff = (parseDate(dateStr) - start) / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.min(totalDays, diff))
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export default function GanttChart() {
  const { forwardContracts, withdrawals, settlementPlans } = useStore()

  const { totalDays, startMs, dayLabels, conflictDates, events } = useMemo(() => {
    const start = parseDate(START_DATE)
    const end = parseDate(END_DATE)
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1

    const labels: string[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(start + i * 86400000)
      labels.push(formatDate(d))
    }

    const expiryDates = new Set<string>()
    const arrivalDates = new Set<string>()
    const planDates = new Set<string>()

    forwardContracts.forEach((c) => expiryDates.add(c.expiryDate))
    withdrawals.forEach((w) => arrivalDates.add(w.actualArrivalDate))
    settlementPlans.forEach((p) => planDates.add(p.plannedDate))

    const conflicts = new Set<string>()
    const allDates = [expiryDates, arrivalDates, planDates]
    for (let i = 0; i < allDates.length; i++) {
      for (let j = i + 1; j < allDates.length; j++) {
        for (const d of allDates[i]) {
          if (allDates[j].has(d)) conflicts.add(d)
        }
      }
    }

    const row0: { id: string; start: number; width: number; label: string; color: string; dateStr: string }[] = []
    const row1: { id: string; start: number; width: number; label: string; color: string; dateStr: string }[] = []
    const row2: { id: string; start: number; width: number; label: string; color: string; dateStr: string }[] = []

    forwardContracts.forEach((c) => {
      const s = dateToOffset(c.contractDate, start, days)
      const e = dateToOffset(c.expiryDate, start, days)
      row0.push({
        id: c.id,
        start: s,
        width: Math.max(e - s, 1),
        label: `${c.id}`,
        color: 'bg-emerald-500/70',
        dateStr: c.expiryDate,
      })
    })

    withdrawals.forEach((w) => {
      const req = dateToOffset(w.requestDate, start, days)
      const arr = dateToOffset(w.actualArrivalDate, start, days)
      row1.push({
        id: w.id,
        start: req,
        width: Math.max(arr - req, 1),
        label: `${w.id}`,
        color: w.status === 'delayed' ? 'bg-amber-500/70' : 'bg-sky-500/70',
        dateStr: w.actualArrivalDate,
      })
    })

    settlementPlans.forEach((p) => {
      const offset = dateToOffset(p.plannedDate, start, days)
      row2.push({
        id: p.id,
        start: Math.max(0, offset - 1),
        width: 3,
        label: `${p.id}`,
        color: p.status === 'skipped_exception' ? 'bg-red-500/70' : 'bg-cyan-500/70',
        dateStr: p.plannedDate,
      })
    })

    return {
      totalDays: days,
      startMs: start,
      dayLabels: labels,
      conflictDates: conflicts,
      events: [row0, row1, row2],
    }
  }, [forwardContracts, withdrawals, settlementPlans])

  const colWidth = 32

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-white/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90">排程甘特图</h2>
      </div>
      <div className="p-4 overflow-x-auto">
        <div style={{ minWidth: totalDays * colWidth + 80 }}>
          <div className="flex mb-1" style={{ paddingLeft: 80 }}>
            {dayLabels.map((label, i) => {
              const dateStr = new Date(startMs + i * 86400000).toISOString().slice(0, 10)
              const isConflict = conflictDates.has(dateStr)
              const isToday = dateStr === new Date().toISOString().slice(0, 10)
              return (
                <div
                  key={i}
                  style={{ width: colWidth }}
                  className={cn(
                    'text-center text-[9px] shrink-0',
                    isConflict ? 'text-red-400 font-bold' : isToday ? 'text-[#00d4aa] font-medium' : 'text-white/25'
                  )}
                >
                  {i % 2 === 0 ? label : ''}
                </div>
              )
            })}
          </div>

          {ROW_LABELS.map((label, rowIdx) => (
            <div key={label} className="flex items-center mb-2">
              <div className="w-20 shrink-0 text-[10px] text-white/40 pr-2 text-right">{label}</div>
              <div className="relative flex" style={{ width: totalDays * colWidth, height: 28 }}>
                {Array.from({ length: totalDays }).map((_, i) => {
                  const dateStr = new Date(startMs + i * 86400000).toISOString().slice(0, 10)
                  const isConflict = conflictDates.has(dateStr)
                  const isToday = dateStr === new Date().toISOString().slice(0, 10)
                  return (
                    <div
                      key={i}
                      style={{ width: colWidth }}
                      className={cn(
                        'shrink-0 h-full border-r',
                        isConflict
                          ? 'border-red-500/20 bg-red-500/5'
                          : isToday
                            ? 'border-[#00d4aa]/20 bg-[#00d4aa]/5'
                            : 'border-white/[0.03]',
                        isConflict && 'ring-1 ring-red-500/30 ring-inset'
                      )}
                    />
                  )
                })}
                {events[rowIdx].map((evt) => (
                  <div
                    key={evt.id}
                    className={cn(
                      'absolute top-1 h-[20px] rounded flex items-center px-1.5 text-[9px] text-white font-medium truncate',
                      evt.color
                    )}
                    style={{
                      left: evt.start * colWidth,
                      width: Math.max(evt.width * colWidth, colWidth),
                    }}
                    title={`${evt.label} (${evt.dateStr})`}
                  >
                    {evt.label}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 mt-3 ml-20">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-emerald-500/70" />
              <span className="text-[10px] text-white/35">锁汇合约</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-sky-500/70" />
              <span className="text-[10px] text-white/35">提现到账</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-amber-500/70" />
              <span className="text-[10px] text-white/35">延迟提现</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-cyan-500/70" />
              <span className="text-[10px] text-white/35">结汇执行</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm border border-red-500/50 bg-red-500/10" />
              <span className="text-[10px] text-white/35">日期冲突</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
