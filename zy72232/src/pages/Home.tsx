import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Database, Upload, Zap } from 'lucide-react'
import { useLedgerStore } from '@/store/useLedgerStore'
import type { RecordStatus } from '@/types'

const statusConfig: Record<RecordStatus, { label: string; color: string; bgColor: string }> = {
  normal: { label: '正常', color: 'var(--green)', bgColor: 'var(--green-bg)' },
  inconsistent: { label: '不一致', color: 'var(--orange)', bgColor: 'var(--orange-bg)' },
  supplemented: { label: '已补录', color: 'var(--blue)', bgColor: 'var(--blue-bg)' },
  confirmed: { label: '已确认', color: 'var(--green)', bgColor: 'var(--green-bg)' },
}

export default function Home() {
  const navigate = useNavigate()
  const { records, stats, loading, fetchRecords, fetchStats, seedDemoData } = useLedgerStore()
  const [activeFilter, setActiveFilter] = useState<RecordStatus | null>(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchRecords()
  }, [fetchStats, fetchRecords])

  const handleFilterClick = (status: RecordStatus) => {
    if (activeFilter === status) {
      setActiveFilter(null)
      fetchRecords()
    } else {
      setActiveFilter(status)
      fetchRecords(status)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedDemoData()
      await fetchStats()
      await fetchRecords()
    } finally {
      setSeeding(false)
    }
  }

  const statCards = [
    { status: 'normal' as RecordStatus, count: stats.normal, label: '正常' },
    { status: 'inconsistent' as RecordStatus, count: stats.inconsistent, label: '不一致待复核' },
    { status: 'supplemented' as RecordStatus, count: stats.supplemented, label: '已补录' },
  ]

  const isEmpty = records.length === 0 && stats.total === 0

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(({ status, count, label }) => {
          const cfg = statusConfig[status]
          const isActive = activeFilter === status
          return (
            <button
              key={status}
              onClick={() => handleFilterClick(status)}
              className="rounded-xl p-5 text-left transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: cfg.bgColor,
                border: isActive ? `2px solid ${cfg.color}` : '2px solid transparent',
                boxShadow: isActive ? `0 0 12px ${cfg.color}33` : 'none',
              }}
            >
              <div className="text-3xl font-bold font-mono" style={{ color: cfg.color }}>
                {count}
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                {label}
              </div>
            </button>
          )
        })}
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Database size={48} style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>暂无数据，请导入或加载演示数据</p>
        </div>
      ) : (
        <div
          className="flex-1 rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    交易编号
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    机构简称(来源1)
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    机构简称(来源2)
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    除权日
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    展期日期
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    税费率
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const inconsistent = !record.institution_name_consistent
                  return (
                    <tr
                      key={record.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onClick={() => navigate(`/record/${record.id}`)}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {record.trade_no}
                      </td>
                      <td className="px-4 py-3">
                        <span style={{ color: inconsistent ? 'var(--red)' : 'var(--text-primary)' }}>
                          {inconsistent && <AlertTriangle size={14} className="inline mr-1" />}
                          {record.institution_name_source1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span style={{ color: inconsistent ? 'var(--red)' : 'var(--text-primary)' }}>
                          {inconsistent && <AlertTriangle size={14} className="inline mr-1" />}
                          {record.institution_name_source2}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {record.ex_rights_date}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {record.extension_date}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span style={{ color: 'var(--text-primary)' }}>
                          {record.tax_rate != null ? `${record.tax_rate}%` : '-'}
                        </span>
                        {record.tax_rate_source === 'supplemented' && (
                          <span
                            className="ml-1.5 inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{ color: 'var(--blue)', backgroundColor: 'var(--blue-bg)' }}
                          >
                            补
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                          style={{
                            color: statusConfig[record.status].color,
                            backgroundColor: statusConfig[record.status].bgColor,
                          }}
                        >
                          {statusConfig[record.status].label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="fixed bottom-8 right-8 flex items-center gap-3">
        <button
          onClick={() => navigate('/import')}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card)'
          }}
        >
          <Upload size={16} />
          导入数据
        </button>
        <button
          onClick={handleSeed}
          disabled={seeding || loading}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--blue)',
            color: '#fff',
            opacity: seeding || loading ? 0.6 : 1,
          }}
        >
          <Zap size={16} />
          {seeding ? '加载中...' : '加载演示数据'}
        </button>
      </div>
    </div>
  )
}
