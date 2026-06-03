import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Clock, Edit3, X, ZoomIn, FileText } from 'lucide-react'
import { useLedgerStore } from '@/store/useLedgerStore'
import { fetchApi } from '@/lib/api'
import type { Screenshot } from '@/types'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: '正常', color: 'var(--green)', bg: 'var(--green-bg)' },
  inconsistent: { label: '不一致', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  supplemented: { label: '已补录', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  confirmed: { label: '已确认', color: 'var(--green)', bg: 'var(--green-bg)' },
}

const ACTION_COLORS: Record<string, string> = {
  import: 'var(--blue)',
  detect: 'var(--orange)',
  supplement: 'var(--green)',
  correct: '#B388FF',
  rerun: '#FFD600',
  confirm: 'var(--green)',
  reject: 'var(--red)',
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const {
    currentRecord,
    auditLogs,
    loading,
    fetchRecordById,
    fetchAuditLogs,
    supplementTaxRate,
    correctRecord,
    rerunDetection,
  } = useLedgerStore()

  const [taxRate, setTaxRate] = useState('')
  const [taxRemark, setTaxRemark] = useState('')
  const [correctField, setCorrectField] = useState<'source1' | 'source2'>('source1')
  const [correctValue, setCorrectValue] = useState('')
  const [showScreenshot, setShowScreenshot] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchRecordById(id)
      fetchAuditLogs(id)
    }
  }, [id, fetchRecordById, fetchAuditLogs])

  useEffect(() => {
    if (currentRecord?.screenshot_id) {
      fetchApi<Screenshot>(`/screenshot/${currentRecord.screenshot_id}`)
        .then((data) => setScreenshotUrl(data.data_url))
        .catch(() => setScreenshotUrl(null))
    } else if (currentRecord?.id) {
      fetchApi<Screenshot>(`/screenshot-by-record/${currentRecord.id}`)
        .then((data) => setScreenshotUrl(data.data_url))
        .catch(() => setScreenshotUrl(null))
    }
  }, [currentRecord?.screenshot_id, currentRecord?.id])

  const handleSupplement = async () => {
    if (!id || !taxRate) return
    await supplementTaxRate(id, parseFloat(taxRate), taxRemark, 'admin')
    fetchRecordById(id)
    fetchAuditLogs(id)
    setTaxRate('')
    setTaxRemark('')
  }

  const handleCorrect = async () => {
    if (!id || !correctValue) return
    const field = correctField === 'source1' ? 'institution_name_source1' : 'institution_name_source2'
    await correctRecord(id, field, correctValue, 'admin')
    await rerunDetection(id, 'admin')
    fetchRecordById(id)
    fetchAuditLogs(id)
    setCorrectValue('')
  }

  if (!currentRecord) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
        {loading ? '加载中...' : '记录不存在'}
      </div>
    )
  }

  const isInconsistent = currentRecord.institution_name_source1 !== currentRecord.institution_name_source2
  const statusInfo = STATUS_MAP[currentRecord.status] || STATUS_MAP.normal

  return (
    <div className="flex gap-6">
      <div className="flex-[2] flex flex-col gap-6">
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <h2
            className="text-base font-medium mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <FileText size={18} style={{ color: 'var(--blue)' }} />
            基本信息
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>交易编号</span>
              <p className="font-mono text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                {currentRecord.trade_no}
              </p>
            </div>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>当前状态</span>
              <p className="mt-1">
                <span
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded"
                  style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                >
                  {statusInfo.label}
                </span>
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>机构简称对比</span>
              <div className="flex items-center gap-3 mt-1">
                <div
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: isInconsistent ? '1px solid var(--red)' : '1px solid var(--green)',
                    color: isInconsistent ? 'var(--red)' : 'var(--green)',
                  }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>来源1：</span>
                  {currentRecord.institution_name_source1}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isInconsistent ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--red)' }}>
                      <AlertTriangle size={14} />
                      不一致
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--green)' }}>
                      <CheckCircle size={14} />
                      一致
                    </span>
                  )}
                </div>
                <div
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: isInconsistent ? '1px solid var(--red)' : '1px solid var(--green)',
                    color: isInconsistent ? 'var(--red)' : 'var(--green)',
                  }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>来源2：</span>
                  {currentRecord.institution_name_source2}
                </div>
              </div>
            </div>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>除权日</span>
              <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                {currentRecord.ex_rights_date}
              </p>
            </div>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>展期日期</span>
              <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                {currentRecord.extension_date}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <h2
            className="text-base font-medium mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <Edit3 size={18} style={{ color: 'var(--green)' }} />
            税费率备注
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>当前税费率</span>
              <p className="text-sm mt-1 font-mono" style={{ color: 'var(--text-primary)' }}>
                {currentRecord.tax_rate != null ? `${currentRecord.tax_rate.toFixed(2)}%` : '-'}
              </p>
            </div>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>来源</span>
              <p className="mt-1">
                <span
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    color: currentRecord.tax_rate_source === 'supplemented' ? 'var(--blue)' : 'var(--text-secondary)',
                    backgroundColor: currentRecord.tax_rate_source === 'supplemented' ? 'var(--blue-bg)' : 'var(--bg-secondary)',
                  }}
                >
                  {currentRecord.tax_rate_source === 'supplemented' ? '已补录' : '原始'}
                </span>
              </p>
            </div>
            <div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>备注</span>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {currentRecord.tax_rate_remark || '-'}
              </p>
            </div>
          </div>

          {currentRecord.status !== 'supplemented' && (
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>补录税费率</span>
              <div className="flex gap-3 mt-3">
                <input
                  type="number"
                  step="0.01"
                  placeholder="税费率（如 2.50）"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <input
                  type="text"
                  placeholder="备注"
                  value={taxRemark}
                  onChange={(e) => setTaxRemark(e.target.value)}
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={handleSupplement}
                  disabled={!taxRate || loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                  style={{
                    backgroundColor: 'var(--blue)',
                    color: '#fff',
                    opacity: !taxRate || loading ? 0.5 : 1,
                  }}
                >
                  补录
                </button>
              </div>
            </div>
          )}
        </div>

        {isInconsistent && (
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--red)' }}
          >
            <h2
              className="text-base font-medium mb-4 flex items-center gap-2"
              style={{ color: 'var(--red)' }}
            >
              <AlertTriangle size={18} />
              人工修正
            </h2>
            <div className="flex gap-4 mb-4">
              <div
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>来源1：</span>
                <span style={{ color: 'var(--text-primary)' }}>{currentRecord.institution_name_source1}</span>
              </div>
              <div
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>来源2：</span>
                <span style={{ color: 'var(--text-primary)' }}>{currentRecord.institution_name_source2}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={correctField}
                onChange={(e) => setCorrectField(e.target.value as 'source1' | 'source2')}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="source1">修正来源1</option>
                <option value="source2">修正来源2</option>
              </select>
              <input
                type="text"
                placeholder="输入新值"
                value={correctValue}
                onChange={(e) => setCorrectValue(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={handleCorrect}
                disabled={!correctValue || loading}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{
                  backgroundColor: 'var(--orange)',
                  color: '#fff',
                  opacity: !correctValue || loading ? 0.5 : 1,
                }}
              >
                修正
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <h2
            className="text-base font-medium mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <ZoomIn size={18} style={{ color: 'var(--orange)' }} />
            除权日截图
          </h2>
          {screenshotUrl ? (
            <div
              className="rounded-lg overflow-hidden cursor-pointer group relative"
              onClick={() => setShowScreenshot(true)}
              style={{ border: '1px solid var(--border)' }}
            >
              <img
                src={screenshotUrl}
                alt="除权日截图"
                className="w-full h-auto max-h-48 object-cover"
              />
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
              >
                <ZoomIn size={24} style={{ color: '#fff' }} />
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg flex items-center justify-center h-32 text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              暂无截图
            </div>
          )}
        </div>

        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <h2
            className="text-base font-medium mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <Clock size={18} style={{ color: 'var(--blue)' }} />
            操作历史
          </h2>
          {auditLogs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无操作记录</p>
          ) : (
            <div className="relative pl-6">
              <div
                className="absolute left-2 top-1 bottom-1 w-px"
                style={{ backgroundColor: 'var(--border)' }}
              />
              <div className="flex flex-col gap-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div
                      className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: ACTION_COLORS[log.action] || 'var(--text-muted)',
                        border: '2px solid var(--bg-card)',
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{
                            color: ACTION_COLORS[log.action] || 'var(--text-muted)',
                            backgroundColor: `${ACTION_COLORS[log.action] || 'var(--text-muted)'}15`,
                          }}
                        >
                          {log.action}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {log.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showScreenshot && screenshotUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowScreenshot(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowScreenshot(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center z-10"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <X size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <img
              src={screenshotUrl}
              alt="除权日截图"
              className="max-w-full max-h-[90vh] rounded-lg"
              style={{ border: '1px solid var(--border)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
