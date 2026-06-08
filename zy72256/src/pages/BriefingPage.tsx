import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import TypeBadge from '@/components/TypeBadge'
import DetailPanel from '@/components/DetailPanel'
import type { CoordinateRecord, AuditLog } from '@shared/types'

export default function BriefingPage() {
  const records = useStore((s) => s.records)
  const fetchRecords = useStore((s) => s.fetchRecords)
  const auditLogs = useStore((s) => s.auditLogs)
  const fetchAuditLogs = useStore((s) => s.fetchAuditLogs)
  const photos = useStore((s) => s.photos)
  const fetchPhotos = useStore((s) => s.fetchPhotos)

  const [selectedRecord, setSelectedRecord] = useState<CoordinateRecord | null>(null)

  useEffect(() => {
    fetchRecords()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmedRecords = records.filter(
    (r) => r.status === 'confirmed' || r.status === 'corrected'
  )

  const normalCount = confirmedRecords.filter((r) => r.coordinate_type !== 'mixed').length
  const mixedCount = confirmedRecords.filter((r) => r.coordinate_type === 'mixed').length
  const pendingCount = records.filter(
    (r) => r.status === 'pending_review' || r.status === 'under_review'
  ).length

  const handleRecordClick = async (record: CoordinateRecord) => {
    if (record.coordinate_type !== 'mixed') return
    setSelectedRecord(record)
    await fetchAuditLogs(record.id)
    await fetchPhotos(record.id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">班组说明</h2>
        <p className="text-gray-500 mt-1">查看坐标原点说明总览，点击混合坐标查看保留理由</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CheckCircle} label="正常数" value={normalCount} color="text-green-600" bg="bg-green-50" />
        <StatCard icon={AlertTriangle} label="混合数" value={mixedCount} color="text-[#e8943a]" bg="bg-orange-50" />
        <StatCard icon={Clock} label="待复核数" value={pendingCount} color="text-[#2a5a6a]" bg="bg-cyan-50" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">行号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">建筑名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">坐标原点说明</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">坐标类型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {confirmedRecords.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => handleRecordClick(r)}
                  className={`hover:bg-gray-50 transition-colors ${
                    r.coordinate_type === 'mixed'
                      ? 'cursor-pointer border-l-3 border-l-[#e8943a] bg-orange-50/30'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-gray-700 font-mono">{r.original_line_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{r.building_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{r.coordinate_origin_description}</td>
                  <td className="px-4 py-3"><TypeBadge type={r.coordinate_type} blink={r.coordinate_type === 'mixed'} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {confirmedRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    暂无已确认记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetailPanel
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord ? `${selectedRecord.building_name} - 坐标原点说明详情` : ''}
        width={480}
      >
        {selectedRecord && (
          <RecordDetail record={selectedRecord} auditLogs={auditLogs} photos={photos} />
        )}
      </DetailPanel>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-4`}>
      <Icon size={28} className={color} />
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function RecordDetail({ record, auditLogs, photos }: {
  record: CoordinateRecord
  auditLogs: AuditLog[]
  photos: { photo_number: string; description: string | null; attached_at: string }[]
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-gray-400 mb-1">原始行号</p>
        <p className="text-sm font-mono text-gray-900">#{record.original_line_number}</p>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1">坐标原点说明原文</p>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{record.coordinate_origin_description}</p>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1">坐标类型</p>
        <TypeBadge type={record.coordinate_type} blink={record.coordinate_type === 'mixed'} />
      </div>

      {record.retention_reason && (
        <div className="border-2 border-[#e8943a] rounded-lg p-4 bg-orange-50/50">
          <p className="text-xs font-semibold text-[#e8943a] mb-2">保留理由</p>
          <p className="text-sm text-gray-800">{record.retention_reason}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">关联巡检照片</p>
          <div className="space-y-2">
            {photos.map((p) => (
              <div key={p.photo_number} className="flex items-center gap-2 text-sm bg-gray-50 rounded-md px-3 py-2">
                <span className="font-mono text-gray-700">{p.photo_number}</span>
                {p.description && <span className="text-gray-400">- {p.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {auditLogs.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-3">操作历史</p>
          <div className="relative pl-7">
            <div className="timeline-line" />
            {auditLogs.map((log, i) => (
              <div key={log.id} className="relative pb-4 last:pb-0 fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                <div className={`timeline-dot absolute -left-7 top-1 ${i === 0 ? 'timeline-dot-active' : ''}`} />
                <div>
                  <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString('zh-CN')}</p>
                  <p className="text-sm text-gray-700">{log.operator} · {log.change_detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
