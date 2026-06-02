import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { api } from '../services/api'
import type { Scheme } from '../types'

export default function Schemes() {
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSchemes()
  }, [filterStatus])

  const loadSchemes = async () => {
    setLoading(true)
    try {
      const data = await api.getSchemes({
        status: filterStatus as any,
      })
      setSchemes(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = schemes.filter(
    (s) => !search || s.title.includes(search) || s.content.includes(search)
  )

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 font-serif">方案版本</h2>
        <p className="text-primary-500 mt-1">调解方案迭代历史，历史意见永久保留</p>
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
            placeholder="搜索方案..."
            className="input pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input w-40"
        >
          <option value="">全部状态</option>
          <option value="草稿">草稿</option>
          <option value="已发布">已发布</option>
          <option value="被覆盖">被覆盖</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 card p-8 text-center">
            <p className="text-primary-400">暂无方案</p>
          </div>
        ) : (
          filtered.map((scheme) => (
            <Link
              key={scheme.id}
              to={`/schemes/${scheme.id}`}
              className={`card p-5 card-hover ${
                scheme.status === '被覆盖' ? 'opacity-70' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-primary-800">{scheme.title}</h3>
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
              <p className="text-sm text-primary-600 line-clamp-2 mb-3">
                {scheme.content}
              </p>
              {scheme.historical_opinion && (
                <div className="pt-3 border-t border-primary-100">
                  <p className="text-xs text-primary-500">历史意见：</p>
                  <p className="text-sm text-primary-600 italic mt-1 line-clamp-2">
                    {scheme.historical_opinion}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-end mt-3">
                <span className="text-sm text-accent-600 flex items-center gap-1">
                  查看详情
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
