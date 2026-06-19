import { useState, useEffect, useRef } from 'react'
import { X, Edit3, Save, Image as ImageIcon, Upload, AlertCircle, ImagePlus } from 'lucide-react'
import { clsx } from 'clsx'
import Badge from './Badge'
import PhotoPreviewModal from './PhotoPreviewModal'
import ModifyCoefficientModal from './ModifyCoefficientModal'
import { getPhotos, updateSensorRemark, uploadPhoto } from '@/lib/api'
import type { SensorData, PhotoMeta } from '@/types'

interface SensorDetailSidebarProps {
  isOpen: boolean
  onClose: () => void
  sensor: SensorData | null
  onUpdate: () => void
}

export default function SensorDetailSidebar({
  isOpen,
  onClose,
  sensor,
  onUpdate,
}: SensorDetailSidebarProps) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false)
  const [isEditingRemark, setIsEditingRemark] = useState(false)
  const [remarkInput, setRemarkInput] = useState('')
  const [remarkReason, setRemarkReason] = useState('')
  const [isSavingRemark, setIsSavingRemark] = useState(false)
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && sensor) {
      setRemarkInput(sensor.remark)
      setRemarkReason('')
      setIsEditingRemark(false)
      setError(null)
      setUploadError(null)
      loadPhotos()
    }
  }, [isOpen, sensor])

  const loadPhotos = async () => {
    if (!sensor) return

    setIsLoadingPhotos(true)
    setError(null)

    try {
      const result = await getPhotos(sensor.id)
      setPhotos(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载照片失败')
    } finally {
      setIsLoadingPhotos(false)
    }
  }

  const handleSaveRemark = async () => {
    if (!sensor) return
    if (!remarkReason.trim()) {
      setError('请填写修改原因')
      return
    }

    setIsSavingRemark(true)
    setError(null)

    try {
      await updateSensorRemark(sensor.id, remarkInput.trim(), remarkReason.trim(), '实验老师林老师')
      setIsEditingRemark(false)
      setRemarkReason('')
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存备注失败')
    } finally {
      setIsSavingRemark(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !sensor) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      setUploadError('请上传图片文件')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      await uploadPhoto(sensor.id, file, '')
      await loadPhotos()
      onUpdate()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传照片失败')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handlePhotoClick = (index: number) => {
    setPreviewIndex(index)
    setIsPreviewOpen(true)
  }

  const handleModifySuccess = () => {
    onUpdate()
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isOpen || !sensor) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">传感器详情</h2>
            <p className="font-mono text-sm text-muted mt-1">{sensor.sensor_code}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-muted mb-1">物料类型</p>
              <p className="font-medium text-gray-900">{sensor.material_type || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-muted mb-1">批次号</p>
              <p className="font-mono text-sm text-gray-900">{sensor.batch_id}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-muted mb-2">转速范围 (RPM)</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-gray-900">
                {sensor.rpm_min.toLocaleString()}
              </span>
              <span className="text-muted">—</span>
              <span className="font-mono text-xl font-bold text-gray-900">
                {sensor.rpm_max.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted">安全系数</p>
              <button
                onClick={() => setIsModifyModalOpen(true)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Edit3 className="h-3 w-3" />
                修改
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-gray-900">
                {sensor.coefficient.toFixed(2)}
              </span>
              <Badge type="source" source={sensor.coefficient_manual ? 'manual' : 'auto'} size="sm" />
              {sensor.coefficient_manual && !sensor.coefficient_reason && (
                <Badge type="noReason" size="sm" />
              )}
            </div>
            {sensor.coefficient_reason && (
              <p className="text-sm text-muted mt-2">原因：{sensor.coefficient_reason}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900">备注</p>
              {!isEditingRemark ? (
                <button
                  onClick={() => setIsEditingRemark(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  编辑
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setRemarkInput(sensor.remark)
                      setIsEditingRemark(false)
                    }}
                    className="text-xs text-muted hover:text-gray-600 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveRemark}
                    disabled={isSavingRemark}
                    className={clsx(
                      'flex items-center gap-1 text-xs transition-colors',
                      isSavingRemark
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-primary hover:text-primary/80'
                    )}
                  >
                    <Save className="h-3 w-3" />
                    {isSavingRemark ? '保存中...' : '保存'}
                  </button>
                </div>
              )}
            </div>
            {isEditingRemark ? (
              <div className="space-y-3">
                <textarea
                  value={remarkInput}
                  onChange={(e) => setRemarkInput(e.target.value)}
                  placeholder="请输入备注信息"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
                />
                <div>
                  <label className="block text-xs text-muted mb-1">
                    修改原因 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={remarkReason}
                    onChange={(e) => setRemarkReason(e.target.value)}
                    placeholder="例如：林老师补看工况照片添加关键备注"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 min-h-[60px]">
                {sensor.remark || <span className="text-muted">暂无备注</span>}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">工况照片</p>
                <span className="text-xs text-muted">({photos.length})</span>
              </div>
              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                className={clsx(
                  'flex items-center gap-1 text-xs transition-colors',
                  isUploading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-primary hover:text-primary/80'
                )}
              >
                <ImagePlus className="h-3 w-3" />
                {isUploading ? '上传中...' : '上传照片'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {uploadError && (
              <div className="mb-3 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-danger flex-shrink-0" />
                <p className="text-xs text-danger">{uploadError}</p>
              </div>
            )}

            {isLoadingPhotos ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    onClick={() => handlePhotoClick(index)}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
                  >
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                <ImageIcon className="h-10 w-10 text-muted mb-2" />
                <p className="text-sm text-muted">暂无照片</p>
              </div>
            )}
          </div>

          <div className="text-xs text-muted space-y-1 pt-4 border-t border-gray-100">
            <p>创建时间：{formatDate(sensor.created_at)}</p>
            <p>更新时间：{formatDate(sensor.updated_at)}</p>
          </div>
        </div>
      </div>

      <PhotoPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        photos={photos}
        currentIndex={previewIndex}
        onIndexChange={setPreviewIndex}
      />

      <ModifyCoefficientModal
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        sensor={sensor}
        onSuccess={handleModifySuccess}
      />
    </>
  )
}
