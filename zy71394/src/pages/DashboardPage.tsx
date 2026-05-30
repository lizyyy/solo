import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText,
  CheckCircle,
  GitBranch,
  AlertTriangle,
  Star,
  TrendingUp,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts'
import { api } from '@/services/api'
import { useStore } from '@/store/app'
import type {
  StatsOverview,
  TechStackStat,
  RatingStat,
  FailureStat,
  TrendStat,
} from '../../shared/types'

import { cn } from '@/lib/utils'

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function DashboardPage() {
  const navigate = useNavigate()
  const { setFilter } = useStore()
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [techStackData, setTechStackData] = useState<TechStackStat[]>([])
  const [ratingData, setRatingData] = useState<RatingStat[]>([])
  const [failureData, setFailureData] = useState<FailureStat[]>([])
  const [trendData, setTrendData] = useState<TrendStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [ov, ts, rt, fl, tr] = await Promise.all([
        api.stats.overview(),
        api.stats.techStack(),
        api.stats.rating(),
        api.stats.failures(),
        api.stats.trend(30),
      ])
      setOverview(ov)
      setTechStackData(ts)
      setRatingData(rt)
      setFailureData(fl.slice(0, 10))
      setTrendData(tr)
    } finally {
      setLoading(false)
    }
  }

  function handleTechStackClick(name: string) {
    setFilter({ techStacks: [name], page: 1 })
    navigate('/archive')
  }

  function handleRatingClick(rating: number) {
    setFilter({ minRating: rating, maxRating: rating + 0.9, page: 1 })
    navigate('/archive')
  }

  function handleFailureClick(reason: string) {
    setFilter({ failureReasons: [reason], page: 1 })
    navigate('/archive')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-amber border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-gray-100">数据看板</h2>
        <p className="text-sm text-gray-400 mt-1">全方位监控提示词库的质量和使用情况</p>
      </div>

      {overview && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard
            icon={FileText}
            label="总提示词数"
            value={overview.totalPrompts}
            color="text-brand-amber"
            bgColor="bg-brand-amber/10"
          />
          <StatCard
            icon={CheckCircle}
            label="在用提示词"
            value={overview.activePrompts}
            color="text-status-success"
            bgColor="bg-status-success/10"
          />
          <StatCard
            icon={GitBranch}
            label="总版本数"
            value={overview.totalVersions}
            color="text-status-info"
            bgColor="bg-status-info/10"
          />
          <StatCard
            icon={AlertTriangle}
            label="待处理问题"
            value={overview.openIssues}
            color="text-status-danger"
            bgColor="bg-status-danger/10"
            onClick={() => navigate('/issues')}
          />
          <StatCard
            icon={Star}
            label="平均评分"
            value={overview.avgRating.toFixed(1)}
            color="text-brand-amber"
            bgColor="bg-brand-amber/10"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">技术栈分布</h3>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={techStackData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                onClick={(data) => handleTechStackClick(data.name)}
                style={{ cursor: 'pointer' }}
              >
                {techStackData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2b',
                  border: '1px solid #2d3244',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                }}
              />
              <Legend
                formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">评分分布</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={ratingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3244" />
              <XAxis
                dataKey="rating"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2b',
                  border: '1px solid #2d3244',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                }}
              />
              <Bar
                dataKey="count"
                fill="#f59e0b"
                onClick={(data) => handleRatingClick(data.rating)}
                style={{ cursor: 'pointer' }}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">失败原因 Top10</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={failureData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3244" />
              <XAxis
                type="number"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis
                dataKey="reason"
                type="category"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2b',
                  border: '1px solid #2d3244',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                }}
              />
              <Bar
                dataKey="count"
                fill="#f43f5e"
                onClick={(data) => handleFailureClick(data.reason)}
                style={{ cursor: 'pointer' }}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">数量趋势 (近30天)</h3>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3244" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                tickFormatter={(value) => value.slice(5)}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2b',
                  border: '1px solid #2d3244',
                  borderRadius: '8px',
                  color: '#e5e7eb',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  color: string
  bgColor: string
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'card p-5 transition-colors',
        onClick && 'cursor-pointer hover:border-brand-amber/30'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-lg', bgColor)}>
          <Icon className={cn('w-6 h-6', color)} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-semibold text-gray-100">{value}</p>
        </div>
      </div>
    </div>
  )
}
