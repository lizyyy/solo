import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  Check,
  X,
  Filter,
  ChevronDown,
  Eye,
  AlertCircle,
  Cpu,
  Image,
  ZoomIn,
  AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import Badge from '@/components/Badge'
import ReviewModal from '@/components/ReviewModal'
import { getSafetyZones, reviewSafetyZone, getHistory, getPhotos } from '@/lib/api'
import { useAppStore } from '@/store/useAppStore'
import type { SafetyZone, ChangeRecord, PhotoMeta } from '@/types'

interface ExpandedRowData {
  zone: SafetyZone
  history: ChangeRecord[]
  photos: PhotoMeta[]
}

interface PhotoModalProps {
  isOpen: boolean
  onClose: () => void
  photo: PhotoMeta | null
}

function PhotoModal({ isOpen, onClose, photo }: PhotoModalProps) {
  if (!isOpen || !photo) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative max-w-4xl max-h-[90vh] mx-4">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        <img
          src={photo.url}
          alt={photo.remark || photo.filename}
          className="max-w-full max-h-[85vh] rounded-lg object-contain"
        />
        {photo.remark && (
          <p className="mt-2 text-sm text-white text-center">{photo.remark}</p>
        )}
      </div>
    </div>
  )
}

export default function Review() {
  const navigate = useNavigate()
  const { fetchStats, safetyZoneStats } = useAppStore()

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rollback'>('pending')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [expandedRowData, setExpandedRowData] = useState<ExpandedRowData | null>(null)
  const [zones, setZones] = useState<SafetyZone[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 10

  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean
    zoneId: string | null
    action: 'approve' | 'rollback'
    sensorCode: string
  }>({
    isOpen: false,
    zoneId: null,
    action: 'approve',
    sensorCode: '',
  })

  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean
    photo: PhotoMeta | null
  }>({
    isOpen: false,
    photo: null,
  })

  const [expandLoading, setExpandLoading] = useState(false)

  const loadZones = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const reviewStatus = filterStatus === 'all' ? undefined : filterStatus
      const response = await getSafetyZones({
        page,
        pageSize,
        reviewStatus,
      })
      setZones(response.data)
      setTotal(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterStatus])

  useEffect(() => {
    loadZones()
    fetchStats()
  }, [loadZones, fetchStats])

  const handleRowExpand = async (zone: SafetyZone) => {
    if (expandedRowId === zone.id) {
      setExpandedRowId(null)
      setExpandedRowData(null)
      return
    }

    setExpandedRowId(zone.id)
    setExpandLoading(true)

    try {
      const [historyResponse, photosResponse] = await Promise.all([
        getHistory({ targetType: 'safety-zone', pageSize: 100 }),
        zone.sensor_id ? getPhotos(zone.sensor_id) : Promise.resolve([]),
      ])

      const zoneHistory = historyResponse.data.filter(
        (h) => h.target_id === zone.id
      )

      setExpandedRowData({
        zone,
        history: zoneHistory,
        photos: photosResponse,
      })
    } catch (err) {
      console.error('加载详情失败:', err)
    } finally {
      setExpandLoading(false)
    }
  }

  const handleReviewClick = (e: React.MouseEvent, zone: SafetyZone, action: 'approve' | 'rollback') => {
    e.stopPropagation()
    setReviewModal({
      isOpen: true,
      zoneId: zone.id,
      action,
      sensorCode: zone.sensor_code || '',
    })
  }

  const handleReviewConfirm = async (comment: string) => {
    if (!reviewModal.zoneId) return

    await reviewSafetyZone(reviewModal.zoneId, reviewModal.action === 'approve' ? 'approved' : 'rollback', comment)

    setReviewModal({ isOpen: false, zoneId: null, action: 'approve', sensorCode: '' })
    loadZones()
    fetchStats()
  }

  const handleNoReasonClick = (e: React.MouseEvent, zone: SafetyZone) => {
    e.stopPropagation()
    navigate('/sensors', {
      state: {
        expandSensorId: zone.sensor_id,
        expandSensorCode: zone.sensor_code,
      },
    })
  }

  const handleViewSensor = (zone: SafetyZone) => {
    navigate('/sensors', {
      state: {
        expandSensorId: zone.sensor_id,
        expandSensorCode: zone.sensor_code,
      },
    })
  }

  const handleViewPhotos = (zone: SafetyZone) => {
    navigate('/sensors', {
      state: {
        expandSensorId: zone.sensor_id,
        expandSensorCode: zone.sensor_code,
        showPhotos: true,
      },
    })
  }

  const totalPages = Math.ceil(total / pageSize)
  const pendingNoReasonCount = zones.filter(
    (z) => z.review_status === 'pending' && z.coefficient_source === 'manual' && !z.coefficient_reason
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">参数复核</h1>
          <p className="mt-1 text-sm text-muted">审核安全区参数的变更申请</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
            {(['all', 'pending', 'approved', 'rollback'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status)
                  setPage(1)
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  filterStatus === status
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {status === 'all'
                  ? '全部'
                  : status === 'pending'
                  ? '待复核'
                  : status === 'approved'
                  ? '已通过'
                  : '已回滚'}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4" />
            更多筛选
          </button>
        </div>
      </div>

      {filterStatus === 'pending' && pendingNoReasonCount > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-danger">
              发现 {pendingNoReasonCount} 条待复核记录未填写修改原因
            </p>
            <p className="text-sm text-danger/80 mt-1">
              人工修改系数但未填写原因的记录已用红色背景高亮，请优先处理
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
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
                onClick={loadZones}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="divide-y divide-gray-100">
              {zones.map((zone) => {
                const isManualNoReason =
                  zone.coefficient_source === 'manual' && !zone.coefficient_reason
                const isExpanded = expandedRowId === zone.id

                return (
                  <div key={zone.id} className="group">
                    <div
                      className={clsx(
                        'flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer',
                        isManualNoReason && zone.review_status === 'pending'
                          ? 'bg-danger/5 hover:bg-danger/10'
                          : ''
                      )}
                      onClick={() => handleRowExpand(zone)}
                    >
                      <button className="text-muted group-hover:text-primary transition-colors">
                        <ChevronDown
                          className={clsx(
                            'h-5 w-5 transition-transform',
                            isExpanded ? 'rotate-180' : ''
                          )}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-gray-900">
                            {zone.sensor_code || `ID: ${zone.sensor_id}`}
                          </span>
                          <Badge type="source" source={zone.coefficient_source} />
                          {isManualNoReason && (
                            <span
                              onClick={(e) => handleNoReasonClick(e, zone)}
                              className="cursor-pointer"
                              title="点击跳转到传感器详情补写原因"
                            >
                              <Badge type="noReason" />
                            </span>
                          )}
                          <Badge type="reviewStatus" status={zone.review_status} />
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {zone.material_type || '未知物料'} · 版本 v{zone.version} ·{' '}
                          {new Date(zone.updated_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xs text-muted">转速范围</p>
                          <p className="font-mono text-sm font-medium text-gray-900">
                            {zone.rpm_min} - {zone.rpm_max} RPM
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted">安全系数</p>
                          <p className="font-mono text-sm font-medium text-gray-900">
                            {zone.coefficient.toFixed(2)}
                          </p>
                        </div>
                        {zone.review_status === 'pending' && (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleReviewClick(e, zone, 'approve')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
                            >
                              <Check className="h-4 w-4" />
                              通过
                            </button>
                            <button
                              onClick={(e) => handleReviewClick(e, zone, 'rollback')}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors"
                            >
                              <X className="h-4 w-4" />
                              回滚
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                        {expandLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          </div>
                        ) : expandedRowData ? (
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <GitCompare className="h-4 w-4" />
                                变更详情
                              </h4>
                              {expandedRowData.history.length > 0 ? (
                                <div className="space-y-2 text-sm">
                                  {expandedRowData.history
                                    .slice(0, 4)
                                    .map((record) => {
                                      const fieldLabels: Record<string, string> = {
                                        rpm_min: '最小转速',
                                        rpm_max: '最大转速',
                                        coefficient: '安全系数',
                                        coefficient_reason: '修改原因',
                                      }
                                      return (
                                        <div
                                          key={record.id}
                                          className="flex justify-between items-center"
                                        >
                                          <span className="text-muted">
                                            {fieldLabels[record.field] || record.field}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono text-danger line-through">
                                              {record.old_value}
                                            </span>
                                            <span className="text-muted">→</span>
                                            <span className="font-mono text-success font-medium">
                                              {record.new_value}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                </div>
                              ) : (
                                <p className="text-sm text-muted">暂无变更记录</p>
                              )}
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Image className="h-4 w-4" />
                                工况照片
                              </h4>
                              {expandedRowData.photos.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {expandedRowData.photos.slice(0, 4).map((photo) => (
                                    <div
                                      key={photo.id}
                                      className="relative w-16 h-16 rounded-lg overflow-hidden cursor-pointer group"
                                      onClick={() =>
                                        setPhotoModal({ isOpen: true, photo })
                                      }
                                    >
                                      <img
                                        src={photo.url}
                                        alt={photo.remark || photo.filename}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                        <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </div>
                                  ))}
                                  {expandedRowData.photos.length > 4 && (
                                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-sm text-muted">
                                      +{expandedRowData.photos.length - 4}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted">暂无照片</p>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  溯源跳转
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handleViewSensor(zone)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
                                  >
                                    <Cpu className="h-4 w-4" />
                                    查看传感器
                                  </button>
                                  <button
                                    onClick={() => handleViewPhotos(zone)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
                                  >
                                    <Image className="h-4 w-4" />
                                    查看照片
                                  </button>
                                </div>
                              </div>

                              {zone.review_status === 'pending' && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" />
                                    复核操作
                                  </h4>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => handleReviewClick(e, zone, 'approve')}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors"
                                    >
                                      <Check className="h-4 w-4" />
                                      通过复核
                                    </button>
                                    <button
                                      onClick={(e) => handleReviewClick(e, zone, 'rollback')}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors"
                                    >
                                      <X className="h-4 w-4" />
                                      回滚变更
                                    </button>
                                  </div>
                                </div>
                              )}

                              {zone.review_comment && (
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                    复核意见
                                  </h4>
                                  <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                                    {zone.review_comment}
                                  </p>
                                  {zone.reviewer && (
                                    <p className="text-xs text-muted mt-1">
                                      复核人：{zone.reviewer} ·{' '}
                                      {zone.reviewed_at &&
                                        new Date(zone.reviewed_at).toLocaleString('zh-CN')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {zones.length === 0 && (
              <div className="py-12 text-center">
                <ShieldCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted">暂无数据</p>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-muted">
                  共 {total} 条记录，当前第 {page} / {totalPages} 页
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-gray-600 px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ReviewModal
        isOpen={reviewModal.isOpen}
        onClose={() => setReviewModal({ isOpen: false, zoneId: null, action: 'approve', sensorCode: '' })}
        onConfirm={handleReviewConfirm}
        action={reviewModal.action}
        sensorCode={reviewModal.sensorCode}
      />

      <PhotoModal
        isOpen={photoModal.isOpen}
        onClose={() => setPhotoModal({ isOpen: false, photo: null })}
        photo={photoModal.photo}
      />
    </div>
  )
}

function GitCompare(props: { className?: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M18 9V6a2 2 0 0 0-2-2H8" />
      <path d="M6 15v3a2 2 0 0 0 2 2h8" />
    </svg>
  )
}
