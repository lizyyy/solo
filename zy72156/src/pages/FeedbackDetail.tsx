import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, AlertTriangle, MapPin } from 'lucide-react'
import { api } from '../services/api'
import type { Feedback, ManualNote } from '../types'
import { ManualNotes } from '../components/ManualNotes'

export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>()
  const [feedback, setFeedback] = useState<
    Feedback & {
      location: { id: string; canonical_name: string; lat: number; lng: number }
      related_duplicates: Feedback[]
      notes: ManualNote[]
    } | null
  >(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadFeedback(id)
  }, [id])

  const loadFeedback = async (feedbackId: string) => {
    setLoading(true)
    try {
      const data = await api.getFeedbackDetail(feedbackId)
      setFeedback(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleNoteAdded = (note: ManualNote) => {
    if (feedback) {
      setFeedback({
        ...feedback,
        notes: [note, ...feedback.notes],
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    )
  }

  if (!feedback) {
    return <div className="p-6">反馈记录不存在</div>
  }

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/feedback" className="text-primary-500 hover:text-primary-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-primary-800 font-serif">反馈详情</h2>
          <p className="text-primary-500 text-sm mt-1">ID: {feedback.id}</p>
        </div>
        <div className="flex gap-2">
          {feedback.is_duplicate && (
            <span className="badge-duplicate flex items-center gap-1">
              <Copy size={12} />
              重复投诉
            </span>
          )}
          {feedback.is_boundary && (
            <span className="badge-boundary flex items-center gap-1">
              <AlertTriangle size={12} />
              边界记录
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card p-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="label">原始地点描述</label>
                <p className="text-primary-800 font-medium">{feedback.raw_location_text}</p>
              </div>
              <div>
                <label className="label">关联点位</label>
                <Link
                  to={`/locations/${feedback.location.id}`}
                  className="text-accent-600 hover:text-accent-700 font-medium flex items-center gap-1"
                >
                  <MapPin size={16} />
                  {feedback.location.canonical_name}
                </Link>
              </div>
              <div>
                <label className="label">来源类型</label>
                <p className="text-primary-800">{feedback.source_type}</p>
              </div>
              <div>
                <label className="label">具体来源</label>
                <p className="text-primary-800">{feedback.source}</p>
              </div>
              <div>
                <label className="label">反馈时间</label>
                <p className="text-primary-800">{feedback.reported_at}</p>
              </div>
              <div>
                <label className="label">录入时间</label>
                <p className="text-primary-800">{feedback.created_at}</p>
              </div>
            </div>

            <div>
              <label className="label">反馈内容</label>
              <div className="p-4 bg-primary-50 rounded-lg">
                {feedback.content ? (
                  <p className="text-primary-800 whitespace-pre-wrap">{feedback.content}</p>
                ) : (
                  <p className="text-primary-400 italic">（空内容记录）</p>
                )}
              </div>
            </div>
          </div>

          {feedback.is_boundary && feedback.boundary_note && (
            <div className="card p-4 border-orange-300 bg-orange-50">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-orange-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-orange-800">边界说明</h4>
                  <p className="text-sm text-orange-700 mt-1">{feedback.boundary_note}</p>
                </div>
              </div>
            </div>
          )}

          {feedback.is_duplicate && (
            <div className="card p-4 border-yellow-300 bg-yellow-50">
              <h4 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
                <Copy size={16} />
                关联的重复投诉
              </h4>
              <div className="space-y-2">
                {feedback.related_duplicates
                  .filter((d) => d.id !== feedback.id)
                  .map((dup) => (
                    <Link
                      key={dup.id}
                      to={`/feedback/${dup.id}`}
                      className="block p-3 rounded-lg bg-white border border-yellow-200 hover:border-yellow-400 transition-colors"
                    >
                      <p className="text-sm text-primary-700 line-clamp-2">
                        {dup.content || '(空内容)'}
                      </p>
                      <p className="text-xs text-primary-500 mt-1">
                        {dup.source_type} · {dup.reported_at?.slice(0, 16)}
                      </p>
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <ManualNotes
            targetType="feedback"
            targetId={feedback.id}
            notes={feedback.notes}
            onNoteAdded={handleNoteAdded}
          />
        </div>
      </div>
    </div>
  )
}
