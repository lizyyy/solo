import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { ReviewStatus } from '@/types'
import { REVIEW_STATUS_LABELS } from '@/types'
import { useWaterQualityStore } from '@/store'

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: 'bg-rust/20 text-rust border-rust/30',
  confirmed: 'bg-sand/20 text-sand border-sand/30',
  resolved: 'bg-tide/20 text-tide border-tide/30',
}

interface ReviewFlagCardProps {
  recordId: string
}

export default function ReviewFlagCard({ recordId }: ReviewFlagCardProps) {
  const allReviews = useWaterQualityStore((s) => s.reviews)
  const records = useWaterQualityStore((s) => s.records)
  const updateReviewStatus = useWaterQualityStore((s) => s.updateReviewStatus)

  const review = useMemo(
    () => allReviews.find((r) => r.recordId === recordId),
    [allReviews, recordId]
  )

  const [note, setNote] = useState(review?.reviewerNote ?? '')
  const [status, setStatus] = useState<ReviewStatus>(review?.reviewStatus ?? 'pending')

  const navigate = useNavigate()

  if (!review) return null

  const currentRecord = records.find((r) => r.id === recordId)
  const relatedRecord = review.relatedRecordId
    ? records.find((r) => r.id === review.relatedRecordId)
    : undefined

  const handleSave = () => {
    updateReviewStatus(review.id, status, note)
  }

  return (
    <div className="rounded-lg border-2 border-rust/50 bg-ocean-900 p-5">
      <h3 className="mb-3 font-serif text-lg text-rust">复核标记</h3>

      <div className="mb-3">
        <span className="text-sm text-foam/60">复核原因</span>
        <p className="mt-1 text-sm text-foam/90">{review.reviewReason}</p>
      </div>

      {review.relatedRecordId && (
        <div className="mb-3">
          <span className="text-sm text-foam/60">关联记录</span>
          <button
            onClick={() => navigate(`/record/${review.relatedRecordId}`)}
            className="mt-1 flex items-center gap-1 text-sm text-tide hover:text-tide-light transition-colors"
          >
            {review.relatedRecordId}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {relatedRecord && currentRecord && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <MiniRecordCard label="当前记录" record={currentRecord} />
          <MiniRecordCard label="关联记录" record={relatedRecord} />
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-foam/60">状态</span>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[review.reviewStatus]}`}
        >
          {REVIEW_STATUS_LABELS[review.reviewStatus]}
        </span>
      </div>

      <div className="mb-3">
        <label className="block text-sm text-foam/60 mb-1">复核备注</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded border border-ocean-700/50 bg-ocean-800 p-2 text-sm text-foam placeholder-foam/30 focus:border-tide/50 focus:outline-none resize-none"
          placeholder="输入复核备注..."
        />
      </div>

      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ReviewStatus)}
          className="rounded border border-ocean-700/50 bg-ocean-800 px-2 py-1 text-sm text-foam focus:border-tide/50 focus:outline-none"
        >
          <option value="pending">待复核</option>
          <option value="confirmed">已确认</option>
          <option value="resolved">已解决</option>
        </select>

        <button
          onClick={handleSave}
          className="rounded bg-tide/20 px-3 py-1 text-sm font-medium text-tide border border-tide/30 hover:bg-tide/30 transition-colors"
        >
          更新状态
        </button>
      </div>
    </div>
  )
}

function MiniRecordCard({
  label,
  record,
}: {
  label: string
  record: { id: string; parameter: string; value: number; unit: string }
}) {
  return (
    <div className="rounded border border-ocean-700/40 bg-ocean-800/60 p-2">
      <div className="text-xs text-foam/40 mb-1">{label}</div>
      <div className="text-xs text-foam/60">{record.id}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-xs text-foam/50">{record.parameter}</span>
        <span className="font-mono text-sm text-foam">{record.value}</span>
        <span className="text-xs text-foam/50">{record.unit}</span>
      </div>
    </div>
  )
}
