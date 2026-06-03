import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, XCircle, AlertTriangle, CheckCircle } from 'lucide-react'
import { useLedgerStore } from '@/store/useLedgerStore'

export default function Review() {
  const navigate = useNavigate()
  const { records, loading, fetchRecords, confirmRecord, rejectRecord } = useLedgerStore()

  useEffect(() => {
    fetchRecords('inconsistent')
  }, [fetchRecords])

  const handleConfirm = async (id: string) => {
    await confirmRecord(id, 'admin')
    fetchRecords('inconsistent')
  }

  const handleReject = async (id: string) => {
    await rejectRecord(id, 'admin')
    fetchRecords('inconsistent')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-xl font-medium flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <ShieldCheck size={22} style={{ color: 'var(--orange)' }} />
          待复核项
        </h1>
        <span
          className="text-sm px-3 py-1 rounded-full"
          style={{ backgroundColor: 'var(--orange-bg)', color: 'var(--orange)' }}
        >
          {records.length} 条待复核
        </span>
      </div>

      {records.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 gap-3"
          style={{ color: 'var(--text-muted)' }}
        >
          <CheckCircle size={48} />
          <p className="text-base">所有记录已复核完毕</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <span
                      className="font-mono text-sm cursor-pointer hover:underline"
                      style={{ color: 'var(--blue)' }}
                      onClick={() => navigate(`/record/${record.id}`)}
                    >
                      {record.trade_no}
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--orange-bg)', color: 'var(--orange)' }}
                    >
                      不一致
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="rounded-lg px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--red)',
                        color: 'var(--red)',
                      }}
                    >
                      来源1：{record.institution_name_source1}
                    </div>
                    <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
                    <div
                      className="rounded-lg px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--red)',
                        color: 'var(--red)',
                      }}
                    >
                      来源2：{record.institution_name_source2}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>除权日：</span>
                      <span style={{ color: 'var(--text-primary)' }}>{record.ex_rights_date}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>税费率：</span>
                      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                        {record.tax_rate != null ? `${record.tax_rate.toFixed(2)}%` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-6 flex-shrink-0">
                  <button
                    onClick={() => handleConfirm(record.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                    style={{
                      backgroundColor: 'var(--green-bg)',
                      color: 'var(--green)',
                      border: '1px solid var(--green)',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <CheckCircle size={15} />
                    确认
                  </button>
                  <button
                    onClick={() => handleReject(record.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                    style={{
                      backgroundColor: 'var(--red-bg)',
                      color: 'var(--red)',
                      border: '1px solid var(--red)',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <XCircle size={15} />
                    打回
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
