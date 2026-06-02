import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight, FileBarChart, Calendar, User } from 'lucide-react'
import { api } from '../services/api'
import type { Report } from '../types'

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      const data = await api.getReports()
      setReports(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = reports.filter(
    (r) => !search || r.title.includes(search) || r.content.includes(search)
  )

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 font-serif">调解报告</h2>
        <p className="text-primary-500 mt-1">同事写给同事看的调解报告，全程可追溯</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索报告..."
            className="input pl-10"
          />
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <FileBarChart size={48} className="mx-auto text-primary-300 mb-4" />
            <p className="text-primary-500">暂无报告</p>
            <p className="text-sm text-primary-400 mt-2">
              在方案详情页点击"生成报告"即可创建
            </p>
          </div>
        ) : (
          filtered.map((report) => (
            <Link
              key={report.id}
              to={`/reports/${report.id}`}
              className="card p-5 card-hover block"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-primary-800 text-lg">
                    {report.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-primary-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {report.generated_at.slice(0, 16)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={14} />
                      {report.generated_by}
                    </span>
                  </div>
                  <p className="text-sm text-primary-600 mt-3 line-clamp-2">
                    {report.content}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {report.source_trace.slice(0, 5).map((st, i) => (
                      <span
                        key={i}
                        className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded"
                      >
                        {st.type}
                      </span>
                    ))}
                    {report.source_trace.length > 5 && (
                      <span className="text-xs text-green-600">
                        +{report.source_trace.length - 5} 来源
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight size={20} className="text-primary-300 ml-4 mt-1" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
