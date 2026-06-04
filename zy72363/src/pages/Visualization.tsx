import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Box,
  Layers,
  Filter,
  Download,
  Loader2,
} from 'lucide-react'
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart as RechartsLineChart,
  Line,
} from 'recharts'
import { getSensors, getSafetyZones } from '@/lib/api'
import type { SensorData, SafetyZone } from '@/types'
import SafetyZone3D from '@/components/SafetyZone3D'
import TracePanel from '@/components/TracePanel'

const MATERIAL_COLORS = [
  '#FF6B35',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EC4899',
  '#64748B',
  '#14B8A6',
]

const RPM_RANGES = [
  { label: '1000-2000', min: 1000, max: 2000 },
  { label: '2000-3000', min: 2000, max: 3000 },
  { label: '3000-4000', min: 3000, max: 4000 },
  { label: '4000-5000', min: 4000, max: 5000 },
  { label: '5000-6000', min: 5000, max: 6000 },
  { label: '6000+', min: 6000, max: Infinity },
]

const COEFFICIENT_BINS = [
  { label: '0.8-1.0', min: 0.8, max: 1.0 },
  { label: '1.0-1.2', min: 1.0, max: 1.2 },
  { label: '1.2-1.4', min: 1.2, max: 1.4 },
  { label: '1.4-1.6', min: 1.4, max: 1.6 },
  { label: '1.6-1.8', min: 1.6, max: 1.8 },
  { label: '1.8+', min: 1.8, max: Infinity },
]

export default function Visualization() {
  const [activeTab, setActiveTab] = useState<'overview' | '3d' | 'trend'>('overview')
  const [sensors, setSensors] = useState<SensorData[]>([])
  const [safetyZones, setSafetyZones] = useState<(SafetyZone & { sensor?: SensorData })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const [traceZone, setTraceZone] = useState<SafetyZone | null>(null)
  const [traceSensor, setTraceSensor] = useState<SensorData | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [sensorsRes, zonesRes] = await Promise.all([
          getSensors({ pageSize: 1000 }),
          getSafetyZones({ pageSize: 1000 }),
        ])

        setSensors(sensorsRes.data)

        const sensorMap = new Map(sensorsRes.data.map((s) => [s.id, s]))
        const zonesWithSensors = zonesRes.data.map((zone) => ({
          ...zone,
          sensor: sensorMap.get(zone.sensor_id),
        }))
        setSafetyZones(zonesWithSensors)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const materialDistribution = useMemo(() => {
    const countMap = new Map<string, number>()
    safetyZones.forEach((zone) => {
      const material = zone.sensor?.material_type || '未知'
      countMap.set(material, (countMap.get(material) || 0) + 1)
    })
    return Array.from(countMap.entries()).map(([name, count], i) => ({
      name,
      value: count,
      color: MATERIAL_COLORS[i % MATERIAL_COLORS.length],
    }))
  }, [safetyZones])

  const rpmDistribution = useMemo(() => {
    const filtered = selectedMaterial
      ? safetyZones.filter((z) => z.sensor?.material_type === selectedMaterial)
      : safetyZones

    return RPM_RANGES.map((range) => {
      const count = filtered.filter(
        (z) => z.rpm_min >= range.min && z.rpm_max <= range.max
      ).length
      const intensity = Math.min(count / 50, 1)
      return {
        range: range.label,
        count,
        fill: `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`,
      }
    })
  }, [safetyZones, selectedMaterial])

  const coefficientDistribution = useMemo(() => {
    const filtered = selectedMaterial
      ? safetyZones.filter((z) => z.sensor?.material_type === selectedMaterial)
      : safetyZones

    const materials = Array.from(new Set(filtered.map((z) => z.sensor?.material_type || '未知')))

    return COEFFICIENT_BINS.map((bin) => {
      const row: Record<string, string | number> = { coefficient: bin.label }
      materials.forEach((material) => {
        const count = filtered.filter(
          (z) =>
            z.sensor?.material_type === material &&
            z.coefficient >= bin.min &&
            z.coefficient < bin.max
        ).length
        row[material] = count
      })
      return row
    })
  }, [safetyZones, selectedMaterial])

  const trendData = useMemo(() => {
    const grouped = new Map<string, { rpmMin: number[]; rpmMax: number[]; manualCount: number; approved: number; pending: number; rollback: number }>()

    safetyZones.forEach((zone) => {
      const month = zone.created_at.slice(0, 7)
      const existing = grouped.get(month) || {
        rpmMin: [],
        rpmMax: [],
        manualCount: 0,
        approved: 0,
        pending: 0,
        rollback: 0,
      }

      existing.rpmMin.push(zone.rpm_min)
      existing.rpmMax.push(zone.rpm_max)
      if (zone.coefficient_source === 'manual') {
        existing.manualCount++
      }
      existing[zone.review_status]++

      grouped.set(month, existing)
    })

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avgRpmMin: Math.round(data.rpmMin.reduce((a, b) => a + b, 0) / data.rpmMin.length),
        avgRpmMax: Math.round(data.rpmMax.reduce((a, b) => a + b, 0) / data.rpmMax.length),
        manualChanges: data.manualCount,
        approved: data.approved,
        pending: data.pending,
        rollback: data.rollback,
      }))
  }, [safetyZones])

  const handlePieClick = (data: { name: string }) => {
    setSelectedMaterial(selectedMaterial === data.name ? null : data.name)
  }

  const handleChartClick = (data: any) => {
    if (!data || !data.activePayload) return

    const payload = data.activePayload[0]?.payload
    if (!payload) return

    let matchedZone: SafetyZone | undefined
    let matchedSensor: SensorData | undefined

    if (payload.range) {
      const range = RPM_RANGES.find((r) => r.label === payload.range)
      if (range) {
        matchedZone = safetyZones.find(
          (z) =>
            z.rpm_min >= range.min &&
            z.rpm_max <= range.max &&
            (!selectedMaterial || z.sensor?.material_type === selectedMaterial)
        )
        matchedSensor = matchedZone?.sensor
      }
    } else if (payload.coefficient) {
      const bin = COEFFICIENT_BINS.find((b) => b.label === payload.coefficient)
      if (bin) {
        matchedZone = safetyZones.find(
          (z) =>
            z.coefficient >= bin.min &&
            z.coefficient < bin.max &&
            (!selectedMaterial || z.sensor?.material_type === selectedMaterial)
        )
        matchedSensor = matchedZone?.sensor
      }
    }

    if (matchedZone && matchedSensor) {
      setTraceZone(matchedZone)
      setTraceSensor(matchedSensor)
    }
  }

  const materialColorsForArea = useMemo(() => {
    const materials = Array.from(new Set(safetyZones.map((z) => z.sensor?.material_type || '未知')))
    return materials.reduce((acc, material, i) => {
      acc[material] = MATERIAL_COLORS[i % MATERIAL_COLORS.length]
      return acc
    }, {} as Record<string, string>)
  }, [safetyZones])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 shadow-xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-mono font-semibold text-gray-900">{entry.value}</span>
            </div>
          ))}
          <p className="text-xs text-muted mt-2 pt-2 border-t border-gray-100">
            数据来源：API /api/safety-zones
          </p>
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-gray-500">加载数据中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">可视化分析</h1>
          <p className="mt-1 text-sm text-muted">多维度数据分析和安全区可视化展示</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedMaterial && (
            <button
              onClick={() => setSelectedMaterial(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <span className="text-sm">已筛选: {selectedMaterial}</span>
              <span className="text-lg leading-none">×</span>
            </button>
          )}
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4" />
            筛选条件
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
            <Download className="h-4 w-4" />
            导出图表
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex gap-1 px-4">
            {[
              { key: 'overview', label: '数据概览', icon: PieChart },
              { key: '3d', label: '3D 安全区', icon: Box },
              { key: 'trend', label: '趋势分析', icon: LineChart },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">物料类型分布</h3>
                  <p className="text-sm text-muted mb-4">点击扇区可筛选下方图表</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={materialDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          onClick={handlePieClick}
                          cursor="pointer"
                        >
                          {materialDistribution.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              stroke={selectedMaterial === entry.name ? '#1e40af' : 'white'}
                              strokeWidth={selectedMaterial === entry.name ? 3 : 2}
                              opacity={selectedMaterial && selectedMaterial !== entry.name ? 0.5 : 1}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          formatter={(value) => (
                            <span className="text-sm text-gray-700">{value}</span>
                          )}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">转速区间分布</h3>
                  <p className="text-sm text-muted mb-4">颜色深浅表示数量多少，点击柱子查看详情</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rpmDistribution}
                        onClick={handleChartClick}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" cursor="pointer" name="数量">
                          {rpmDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">安全系数分布</h3>
                <p className="text-sm text-muted mb-4">多条曲线表示不同物料类型，点击数据点查看详情</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={coefficientDistribution}
                      onClick={handleChartClick}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="coefficient" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(value) => <span className="text-sm text-gray-700">{value}</span>} />
                      {Object.keys(materialColorsForArea).map((material) => (
                        <Area
                          key={material}
                          type="monotone"
                          dataKey={material}
                          stroke={materialColorsForArea[material]}
                          fill={materialColorsForArea[material]}
                          fillOpacity={0.3}
                          strokeWidth={2}
                          name={material}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === '3d' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-gray-900">3D 安全区模型</h3>
                <span className="text-sm text-muted ml-2">
                  {safetyZones.length} 个安全区 | 悬浮查看信息 | 点击查看详情 | 双击跳转复核
                </span>
              </div>
              <SafetyZone3D safetyZones={safetyZones} loading={loading} />
            </div>
          )}

          {activeTab === 'trend' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <LineChart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">转速范围变化趋势</h3>
                </div>
                <p className="text-sm text-muted mb-4">按时间展示平均 rpm_min 和 rpm_max 的变化趋势</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(value) => <span className="text-sm text-gray-700">{value}</span>} />
                      <Line
                        type="monotone"
                        dataKey="avgRpmMin"
                        stroke="#3B82F6"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="平均最小转速"
                      />
                      <Line
                        type="monotone"
                        dataKey="avgRpmMax"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        name="平均最大转速"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">系数变更频率</h3>
                </div>
                <p className="text-sm text-muted mb-4">按月份统计人工修改系数的次数</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="manualChanges"
                        stroke="#F59E0B"
                        fill="#F59E0B"
                        fillOpacity={0.3}
                        strokeWidth={2}
                        name="人工修改次数"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">复核通过率</h3>
                </div>
                <p className="text-sm text-muted mb-4">展示各状态数量的历史变化</p>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend formatter={(value) => <span className="text-sm text-gray-700">{value}</span>} />
                      <Area
                        type="monotone"
                        dataKey="approved"
                        stackId="1"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.6}
                        name="已通过"
                      />
                      <Area
                        type="monotone"
                        dataKey="pending"
                        stackId="1"
                        stroke="#F59E0B"
                        fill="#F59E0B"
                        fillOpacity={0.6}
                        name="待复核"
                      />
                      <Area
                        type="monotone"
                        dataKey="rollback"
                        stackId="1"
                        stroke="#64748B"
                        fill="#64748B"
                        fillOpacity={0.6}
                        name="已回滚"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <TracePanel
        safetyZone={traceZone}
        sensor={traceSensor}
        onClose={() => {
          setTraceZone(null)
          setTraceSensor(null)
        }}
      />
    </div>
  )
}
