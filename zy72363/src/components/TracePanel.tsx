import { useState } from 'react'
import { X, ExternalLink, History, Image, Cpu, Shield, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { SafetyZone, SensorData } from '@/types'

interface TracePanelProps {
  safetyZone: SafetyZone | null
  sensor: SensorData | null
  onClose: () => void
}

export default function TracePanel({ safetyZone, sensor, onClose }: TracePanelProps) {
  const navigate = useNavigate()
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  if (!safetyZone || !sensor) return null

  const handleViewSensor = () => {
    navigate('/sensors', { state: { search: sensor.sensor_code } })
  }

  const handleViewHistory = () => {
    navigate('/history', { state: { targetType: 'safety-zone', targetId: safetyZone.id } })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">数据溯源</h2>
            <p className="text-sm text-muted mt-0.5">安全区参数详细信息</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Cpu className="h-4 w-4" />
              <span>传感器信息</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted mb-1">传感器编号</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{sensor.sensor_code}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">批次 ID</p>
                <p className="font-mono text-sm text-gray-700">{sensor.batch_id}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">物料类型</p>
                <p className="text-sm text-gray-700">{sensor.material_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">安全系数</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{sensor.coefficient}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Shield className="h-4 w-4" />
              <span>安全区参数</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted mb-1">最小转速 (RPM)</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{safetyZone.rpm_min}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">最大转速 (RPM)</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{safetyZone.rpm_max}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">转速范围</p>
                <p className="font-mono text-sm text-gray-700">{safetyZone.rpm_max - safetyZone.rpm_min}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">版本</p>
                <p className="font-mono text-sm text-gray-700">v{safetyZone.version}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">系数来源</p>
                <p className={`text-sm font-medium ${safetyZone.coefficient_source === 'manual' ? 'text-orange-600' : 'text-green-600'}`}>
                  {safetyZone.coefficient_source === 'manual' ? '人工修改' : '自动生成'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">复核状态</p>
                <p className={`text-sm font-medium ${
                  safetyZone.review_status === 'approved' ? 'text-green-600' :
                  safetyZone.review_status === 'rollback' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {safetyZone.review_status === 'approved' ? '已通过' :
                   safetyZone.review_status === 'rollback' ? '已回滚' : '待复核'}
                </p>
              </div>
            </div>
            {safetyZone.coefficient_reason && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-muted mb-1">修改原因</p>
                <p className="text-sm text-gray-700">{safetyZone.coefficient_reason}</p>
              </div>
            )}
            {safetyZone.review_comment && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-muted mb-1">复核意见</p>
                <p className="text-sm text-gray-700">{safetyZone.review_comment}</p>
              </div>
            )}
          </div>

          {sensor.photos && sensor.photos.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary font-medium">
                <Image className="h-4 w-4" />
                <span>关联照片 ({sensor.photos.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {sensor.photos.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setEnlargedPhoto(photo.url)}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group relative"
                  >
                    <img
                      src={photo.url}
                      alt={photo.remark || '照片'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleViewSensor}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm font-medium">查看详情</span>
            </button>
            <button
              onClick={handleViewHistory}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <History className="h-4 w-4" />
              <span className="text-sm font-medium">查看历史</span>
            </button>
          </div>

          <div className="text-xs text-muted space-y-1 pt-2 border-t border-gray-200">
            <p>数据来源：API /api/safety-zones</p>
            <p>创建时间：{new Date(safetyZone.created_at).toLocaleString('zh-CN')}</p>
            <p>更新时间：{new Date(safetyZone.updated_at).toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </div>

      {enlargedPhoto && (
        <>
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center" onClick={() => setEnlargedPhoto(null)}>
            <button
              onClick={() => setEnlargedPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={enlargedPhoto}
              alt="放大照片"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </>
      )}

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
