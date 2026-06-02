import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  MessageSquare,
  FileText,
  FileBarChart,
  AlertTriangle,
  Copy,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store'
import { MapView } from '../components/MapView'
import type { Feedback, Scheme, Report } from '../types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { stats, locations, setStats, setLocations, setFeedback, setSchemes, setReports } =
    useStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [statsData, locs, fb, schemes, reports] = await Promise.all([
          api.getStats(),
          api.getLocations(),
          api.getFeedback(),
          api.getSchemes(),
          api.getReports(),
        ])
        setStats(statsData)
        setLocations(locs)
        setFeedback(fb)
        setSchemes(schemes)
        setReports(reports)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [setStats, setLocations, setFeedback, setSchemes, setReports])

  const statCards = stats
    ? [
        {
          label: '点位数量',
          value: stats.locations,
          icon: MapPin,
          color: 'text-primary-600',
          bg: 'bg-primary-50',
        },
        {
          label: '反馈总数',
          value: stats.feedback,
          icon: MessageSquare,
          color: 'text-accent-600',
          bg: 'bg-accent-50',
        },
        {
          label: '方案数量',
          value: stats.pending_schemes + stats.reports,
          icon: FileText,
          color: 'text-green-600',
          bg: 'bg-green-50',
        },
        {
          label: '报告数量',
          value: stats.reports,
          icon: FileBarChart,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 h-screen overflow-y-auto scrollbar-thin">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 font-serif">
          公园活动噪声调解追踪
        </h2>
        <p className="text-primary-500 mt-1">
          点位归一化、方案迭代、全链路可追溯
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="card p-4 card-hover cursor-pointer"
            onClick={() => {
              if (card.icon === MapPin) navigate('/locations')
              if (card.icon === MessageSquare) navigate('/feedback')
              if (card.icon === FileText) navigate('/schemes')
              if (card.icon === FileBarChart) navigate('/reports')
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-primary-500">{card.label}</p>
                <p className="text-3xl font-bold text-primary-800 mt-1">
                  {card.value}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon size={20} className={card.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats && (stats.duplicates > 0 || stats.boundary > 0 || stats.coordinate_drift > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {stats.duplicates > 0 && (
            <div className="card p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-3">
                <Copy size={18} className="text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-700">重复投诉</p>
                  <p className="text-lg font-bold text-yellow-800">
                    {stats.duplicates} 条
                  </p>
                </div>
              </div>
            </div>
          )}
          {stats.boundary > 0 && (
            <div className="card p-4 border-orange-200 bg-orange-50">
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className="text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-orange-700">边界记录</p>
                  <p className="text-lg font-bold text-orange-800">
                    {stats.boundary} 条
                  </p>
                </div>
              </div>
            </div>
          )}
          {stats.coordinate_drift > 0 && (
            <div className="card p-4 border-purple-200 bg-purple-50">
              <div className="flex items-center gap-3">
                <TrendingUp size={18} className="text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-purple-700">坐标偏移</p>
                  <p className="text-lg font-bold text-purple-800">
                    {stats.coordinate_drift} 个
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-primary-800">点位分布地图</h3>
            <button
              onClick={() => navigate('/locations')}
              className="text-sm text-accent-600 hover:text-accent-700 flex items-center gap-1"
            >
              查看全部
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="h-[400px]">
            <MapView
              locations={locations}
              onLocationClick={(id) => navigate(`/locations/${id}`)}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primary-800">最新反馈</h3>
              <button
                onClick={() => navigate('/feedback')}
                className="text-xs text-accent-600 hover:text-accent-700"
              >
                全部
              </button>
            </div>
            <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
              {stats?.recent.feedback.slice(0, 4).map((fb) => (
                <div
                  key={fb.id}
                  onClick={() => navigate(`/feedback/${fb.id}`)}
                  className="p-2 hover:bg-primary-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-800 truncate">
                        {fb.location_name}
                      </p>
                      <p className="text-xs text-primary-500 truncate">
                        {fb.content || '(空内容)'}
                      </p>
                    </div>
                    {fb.is_duplicate && (
                      <span className="badge-duplicate">重复</span>
                    )}
                    {fb.is_boundary && (
                      <span className="badge-boundary">边界</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-primary-800">最近方案</h3>
              <button
                onClick={() => navigate('/schemes')}
                className="text-xs text-accent-600 hover:text-accent-700"
              >
                全部
              </button>
            </div>
            <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
              {stats?.recent.schemes.slice(0, 3).map((scheme) => (
                <div
                  key={scheme.id}
                  onClick={() => navigate(`/schemes/${scheme.id}`)}
                  className="p-2 hover:bg-primary-50 rounded-lg cursor-pointer transition-colors"
                >
                  <p className="text-sm font-medium text-primary-800 truncate">
                    {scheme.title}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-primary-500">
                      v{scheme.version}
                    </span>
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
                </div>
              ))}
              {stats?.recent.schemes.length === 0 && (
                <p className="text-sm text-primary-400 text-center py-4">
                  暂无方案
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
