import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, FileText, FileBarChart, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'
import type { Location, Feedback, Scheme, Report, ManualNote } from '../types'
import { ManualNotes } from '../components/ManualNotes'

export default function LocationDetail() {
  const { id } = useParams<{ id: string }>()
  const [location, setLocation] = useState<
    Location & {
      feedback: Feedback[]
      schemes: Scheme[]
      reports: Report[]
      notes: ManualNote[]
    } | null
  >(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadLocation(id)
  }, [id])

  const loadLocation = async (locationId: string) => {
    setLoading(true)
    try {
      const data = await api.getLocation(locationId)
      setLocation(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleNoteAdded = (note: ManualNote) => {
    if (location) {
      setLocation({
        ...location,
        notes: [note, ...location.notes],
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

  if (!location) {
    return <div className="p-6">点位不存在</div>
  }

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/locations" className="text-primary-500 hover:text-primary-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-primary-800 font-serif">
            {location.canonical_name}
          </h2>
          <p className="text-primary-500 text-sm mt-1">
            坐标：{location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </p>
        </div>
        {location.has_coordinate_drift && (
          <div className="flex items-center gap-1 badge-drift">
            <AlertTriangle size={12} />
            坐标偏移
          </div>
        )}
      </div>

      {location.aliases.length > 0 && (
        <div className="card p-4 mb-6">
          <h4 className="text-sm font-medium text-primary-700 mb-2">别名（原始写法）</h4>
          <div className="flex flex-wrap gap-2">
            {location.aliases.map((alias, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
              >
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {location.has_coordinate_drift && location.drift_note && (
        <div className="card p-4 mb-6 border-orange-200 bg-orange-50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-orange-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-orange-800">坐标偏移说明</h4>
              <p className="text-sm text-orange-700 mt-1">{location.drift_note}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primary-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-accent-500" />
                关联反馈 ({location.feedback.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
              {location.feedback.map((fb) => (
                <Link
                  key={fb.id}
                  to={`/feedback/${fb.id}`}
                  className="block p-3 rounded-lg border border-primary-100 hover:border-accent-300 transition-all"
                >
                  <p className="text-sm text-primary-700 line-clamp-2">
                    {fb.content || '(空内容)'}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-primary-500">{fb.source_type}</span>
                    <div className="flex gap-1">
                      {fb.is_duplicate && <span className="badge-duplicate">重复</span>}
                      {fb.is_boundary && <span className="badge-boundary">边界</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <ManualNotes
            targetType="location"
            targetId={location.id}
            notes={location.notes}
            onNoteAdded={handleNoteAdded}
          />
        </div>

        <div className="space-y-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primary-800 flex items-center gap-2">
                <FileText size={18} className="text-primary-500" />
                调解方案 ({location.schemes.length})
              </h3>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
              {location.schemes.map((scheme) => (
                <Link
                  key={scheme.id}
                  to={`/schemes/${scheme.id}`}
                  className="block p-4 rounded-lg border border-primary-100 hover:border-primary-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary-800">{scheme.title}</p>
                      <p className="text-sm text-primary-500 mt-1">
                        v{scheme.version} · {scheme.created_at.slice(0, 10)} · {scheme.created_by}
                      </p>
                    </div>
                    <span
                      className={
                        scheme.status === '已发布'
                          ? 'badge-published'
                          : scheme.status === '被覆盖'
                          ? 'badge-superseded'
                          : 'badge-draft'
                      }
                    >
                      {scheme.status}
                    </span>
                  </div>
                  {scheme.historical_opinion && scheme.status === '被覆盖' && (
                    <div className="mt-3 pt-3 border-t border-primary-100">
                      <p className="text-xs text-primary-500">历史意见：</p>
                      <p className="text-sm text-primary-600 mt-1 italic">
                        {scheme.historical_opinion}
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primary-800 flex items-center gap-2">
                <FileBarChart size={18} className="text-green-500" />
                调解报告 ({location.reports.length})
              </h3>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
              {location.reports.map((report) => (
                <Link
                  key={report.id}
                  to={`/reports/${report.id}`}
                  className="block p-4 rounded-lg border border-green-100 hover:border-green-300 hover:bg-green-50 transition-all"
                >
                  <p className="font-medium text-primary-800 line-clamp-2">{report.title}</p>
                  <p className="text-sm text-primary-500 mt-2">
                    {report.generated_at.slice(0, 16)} · {report.generated_by}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {report.source_trace.slice(0, 3).map((st, i) => (
                      <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        {st.type}
                      </span>
                    ))}
                    {report.source_trace.length > 3 && (
                      <span className="text-xs text-green-600">+{report.source_trace.length - 3}</span>
                    )}
                  </div>
                </Link>
              ))}
              {location.reports.length === 0 && (
                <p className="text-center text-primary-400 py-8 text-sm">
                  暂无报告，可在方案详情页生成
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
