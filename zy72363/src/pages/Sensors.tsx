import { useState, useEffect, useCallback } from 'react'
import {
  Cpu,
  Upload,
  Search,
  Filter,
  Download,
  Edit3,
  Image,
  X,
  ChevronRight,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import Badge from '@/components/Badge'
import { getSensors, getPhotos, getBatches } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import type { SensorData, PhotoMeta, Batch } from '@/types'

export default function Sensors() {
  const location = useLocation()
  const state = location.state as {
    expandSensorId?: string
    expandSensorCode?: string
    showPhotos?: boolean
  } | null
  const { fetchStats } = useAppStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedBatch, setSelectedBatch] = useState('')
  const [sensors, setSensors] = useState<SensorData[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState<SensorData | null>(null)
  const [sensorPhotos, setSensorPhotos] = useState<PhotoMeta[]>([])
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'info' | 'photos'>('info')

  const loadSensors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getSensors({
        page,
        pageSize,
        batchId: selectedBatch || undefined,
        search: searchTerm || undefined,
      })
      setSensors(response.data)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取传感器数据失败')
    } finally {
      setLoading(false)
    }
  }, [page, selectedBatch, searchTerm])

  const loadBatches = async () => {
    setBatchesLoading(true)
    try {
      const response = await getBatches({ page: 1, pageSize: 100 })
      setBatches(response.data)
    } catch (err) {
      console.error('加载批次失败:', err)
    } finally {
      setBatchesLoading(false)
    }
  }

  useEffect(() => {
    loadSensors()
    loadBatches()
  }, [loadSensors])

  useEffect(() => {
    if (state?.expandSensorId) {
      const sensor = sensors.find((s) => s.id === state.expandSensorId)
      if (sensor) {
        handleSensorSelect(sensor, state.showPhotos)
      } else {
        loadAndOpenSensor(state.expandSensorId, state.showPhotos)
      }
    }
  }, [state?.expandSensorId, sensors])

  const loadAndOpenSensor = async (sensorId: string, showPhotos?: boolean) => {
    setSidebarLoading(true)
    try {
      const [sensorsResponse, photosResponse] = await Promise.all([
        getSensors({ pageSize: 100 }),
        getPhotos(sensorId),
      ])
      const sensor = sensorsResponse.data.find((s) => s.id === sensorId)
      if (sensor) {
        setSelectedSensor(sensor)
        setSensorPhotos(photosResponse)
        setSidebarOpen(true)
        if (showPhotos) {
          setSidebarTab('photos')
        }
      }
    } catch (err) {
      console.error('加载传感器详情失败:', err)
    } finally {
      setSidebarLoading(false)
    }
  }

  const handleSensorSelect = async (sensor: SensorData, showPhotos?: boolean) => {
    setSelectedSensor(sensor)
    setSidebarOpen(true)
    if (showPhotos) {
      setSidebarTab('photos')
    }

    setSidebarLoading(true)
    try {
      const photos = await getPhotos(sensor.id)
      setSensorPhotos(photos)
    } catch (err) {
      console.error('加载照片失败:', err)
    } finally {
      setSidebarLoading(false)
    }
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
    setSelectedSensor(null)
    setSensorPhotos([])
    window.history.replaceState({}, document.title)
  }

  const totalPages = Math.ceil(total / pageSize)

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }

  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId)
    setPage(1)
  }

  return (
    <div className={clsx('flex gap-6', sidebarOpen ? 'mr-[400px]' : '')}>
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">传感器管理</h1>
            <p className="mt-1 text-sm text-muted">管理和查看所有传感器数据</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="h-4 w-4" />
              导出
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors">
              <Upload className="h-4 w-4" />
              导入数据
            </button>
          </div>
        </div>

        {state?.expandSensorCode && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-primary">
                正在查看传感器 {state.expandSensorCode} 的详情
              </p>
              <p className="text-sm text-primary/80 mt-1">
                从参数复核页面跳转而来，右侧边栏显示了该传感器的详细信息
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="搜索传感器编号、物料类型..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <select
              value={selectedBatch}
              onChange={(e) => handleBatchChange(e.target.value)}
              disabled={batchesLoading}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">所有批次</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.filename}
                </option>
              ))}
            </select>
            <button
              onClick={loadSensors}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-4 w-4" />
              筛选
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted">加载数据中...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-8 w-8 text-danger" />
                <p className="text-sm text-danger">{error}</p>
                <button
                  onClick={loadSensors}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        传感器编号
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        物料类型
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        转速范围 (RPM)
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        安全系数
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        来源
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        照片
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sensors.map((sensor) => (
                      <tr
                        key={sensor.id}
                        className={clsx(
                          'hover:bg-gray-50 transition-colors cursor-pointer',
                          selectedSensor?.id === sensor.id ? 'bg-primary/5' : ''
                        )}
                        onClick={() => handleSensorSelect(sensor)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {sensor.sensor_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {sensor.material_type}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-gray-700">
                            {sensor.rpm_min} - {sensor.rpm_max}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {sensor.coefficient.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            type="source"
                            source={sensor.coefficient_manual ? 'manual' : 'auto'}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 text-muted">
                            <Image className="h-4 w-4" />
                            <span className="text-sm">{sensor.photos?.length || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSensorSelect(sensor, true)
                              }}
                              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Image className="h-4 w-4" />
                            </button>
                            <ChevronRight className="h-4 w-4 text-muted" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {sensors.length === 0 && (
                <div className="py-12 text-center">
                  <Cpu className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted">暂无传感器数据</p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-muted">
                    共 {total} 条记录，当前第 {page} / {totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm text-gray-600 px-2">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {sidebarOpen && selectedSensor && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={closeSidebar} />
          <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedSensor.sensor_code}
                </h3>
                <p className="text-sm text-muted mt-0.5">传感器详情</p>
              </div>
              <button
                onClick={closeSidebar}
                className="p-1.5 rounded-lg text-muted hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setSidebarTab('info')}
                className={clsx(
                  'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                  sidebarTab === 'info'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                基本信息
              </button>
              <button
                onClick={() => setSidebarTab('photos')}
                className={clsx(
                  'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                  sidebarTab === 'photos'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                工况照片 ({sensorPhotos.length})
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {sidebarLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}

              {!sidebarLoading && sidebarTab === 'info' && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">物料类型</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedSensor.material_type}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">批次 ID</span>
                      <span className="text-sm font-mono text-gray-900">
                        {selectedSensor.batch_id}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">转速范围</span>
                      <span className="text-sm font-mono text-gray-900">
                        {selectedSensor.rpm_min} - {selectedSensor.rpm_max} RPM
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">安全系数</span>
                      <span className="text-sm font-mono font-semibold text-gray-900">
                        {selectedSensor.coefficient.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">系数来源</span>
                      <Badge
                        type="source"
                        source={selectedSensor.coefficient_manual ? 'manual' : 'auto'}
                      />
                    </div>
                    {selectedSensor.coefficient_reason && (
                      <div>
                        <span className="text-sm text-muted">修改原因</span>
                        <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {selectedSensor.coefficient_reason}
                        </p>
                      </div>
                    )}
                    {selectedSensor.remark && (
                      <div>
                        <span className="text-sm text-muted">备注</span>
                        <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {selectedSensor.remark}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <p className="text-xs text-muted">时间信息</p>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">创建时间</span>
                      <span className="text-sm text-gray-700">
                        {new Date(selectedSensor.created_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted">更新时间</span>
                      <span className="text-sm text-gray-700">
                        {new Date(selectedSensor.updated_at).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!sidebarLoading && sidebarTab === 'photos' && (
                <div>
                  {sensorPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {sensorPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer"
                        >
                          <img
                            src={photo.url}
                            alt={photo.remark || photo.filename}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Image className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {photo.remark && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-xs text-white truncate">
                                {photo.remark}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <Image className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-muted">暂无工况照片</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}