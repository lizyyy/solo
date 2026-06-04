import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertTriangle,
  FileText,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useAppStore } from '@/store/useAppStore'
import { getHistory, getBatches, getPendingReviewZones } from '@/lib/api'
import Badge from '@/components/Badge'
import type { ChangeRecord, Batch, SafetyZone } from '@/types'

const COLORS = ['#F59E0B', '#10B981', '#6B7280']

export default function Dashboard() {
  const navigate = useNavigate()
  const { safetyZoneStats, pendingReviewCount, isLoading, fetchStats } = useAppStore()

  const [recentActivities, setRecentActivities] = useState<ChangeRecord[]>([])
  const [recentBatches, setRecentBatches] = useState<Batch[]>([])
  const [pendingReviewItems, setPendingReviewItems] = useState<Array<SafetyZone & { sensor_code: string; material_type: string }>>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [pendingLoading, setPendingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
    loadRecentActivities()
    loadRecentBatches()
    loadPendingReview()
  }, [fetchStats])

  const loadRecentActivities = async () => {
    setActivitiesLoading(true)
    try {
      const result = await getHistory({ page: 1, pageSize: 5 })
      setRecentActivities(result.data)
    } catch (err) {
      console.error('加载最近活动失败:', err)
    } finally {
      setActivitiesLoading(false)
    }
  }

  const loadRecentBatches = async () => {
    setBatchesLoading(true)
    try {
      const result = await getBatches({ page: 1, pageSize: 5 })
      setRecentBatches(result.data)
    } catch (err) {
      console.error('加载最近批次失败:', err)
    } finally {
      setBatchesLoading(false)
    }
  }

  const loadPendingReview = async () => {
    setPendingLoading(true)
    try {
      const result = await getPendingReviewZones({ page: 1, pageSize: 5 })
      setPendingReviewItems(result.data)
    } catch (err) {
      console.error('加载待复核队列失败:', err)
    } finally {
      setPendingLoading(false)
    }
  }

  const statCards = [
    {
      title: '安全区总数',
      value: safetyZoneStats?.totalZones ?? 0,
      icon: ShieldCheck,
      color: 'bg-primary',
      trend: '+12%',
    },
    {
      title: '待复核',
      value: pendingReviewCount,
      icon: Clock,
      color: 'bg-warning',
      trend: null,
    },
    {
      title: '已通过',
      value: safetyZoneStats?.approved ?? 0,
      icon: TrendingUp,
      color: 'bg-success',
      trend: '+8%',
    },
    {
      title: '已回滚',
      value: safetyZoneStats?.rollback ?? 0,
      icon: AlertTriangle,
      color: 'bg-danger',
      trend: '-5%',
    },
  ]

  const pieData = [
    { name: '待复核', value: safetyZoneStats?.pendingReview ?? 0 },
    { name: '已通过', value: safetyZoneStats?.approved ?? 0 },
    { name: '已回滚', value: safetyZoneStats?.rollback ?? 0 },
  ]

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes} 分钟前`
    if (hours < 24) return `${hours} 小时前`
    return `${days} 天前`
  }

  const formatFieldName = (field: string) => {
    const fieldMap: Record<string, string> = {
      coefficient: '安全系数',
      remark: '备注',
      review_status: '复核状态',
      review_comment: '复核意见',
      rpm_min: '最小转速',
      rpm_max: '最大转速',
    }
    return fieldMap[field] || field
  }

  const handleBatchClick = (batchId: string) => {
    navigate('/sensors', { state: { batchId } })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
          <p className="mt-1 text-sm text-muted">离心机转速安全区系统总览</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
              <div className="h-10 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))
        ) : (
          statCards.map((card, index) => {
            const Icon = card.icon
            return (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 font-mono">
                      {card.value.toLocaleString()}
                    </p>
                    {card.trend && (
                      <p className={`mt-1 text-sm font-medium ${
                        card.trend.startsWith('+') ? 'text-success' : 'text-danger'
                      }`}>
                        {card.trend} 较上周
                      </p>
                    )}
                  </div>
                  <div className={`${card.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">数据分布</h2>
            <LayoutDashboard className="h-5 w-5 text-muted" />
          </div>
          <div className="h-64">
            {isLoading || !safetyZoneStats ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} 个`, '数量']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    formatter={(value) => (
                      <span className="text-sm text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">最近活动</h2>
            <Cpu className="h-5 w-5 text-muted" />
          </div>
          <div className="space-y-4">
            {activitiesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
                    <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
                  </div>
                  <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
                </div>
              ))
            ) : recentActivities.length > 0 ? (
              recentActivities.map((record) => (
                <div key={record.id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {formatFieldName(record.field)} 更新
                    </p>
                    <p className="text-xs text-muted truncate">
                      {record.operator} · {record.target_type === 'sensor' ? '传感器' : '安全区'}
                    </p>
                  </div>
                  <span className="text-xs text-muted flex-shrink-0">
                    {formatTime(record.created_at)}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted">
                <Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无活动记录</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">待复核队列</h2>
              {pendingReviewItems.length > 0 && (
                <span className="bg-warning text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingReviewItems.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/review')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              查看全部
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            {pendingLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
              ))
            ) : pendingReviewItems.length > 0 ? (
              pendingReviewItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate('/review')}
                  className="p-3 bg-warning/5 border border-warning/20 rounded-lg cursor-pointer hover:bg-warning/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-gray-900">
                      {item.sensor_code}
                    </span>
                    <Badge type="noReason" size="sm" />
                  </div>
                  <p className="text-xs text-muted">
                    {item.material_type} · 系数 {item.coefficient.toFixed(2)}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无待复核项</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">最近导入批次</h2>
            <FileText className="h-5 w-5 text-muted" />
          </div>
          <div className="space-y-3">
            {batchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-48" />
                </div>
              ))
            ) : recentBatches.length > 0 ? (
              recentBatches.map((batch) => (
                <div
                  key={batch.id}
                  onClick={() => handleBatchClick(batch.id)}
                  className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-gray-900 truncate">
                      {batch.filename}
                    </span>
                    <span className="text-xs text-muted flex-shrink-0 ml-2">
                      {formatTime(batch.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span>总数: {batch.total_in_file}</span>
                    <span className="text-green-600">导入: {batch.imported_count}</span>
                    <span className="text-yellow-600">重复: {batch.duplicate_count}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无导入批次</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
