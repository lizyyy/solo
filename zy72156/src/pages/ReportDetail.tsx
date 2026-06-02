import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileBarChart, Calendar, User, Link2 } from 'lucide-react'
import { api } from '../services/api'
import type { Report, Location, Scheme, ManualNote } from '../types'
import { ManualNotes } from '../components/ManualNotes'

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const [report, setReport] = useState<
    Report & {
      location: Location
      scheme: Scheme
      notes: ManualNote[]
    } | null
  >(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadReport(id)
  }, [id])

  const loadReport = async (reportId: string) => {
    setLoading(true)
    try {
      const data = await api.getReport(reportId)
      setReport(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleNoteAdded = (note: ManualNote) => {
    if (report) {
      setReport({
        ...report,
        notes: [note, ...report.notes],
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

  if (!report) {
    return <div className="p-6">报告不存在</div>
  }

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/reports" className="text-primary-500 hover:text-primary-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-primary-800 font-serif">{report.title}</h2>
          <div className="flex items-center gap-4 mt-1 text-sm text-primary-500">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {report.generated_at}
            </span>
            <span className="flex items-center gap-1">
              <User size={14} />
              {report.generated_by}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="card p-8 bg-white shadow-card">
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 pb-6 border-b border-primary-200">
                <div className="flex items-center gap-2 text-sm text-primary-500 mb-2">
                  <FileBarChart size={16} />
                  公园活动噪声调解报告
                </div>
                <h1 className="text-2xl font-bold text-primary-900 font-serif">
                  {report.title}
                </h1>
              </div>

              <div className="mb-6">
                <div className="text-sm text-primary-500 mb-2">关联点位</div>
                <Link
                  to={`/locations/${report.location.id}`}
                  className="text-accent-600 hover:text-accent-700 font-medium"
                >
                  {report.location.canonical_name}
                </Link>
              </div>

              <div className="mb-6">
                <div className="text-sm text-primary-500 mb-2">基于方案</div>
                <Link
                  to={`/schemes/${report.scheme.id}`}
                  className="text-accent-600 hover:text-accent-700 font-medium"
                >
                  {report.scheme.title} (v{report.scheme.version})
                </Link>
              </div>

              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-primary-800 leading-relaxed text-base">
                  {report.content}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-primary-200">
                <h3 className="font-semibold text-primary-800 mb-4 flex items-center gap-2">
                  <Link2 size={16} />
                  来源追溯
                </h3>
                <div className="space-y-2">
                  {report.source_trace.map((st, i) => (
                    <Link
                      key={i}
                      to={`/feedback/${st.ref}`}
                      className="block p-3 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-sm text-primary-600">
                            {st.ref}
                          </span>
                          <span className="ml-3 text-sm text-primary-700">{st.type}</span>
                        </div>
                        <span className="text-xs text-primary-500">{st.time}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {Object.keys(report.cross_period_stats).length > 0 && (
                <div className="mt-8 pt-6 border-t border-primary-200">
                  <h3 className="font-semibold text-primary-800 mb-4">跨时段统计</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(report.cross_period_stats).map(([period, count]) => (
                      <div key={period} className="p-4 bg-accent-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-accent-600">{count}</div>
                        <div className="text-sm text-accent-700">{period}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-primary-200 text-right">
                <p className="text-sm text-primary-500">
                  报告生成：{report.generated_at}
                </p>
                <p className="text-sm text-primary-500 mt-1">
                  生成人：{report.generated_by}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <ManualNotes
            targetType="report"
            targetId={report.id}
            notes={report.notes}
            onNoteAdded={handleNoteAdded}
          />
        </div>
      </div>
    </div>
  )
}
