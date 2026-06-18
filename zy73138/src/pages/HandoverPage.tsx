import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Map, History, ClipboardList, BookOpen, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { useWaterQualityStore } from '@/store'
import { HANDOVER_STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import HandoverList from '@/components/handover/HandoverList'
import LogbookCompare from '@/components/handover/LogbookCompare'
import CsvExport from '@/components/handover/CsvExport'

export default function HandoverPage() {
  const handovers = useWaterQualityStore((s) => s.handovers)
  const records = useWaterQualityStore((s) => s.records)
  const completeHandover = useWaterQualityStore((s) => s.completeHandover)
  const [confirmed, setConfirmed] = useState(false)

  const total = handovers.length
  const completed = handovers.filter((h) => h.handoverStatus === 'completed').length
  const pending = handovers.filter((h) => h.handoverStatus === 'pending').length
  const needsReview = handovers.filter((h) => h.handoverStatus === 'confirmed').length

  const confirmedItems = handovers.filter((h) => h.handoverStatus === 'confirmed')

  const handleCompleteAll = () => {
    confirmedItems.forEach((item) => completeHandover(item.id))
    setConfirmed(true)
    setTimeout(() => setConfirmed(false), 2500)
  }

  return (
    <div className="min-h-screen bg-ocean-900 text-foam">
      <nav className="border-b border-ocean-700 bg-ocean-900/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <span className="font-serif text-lg text-foam">近岸水质空间标注</span>
          <div className="flex gap-4">
            <Link to="/" className="flex items-center gap-1.5 text-sm text-foam/60 transition-colors hover:text-tide">
              <Map size={16} />
              地图
            </Link>
            <Link to="/history" className="flex items-center gap-1.5 text-sm text-foam/60 transition-colors hover:text-tide">
              <History size={16} />
              历史
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="font-serif text-3xl text-foam mb-8">交接工作台</h1>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="rounded-lg border border-ocean-700 bg-ocean-800/40 p-4">
            <div className="flex items-center gap-2 text-foam/50 text-xs font-sans mb-1">
              <ClipboardList size={14} />
              总记录
            </div>
            <div className="font-mono text-2xl text-foam">{total}</div>
          </div>
          <div className="rounded-lg border border-tide/30 bg-tide/5 p-4">
            <div className="flex items-center gap-2 text-tide/70 text-xs font-sans mb-1">
              <CheckCircle2 size={14} />
              已完成
            </div>
            <div className="font-mono text-2xl text-tide">{completed}</div>
          </div>
          <div className="rounded-lg border border-rust/30 bg-rust/5 p-4">
            <div className="flex items-center gap-2 text-rust/70 text-xs font-sans mb-1">
              <AlertCircle size={14} />
              待交接
            </div>
            <div className="font-mono text-2xl text-rust">{pending}</div>
          </div>
          <div className="rounded-lg border border-sand/30 bg-sand/5 p-4">
            <div className="flex items-center gap-2 text-sand/70 text-xs font-sans mb-1">
              <Clock size={14} />
              待确认
            </div>
            <div className="font-mono text-2xl text-sand">{needsReview}</div>
          </div>
        </div>

        <section className="mb-10">
          <h2 className="font-serif text-xl text-foam mb-4">交接清单</h2>
          <div className="rounded-lg border border-ocean-700 bg-ocean-800/30 overflow-hidden">
            <HandoverList />
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-serif text-xl text-foam mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-sand" />
            记录本对比
          </h2>
          <LogbookCompare />
        </section>

        <section className="rounded-lg border border-ocean-700 bg-ocean-800/30 p-6">
          <h2 className="font-serif text-xl text-foam mb-4">交接确认</h2>
          <div className="space-y-2 mb-6">
            {records.map((record) => {
              const handover = handovers.find((h) => h.recordId === record.id)
              const status = handover?.handoverStatus ?? 'pending'
              return (
                <div key={record.id} className="flex items-center justify-between py-2 border-b border-ocean-700/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-foam">{record.bottleNumber}</span>
                    <span className="text-xs text-foam/50">{record.stationName}</span>
                  </div>
                  <span
                    className={cn(
                      'rounded border px-2 py-0.5 text-xs font-sans',
                      status === 'completed' && 'bg-tide/20 text-tide border-tide/30',
                      status === 'confirmed' && 'bg-sand/20 text-sand border-sand/30',
                      status === 'pending' && 'bg-rust/20 text-rust border-rust/30'
                    )}
                  >
                    {HANDOVER_STATUS_LABELS[status]}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-ocean-700">
            <CsvExport />
            <button
              onClick={handleCompleteAll}
              disabled={confirmedItems.length === 0 || confirmed}
              className={cn(
                'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-sans transition-colors',
                confirmed
                  ? 'bg-tide/20 text-tide cursor-default'
                  : confirmedItems.length === 0
                    ? 'bg-ocean-700/50 text-foam/30 cursor-not-allowed'
                    : 'bg-tide text-ocean-900 hover:bg-tide-light'
              )}
            >
              <CheckCircle2 size={16} />
              {confirmed ? '已完成交接' : `确认完成交接 (${confirmedItems.length})`}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
