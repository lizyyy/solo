import { useState, useEffect, useCallback, useRef } from 'react'
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
  Save,
  Plus,
  CheckCircle2,
  History,
  RefreshCw,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import Badge from '@/components/Badge'
import ImportModal from '@/components/ImportModal'
import {
  getSensors,
  getPhotos,
  getBatches,
  updateSensorRemark,
  updateSensorCoefficient,
  uploadPhoto,
} from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import type { SensorData, PhotoMeta, Batch, ImportResult } from '@/types'

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

  const [importModalOpen, setImportModalOpen] = useState(false)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState<SensorData | null>(null)
  const [sensorPhotos, setSensorPhotos] = useState<PhotoMeta[]>([])
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [sidebarTab, setSidebarTab] = useState<'info' | 'photos'>('info')

  const [isEditingRemark, setIsEditingRemark] = useState(false)
  const [editRemark, setEditRemark] = useState('')
  const [editRemarkReason, setEditRemarkReason] = useState('')
  const [remarkSaving, setRemarkSaving] = useState(false)
  const [remarkSaveSuccess, setRemarkSaveSuccess] = useState(false)

  const [isEditingCoefficient, setIsEditingCoefficient] = useState(false)
  const [editCoefficient, setEditCoefficient] = useState(1.0)
  const [editCoefficientReason, setEditCoefficientReason] = useState('')
  const [coefficientSaving, setCoefficientSaving] = useState(false)
  const [coefficientSaveSuccess, setCoefficientSaveSuccess] = useState(false)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoRemark, setPhotoRemark] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSensors(), loadBatches(), fetchStats()])
  }, [loadSensors, loadBatches, fetchStats])

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

  const resetEditStates = () => {
    setIsEditingRemark(false)
    setEditRemark('')
    setEditRemarkReason('')
    setRemarkSaveSuccess(false)
    setIsEditingCoefficient(false)
    setEditCoefficient(1.0)
    setEditCoefficientReason('')
    setCoefficientSaveSuccess(false)
    setPhotoFile(null)
    setPhotoRemark('')
  }

  const handleSensorSelect = async (sensor: SensorData, showPhotos?: boolean) => {
    resetEditStates()
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
    resetEditStates()
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

  const handleImportSuccess = async (_result: ImportResult) => {
    setImportModalOpen(false)
    await refreshAll()
  }

  const startEditRemark = () => {
    if (!selectedSensor) return
    setEditRemark(selectedSensor.remark || '')
    setEditRemarkReason('')
    setRemarkSaveSuccess(false)
    setIsEditingRemark(true)
  }

  const cancelEditRemark = () => {
    setIsEditingRemark(false)
    setEditRemark('')
    setEditRemarkReason('')
    setRemarkSaveSuccess(false)
  }

  const handleSaveRemark = async () => {
    if (!selectedSensor) return
    if (editRemarkReason.trim() === '') {
      alert('请填写修改原因')
      return
    }

    setRemarkSaving(true)
    try {
      const updated = await updateSensorRemark(
        selectedSensor.id,
        editRemark,
        editRemarkReason,
        '林老师'
      )
      setSelectedSensor(updated)
      setRemarkSaveSuccess(true)
      setIsEditingRemark(false)
      setEditRemark('')
      setEditRemarkReason('')

      setSensors((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )

      await fetchStats()

      setTimeout(() => setRemarkSaveSuccess(false), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setRemarkSaving(false)
    }
  }

  const startEditCoefficient = () => {
    if (!selectedSensor) return
    setEditCoefficient(selectedSensor.coefficient)
    setEditCoefficientReason(selectedSensor.coefficient_reason || '')
    setCoefficientSaveSuccess(false)
    setIsEditingCoefficient(true)
  }

  const cancelEditCoefficient = () => {
    setIsEditingCoefficient(false)
    setEditCoefficient(1.0)
    setEditCoefficientReason('')
    setCoefficientSaveSuccess(false)
  }

  const handleSaveCoefficient = async () => {
    if (!selectedSensor) return
    if (isNaN(editCoefficient) || editCoefficient <= 0) {
      alert('请输入有效的安全系数（大于0的数字）')
      return
    }

    setCoefficientSaving(true)
    try {
      const updated = await updateSensorCoefficient(
        selectedSensor.id,
        editCoefficient,
        editCoefficientReason,
        '设备工程师'
      )
      setSelectedSensor(updated)
      setCoefficientSaveSuccess(true)
      setIsEditingCoefficient(false)
      setEditCoefficientReason('')

      setSensors((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )

      await fetchStats()

      setTimeout(() => setCoefficientSaveSuccess(false), 2000)
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败')
    } finally {
      setCoefficientSaving(false)
    }
  }

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setPhotoFile(files[0])
    }
  }

  const handleUploadPhoto = async () => {
    if (!selectedSensor || !photoFile) return

    setPhotoUploading(true)
    try {
      const newPhoto = await uploadPhoto(
        selectedSensor.id,
        photoFile,
        photoRemark
      )
      setSensorPhotos((prev) => [newPhoto, ...prev])
      setPhotoFile(null)
      setPhotoRemark('')

      setSensors((prev) =>
        prev.map((s) =>
          s.id === selectedSensor.id
            ? {
                ...s,
                photos: [...(s.photos || []), newPhoto],
              }
            : s
        )
      )

      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败')
    } finally {
      setPhotoUploading(false)
    }
  }

  return (
    <div className={clsx('flex gap-6', sidebarOpen ? 'mr-[440px]' : '')}>
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              传感器编号看着像主材料
            </h1>
            <p className="mt-1 text-sm text-muted">
              管理和查看所有传感器数据，支持批量导入去重、工况照片补录、参数调整留痕
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
              <Download className="h-4 w-4" />
              导出
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm"
            >
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
                  {batch.filename} (导入{batch.imported_count}/重复
                  {batch.duplicate_count})
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
                        工况照片
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
                          <span
                            className={clsx(
                              'font-mono text-sm font-medium',
                              sensor.coefficient_manual
                                ? editCoefficientReason
                                  ? 'text-danger'
                                  : 'text-primary'
                                : 'text-gray-900'
                            )}
                          >
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
                            <span className="text-sm">
                              {sensorPhotos.filter(
                                (p) => p.sensor_id === sensor.id
                              ).length || sensor.photos?.length || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleSensorSelect(sensor)}
                              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                              title="编辑详情/补录"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSensorSelect(sensor, true)
                              }}
                              className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                              title="工况照片"
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
                  <button
                    onClick={() => setImportModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
                  >
                    立即导入
                  </button>
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
          <div className="fixed right-0 top-0 bottom-0 w-[440px] bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedSensor.sensor_code}
                </h3>
                <p className="text-sm text-muted mt-0.5">
                  {selectedSensor.material_type} · 传感器详情
                </p>
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
                参数编辑
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
                      <span className="text-sm text-muted">批次 ID</span>
                      <span className="text-sm font-mono text-gray-900">
                        {selectedSensor.batch_id?.slice(0, 16)}...
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">转速范围</span>
                      <span className="text-sm font-mono text-gray-900">
                        {selectedSensor.rpm_min} - {selectedSensor.rpm_max} RPM
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted">安全系数</span>
                        {!isEditingCoefficient ? (
                          <button
                            onClick={startEditCoefficient}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <Edit3 className="h-3 w-3" />
                            修改
                          </button>
                        ) : (
                          <span className="text-xs text-muted">编辑中</span>
                        )}
                      </div>

                      {!isEditingCoefficient ? (
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                          <span className="font-mono text-lg font-bold text-gray-900">
                            {selectedSensor.coefficient.toFixed(2)}
                          </span>
                          <Badge
                            type="source"
                            source={
                              selectedSensor.coefficient_manual ? 'manual' : 'auto'
                            }
                          />
                        </div>
                      ) : (
                        <div className="space-y-3 bg-primary/5 p-3 rounded-lg border border-primary/20">
                          {selectedSensor.coefficient_manual &&
                            !remarkSaveSuccess && (
                              <div className="text-xs text-danger flex items-start gap-1">
                                <History className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>
                                  当前值 {selectedSensor.coefficient.toFixed(2)}{' '}
                                  来自人工修改，原因为：
                                  {selectedSensor.coefficient_reason || '（未填写）'}
                                </span>
                              </div>
                            )}
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              新安全系数值
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editCoefficient}
                              onChange={(e) =>
                                setEditCoefficient(parseFloat(e.target.value))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              修改原因 <span className="text-danger">*</span>
                              （实验老师林老师可填写，未填写将标记待复核）
                            </label>
                            <textarea
                              rows={2}
                              placeholder="例如：工况照片显示物料黏度偏高，系数需调至 1.35"
                              value={editCoefficientReason}
                              onChange={(e) =>
                                setEditCoefficientReason(e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm resize-none"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditCoefficient}
                              disabled={coefficientSaving}
                              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleSaveCoefficient}
                              disabled={coefficientSaving || isNaN(editCoefficient)}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {coefficientSaving ? (
                                <>
                                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  保存中
                                </>
                              ) : (
                                <>
                                  <Save className="h-3 w-3" />
                                  保存
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {coefficientSaveSuccess && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                          <CheckCircle2 className="h-4 w-4" />
                          安全系数已更新，历史记录已留痕
                        </div>
                      )}

                      {selectedSensor.coefficient_reason &&
                        !isEditingCoefficient && (
                          <div>
                            <span className="text-sm text-muted">系数修改原因</span>
                            <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border-l-4 border-primary">
                              {selectedSensor.coefficient_reason}
                            </p>
                          </div>
                        )}
                    </div>

                    <div className="space-y-2 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted">备注（工况照片关键备注）</span>
                        {!isEditingRemark ? (
                          <button
                            onClick={startEditRemark}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                          >
                            <Edit3 className="h-3 w-3" />
                            {selectedSensor.remark ? '修改' : '添加'}
                          </button>
                        ) : (
                          <span className="text-xs text-muted">编辑中</span>
                        )}
                      </div>

                      {!isEditingRemark ? (
                        selectedSensor.remark ? (
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {selectedSensor.remark}
                          </p>
                        ) : (
                          <p className="text-sm text-muted italic bg-gray-50 p-3 rounded-lg">
                            暂无备注，点击「添加」录入工况照片关键备注
                          </p>
                        )
                      ) : (
                        <div className="space-y-3 bg-primary/5 p-3 rounded-lg border border-primary/20">
                          {selectedSensor.remark && !remarkSaveSuccess && (
                            <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                              <div className="flex items-center gap-1 text-muted mb-1">
                                <History className="h-3 w-3" />
                                改前文本：
                              </div>
                              <span className="line-through text-gray-500">
                                {selectedSensor.remark}
                              </span>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              改后文本（备注内容）
                            </label>
                            <textarea
                              rows={3}
                              placeholder="例如：照片显示温度偏高2度，物料结块，注意降速..."
                              value={editRemark}
                              onChange={(e) => setEditRemark(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted mb-1">
                              为什么改 <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="例如：林老师补看工况照片发现物料异常"
                              value={editRemarkReason}
                              onChange={(e) => setEditRemarkReason(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEditRemark}
                              disabled={remarkSaving}
                              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                              取消
                            </button>
                            <button
                              onClick={handleSaveRemark}
                              disabled={remarkSaving || !editRemarkReason.trim()}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {remarkSaving ? (
                                <>
                                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  保存中
                                </>
                              ) : (
                                <>
                                  <Save className="h-3 w-3" />
                                  保存留痕
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {remarkSaveSuccess && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                          <CheckCircle2 className="h-4 w-4" />
                          备注已保存，改前改后已记录至变更历史
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <p className="text-xs text-muted flex items-center gap-1">
                      <History className="h-3 w-3" />
                      时间信息
                    </p>
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
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <Plus className="h-4 w-4 text-primary" />
                      补录工况照片
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileSelect}
                      className="hidden"
                    />
                    <div
                      onClick={() => photoInputRef.current?.click()}
                      className={clsx(
                        'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all',
                        photoFile
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 hover:border-primary hover:bg-white'
                      )}
                    >
                      {photoFile ? (
                        <div className="space-y-1">
                          <Image className="h-8 w-8 mx-auto text-green-500" />
                          <p className="text-sm font-medium text-gray-900">
                            {photoFile.name}
                          </p>
                          <p className="text-xs text-muted">
                            {(photoFile.size / 1024).toFixed(1)} KB · 点击可更换
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-8 w-8 mx-auto text-muted" />
                          <p className="text-sm text-muted">
                            点击选择或拖拽图片上传
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="照片备注（关键信息，如：温度偏高、物料结块等）"
                      value={photoRemark}
                      onChange={(e) => setPhotoRemark(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                    <button
                      onClick={handleUploadPhoto}
                      disabled={!photoFile || photoUploading}
                      className={clsx(
                        'w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
                        !photoFile || photoUploading
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-primary text-white hover:bg-primary/90'
                      )}
                    >
                      {photoUploading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          上传中
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          上传照片
                        </>
                      )}
                    </button>
                  </div>

                  {sensorPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {sensorPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer shadow-sm"
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
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-xs text-white line-clamp-2">
                                {photo.remark}
                              </p>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {new Date(photo.uploaded_at).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <Image className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-muted">工况照片常常藏着关键备注</p>
                      <p className="text-xs text-muted mt-1">
                        请补录工况照片，以便实验老师林老师复核
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </div>
  )
}
