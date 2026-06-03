import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, AlertTriangle, Camera, Upload, Inbox } from 'lucide-react'
import { useCalibrationStore } from '@/store/useCalibrationStore'
import StatusBadge from '@/components/StatusBadge'
import ImportModal from '@/components/ImportModal'
import { cn } from '@/lib/utils'

const statusTabs = [
  { key: '', label: '全部', color: '' },
  { key: 'calibrated', label: '已校准', color: 'text-status-green' },
  { key: 'pending_photo', label: '待补录', color: 'text-status-blue' },
  { key: 'pending_review', label: '待复核', color: 'text-status-red' },
  { key: 'anomaly', label: '有异常', color: 'text-accent' },
] as const

export default function Dashboard() {
  const navigate = useNavigate()
  const { records, statusFilter, loading, fetchRecords, setStatusFilter, importData } = useCalibrationStore()
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const filtered = statusFilter
    ? records.filter((r) => r.status === statusFilter)
    : records

  const countByStatus = (status: string) =>
    status ? records.filter((r) => r.status === status).length : records.length

  const handleImport = async (jsonData: string) => {
    const success = await importData(jsonData)
    if (success) fetchRecords()
    return success
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="container max-w-6xl py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-accent" />
            <h1 className="text-xl font-semibold text-text-primary">校准看板</h1>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent/90"
          >
            <Upload className="h-4 w-4" />
            导入数据
          </button>
        </div>

        <div className="flex items-center gap-1 mb-4 border-b border-border">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors',
                  active
                    ? 'border-accent text-text-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs data-font min-w-[20px]',
                    active ? 'bg-accent/20 text-accent' : 'bg-border text-text-secondary',
                  )}
                >
                  {countByStatus(tab.key)}
                </span>
              </button>
            )
          })}
        </div>

        {loading && records.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-text-secondary">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Inbox className="h-10 w-10 mb-3" />
            <p className="text-sm">暂无校准记录</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-card text-left text-text-secondary">
                  <th className="px-4 py-3 font-medium">信标ID</th>
                  <th className="px-4 py-3 font-medium">坐标原点说明</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">坐标混用</th>
                  <th className="px-4 py-3 font-medium">巡检照片</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-b border-border/50 hover:bg-bg-card/50">
                    <td className="px-4 py-3 data-font text-text-primary">{record.beaconId}</td>
                    <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">
                      {record.originDescription}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3">
                      {record.coordinateMixDetected ? (
                        <AlertTriangle className="h-4 w-4 text-accent" />
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-text-secondary">
                        <Camera className="h-4 w-4" />
                        <span className="data-font">{record.photoCount}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 data-font text-xs text-text-secondary">{record.updatedAt}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/record/${record.id}`)}
                        className="rounded px-3 py-1 text-xs text-accent border border-accent/30 hover:bg-accent/10"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  )
}
