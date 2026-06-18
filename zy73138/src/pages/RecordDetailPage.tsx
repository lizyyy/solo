import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useWaterQualityStore } from '@/store'
import RecordInfo from '@/components/record/RecordInfo'
import DataSourceTimeline from '@/components/record/DataSourceTimeline'
import ReviewFlagCard from '@/components/record/ReviewFlagCard'

export default function RecordDetailPage() {
  const { recordId } = useParams<{ recordId: string }>()
  const records = useWaterQualityStore((s) => s.records)
  const allReviews = useWaterQualityStore((s) => s.reviews)

  const record = records.find((r) => r.id === recordId)
  const review = useMemo(
    () => (recordId ? allReviews.find((r) => r.recordId === recordId) : undefined),
    [allReviews, recordId]
  )

  if (!record) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-2 text-lg text-foam/80">未找到该记录</p>
          <p className="text-sm text-foam/40 mb-4">记录 ID: {recordId}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-tide hover:text-tide-light transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ocean-900 py-6">
      <div className="mx-auto max-w-3xl px-4">
        <nav className="mb-4 flex items-center gap-1 text-sm text-foam/50">
          <Link to="/" className="hover:text-foam transition-colors">
            首页
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foam/50">记录详情</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foam/80">{record.id}</span>
        </nav>

        <div className="mb-5 flex items-center gap-3">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-ocean-700/50 bg-ocean-800 text-foam/60 hover:text-foam hover:border-ocean-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-serif text-xl text-foam">记录详情</h1>
        </div>

        <div className="flex flex-col gap-5">
          <RecordInfo record={record} />
          <DataSourceTimeline recordId={record.id} />
          {review && <ReviewFlagCard recordId={record.id} />}
        </div>
      </div>
    </div>
  )
}
