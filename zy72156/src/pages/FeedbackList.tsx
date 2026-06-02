import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Copy, AlertTriangle, ArrowRight } from 'lucide-react'
import { api } from '../services/api'
import type { Feedback } from '../types'

export default function FeedbackList() {
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [search, setSearch] = useState('')
  const [filterDuplicate, setFilterDuplicate] = useState<boolean | null>(null)
  const [filterBoundary, setFilterBoundary] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFeedback()
  }, [filterDuplicate, filterBoundary])

  const loadFeedback = async () => {
    setLoading(true)
    try {
      const data = await api.getFeedback({
        is_duplicate: filterDuplicate ?? undefined,
        is_boundary: filterBoundary ?? undefined,
      })
      setFeedback(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = feedback.filter(
    (fb) =>
      !search ||
      fb.raw_location_text.includes(search) ||
      (fb.content && fb.content.includes(search)) ||
      fb.source.includes(search)
  )

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 font-serif">反馈追踪</h2>
        <p className="text-primary-500 mt-1">所有居民反馈、网格巡查、12345工单</p>
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
            placeholder="搜索反馈内容、来源、地点..."
            className="input pl-10"
          />
        </div>
        <select
          value={filterDuplicate === null ? '' : String(filterDuplicate)}
          onChange={(e) =>
            setFilterDuplicate(e.target.value === '' ? null : e.target.value === 'true')
          }
          className="input w-40"
        >
          <option value="">全部反馈</option>
          <option value="true">仅重复投诉</option>
          <option value="false">非重复</option>
        </select>
        <select
          value={filterBoundary === null ? '' : String(filterBoundary)}
          onChange={(e) =>
            setFilterBoundary(e.target.value === '' ? null : e.target.value === 'true')
          }
          className="input w-40"
        >
          <option value="">全部</option>
          <option value="true">仅边界记录</option>
          <option value="false">非边界</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-primary-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">地点</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">内容</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">来源</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">类型</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">状态</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-primary-700">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full" />
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-primary-400">
                  暂无反馈记录
                </td>
              </tr>
            ) : (
              filtered.map((fb) => (
                <tr
                  key={fb.id}
                  onClick={() => (window.location.href = `/feedback/${fb.id}`)}
                  className={`table-row-hover cursor-pointer ${
                    fb.is_boundary ? 'bg-orange-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-primary-800">
                      {fb.raw_location_text}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-primary-700 truncate">
                      {fb.content || <span className="text-primary-400 italic">（空内容）</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-primary-600 truncate max-w-[120px]">
                      {fb.source}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-primary-100 text-primary-700">
                      {fb.source_type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {fb.is_duplicate && (
                        <span className="badge-duplicate flex items-center gap-1">
                          <Copy size={10} />
                          重复
                        </span>
                      )}
                      {fb.is_boundary && (
                        <span className="badge-boundary flex items-center gap-1">
                          <AlertTriangle size={10} />
                          边界
                        </span>
                      )}
                      {!fb.is_duplicate && !fb.is_boundary && (
                        <span className="text-xs text-primary-500">正常</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-primary-500">
                    {fb.reported_at?.slice(0, 16)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
