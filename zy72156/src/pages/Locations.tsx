import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ArrowRight, MapPin, AlertTriangle } from 'lucide-react'
import { api } from '../services/api'
import type { Location } from '../types'
import { MapView } from '../components/MapView'

export default function Locations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [search, setSearch] = useState('')
  const [filterDrift, setFilterDrift] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLocations()
  }, [search, filterDrift])

  const loadLocations = async () => {
    setLoading(true)
    try {
      const data = await api.getLocations({
        search: search || undefined,
        has_drift: filterDrift ?? undefined,
      })
      setLocations(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary-800 font-serif">点位管理</h2>
          <p className="text-primary-500 mt-1">点位归一化、别名合并、坐标偏移标注</p>
        </div>
        <button className="btn-accent flex items-center gap-2">
          <Plus size={18} />
          新增点位
        </button>
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
            placeholder="搜索点位名称或别名..."
            className="input pl-10"
          />
        </div>
        <select
          value={filterDrift === null ? '' : String(filterDrift)}
          onChange={(e) =>
            setFilterDrift(e.target.value === '' ? null : e.target.value === 'true')
          }
          className="input w-40"
        >
          <option value="">全部点位</option>
          <option value="true">仅含坐标偏移</option>
          <option value="false">无坐标偏移</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card p-4">
          <h3 className="font-semibold text-primary-800 mb-4">点位分布</h3>
          <div className="h-[400px]">
            <MapView
              locations={locations}
              onLocationClick={(id) => window.location.href = `/locations/${id}`}
            />
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-primary-800 mb-4">
            点位列表 ({locations.length})
          </h3>
          <div className="space-y-3 max-h-[380px] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full" />
              </div>
            ) : locations.length === 0 ? (
              <p className="text-center text-primary-400 py-8">暂无点位</p>
            ) : (
              locations.map((loc) => (
                <Link
                  key={loc.id}
                  to={`/locations/${loc.id}`}
                  className="block p-3 rounded-lg border border-primary-100 hover:border-accent-300 hover:bg-accent-50 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary-800 truncate">
                        {loc.canonical_name}
                      </p>
                      {loc.aliases.length > 0 && (
                        <p className="text-xs text-primary-500 truncate mt-1">
                          别名：{loc.aliases.slice(0, 2).join('、')}
                          {loc.aliases.length > 2 && ` +${loc.aliases.length - 2}`}
                        </p>
                      )}
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-primary-300 group-hover:text-accent-500 transition-colors mt-1"
                    />
                  </div>
                  {loc.has_coordinate_drift && (
                    <div className="flex items-center gap-1 mt-2">
                      <AlertTriangle size={12} className="text-orange-500" />
                      <span className="text-xs text-orange-600">坐标偏移</span>
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
