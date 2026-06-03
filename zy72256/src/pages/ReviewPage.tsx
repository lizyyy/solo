import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { ChevronDown, ChevronUp } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import TypeBadge from '@/components/TypeBadge'
import type { CoordinateType, CoordinateRecord } from '@shared/types'

export default function ReviewPage() {
  const records = useStore((s) => s.records)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const fetchRecords = useStore((s) => s.fetchRecords)
  const submitReview = useStore((s) => s.submitReview)
  const role = useStore((s) => s.role)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [photoId, setPhotoId] = useState('')
  const [retentionReason, setRetentionReason] = useState('')
  const [correctType, setCorrectType] = useState<CoordinateType>('longitude_latitude')
  const [showCorrect, setShowCorrect] = useState(false)

  useEffect(() => {
    fetchRecords({ status: 'pending_review' })
  }, [])

  const pendingRecords = records.filter(
    (r) => r.status === 'pending_review' || r.status === 'pending_inspection'
  )

  const handleRetain = async (record: CoordinateRecord) => {
    if (record.coordinate_type === 'mixed' && !retentionReason.trim()) {
      return
    }
    await submitReview({
      record_id: record.id,
      operator: role === 'instructor' ? '老梁' : role,
      inspection_photo_id: photoId || null,
      retention_reason: record.coordinate_type === 'mixed' ? retentionReason : null,
      action: 'retain',
    })
    setExpandedId(null)
    setPhotoId('')
    setRetentionReason('')
  }

  const handleCorrect = async (record: CoordinateRecord) => {
    await submitReview({
      record_id: record.id,
      operator: role === 'instructor' ? '老梁' : role,
      inspection_photo_id: photoId || null,
      retention_reason: null,
      action: 'correct',
      corrected_type: correctType,
    })
    setExpandedId(null)
    setPhotoId('')
    setRetentionReason('')
    setShowCorrect(false)
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setShowCorrect(false)
    } else {
      setExpandedId(id)
      setShowCorrect(false)
      setPhotoId('')
      setRetentionReason('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">教官复核</h2>
        <p className="text-gray-500 mt-1">审核待复核的坐标记录，对混合坐标标记保留理由</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#1a3a4a] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">行号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">建筑名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">坐标原点说明</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">坐标类型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pendingRecords.map((r) => (
                <ReviewRow
                  key={r.id}
                  record={r}
                  expanded={expandedId === r.id}
                  onToggle={() => toggleExpand(r.id)}
                  photoId={photoId}
                  setPhotoId={setPhotoId}
                  retentionReason={retentionReason}
                  setRetentionReason={setRetentionReason}
                  showCorrect={showCorrect}
                  setShowCorrect={setShowCorrect}
                  correctType={correctType}
                  setCorrectType={setCorrectType}
                  onRetain={() => handleRetain(r)}
                  onCorrect={() => handleCorrect(r)}
                  loading={loading}
                />
              ))}
              {pendingRecords.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    暂无待复核记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface ReviewRowProps {
  record: CoordinateRecord
  expanded: boolean
  onToggle: () => void
  photoId: string
  setPhotoId: (v: string) => void
  retentionReason: string
  setRetentionReason: (v: string) => void
  showCorrect: boolean
  setShowCorrect: (v: boolean) => void
  correctType: CoordinateType
  setCorrectType: (v: CoordinateType) => void
  onRetain: () => void
  onCorrect: () => void
  loading: boolean
}

function ReviewRow({
  record, expanded, onToggle,
  photoId, setPhotoId,
  retentionReason, setRetentionReason,
  showCorrect, setShowCorrect,
  correctType, setCorrectType,
  onRetain, onCorrect, loading,
}: ReviewRowProps) {
  const isMixed = record.coordinate_type === 'mixed'

  return (
    <>
      <tr
        className={`${isMixed ? 'mixed-row border-l-3 border-l-[#e8943a]' : ''} hover:bg-gray-50 cursor-pointer transition-colors`}
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{record.original_line_number}</td>
        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{record.building_name}</td>
        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{record.coordinate_origin_description}</td>
        <td className="px-4 py-3"><TypeBadge type={record.coordinate_type} blink={isMixed} /></td>
        <td className="px-4 py-3"><StatusBadge status={record.status} /></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50/50 px-6 py-4">
            <div className="max-w-xl space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">巡检照片编号</label>
                <input
                  type="text"
                  value={photoId}
                  onChange={(e) => setPhotoId(e.target.value)}
                  placeholder="输入照片编号"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#e8943a]"
                />
              </div>
              {isMixed && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    保留理由 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={retentionReason}
                    onChange={(e) => setRetentionReason(e.target.value)}
                    placeholder="请填写保留理由，不要自动归正常"
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#e8943a] resize-none"
                  />
                </div>
              )}
              {!showCorrect ? (
                <div className="flex gap-3">
                  <button
                    onClick={onRetain}
                    disabled={loading || (isMixed && !retentionReason.trim())}
                    className="px-4 py-2 bg-[#1a3a4a] text-white text-sm rounded-md hover:bg-[#2a5a6a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    保留并提交巡检组
                  </button>
                  <button
                    onClick={() => setShowCorrect(true)}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                  >
                    修正坐标类型
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">选择修正后的类型</label>
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer transition-colors ${correctType === 'longitude_latitude' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                      <input
                        type="radio"
                        name={`correct-${record.id}`}
                        value="longitude_latitude"
                        checked={correctType === 'longitude_latitude'}
                        onChange={() => setCorrectType('longitude_latitude')}
                        className="accent-blue-600"
                      />
                      <span className="text-sm">经纬度</span>
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer transition-colors ${correctType === 'metric' ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300'}`}>
                      <input
                        type="radio"
                        name={`correct-${record.id}`}
                        value="metric"
                        checked={correctType === 'metric'}
                        onChange={() => setCorrectType('metric')}
                        className="accent-cyan-600"
                      />
                      <span className="text-sm">米制坐标</span>
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onCorrect}
                      disabled={loading}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      确认修正
                    </button>
                    <button
                      onClick={() => setShowCorrect(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
