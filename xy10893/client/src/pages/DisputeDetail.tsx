import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Dispute, Evidence, ExportBatch, AccessRecord, ValidationResult } from '../types'

const typeMap: Record<string, string> = {
  order_screenshot: '订单截图',
  chat_history: '聊天记录',
  operation_log: '操作日志',
  contract: '合同附件',
  other: '其他材料'
}

const batchStatusMap: Record<string, string> = {
  pending: '待打包',
  packing: '打包中',
  ready: '可下载',
  expired: '已过期'
}

const batchBadgeClass: Record<string, string> = {
  pending: 'badge-pending',
  packing: 'badge-processing',
  ready: 'badge-ready',
  expired: 'badge-expired'
}

interface DetailData {
  dispute: Dispute
  evidences: Evidence[]
  batches: ExportBatch[]
  validation: ValidationResult
}

export default function DisputeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEvidences, setSelectedEvidences] = useState<string[]>([])
  const [accessRecords, setAccessRecords] = useState<AccessRecord[]>([])
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null)

  useEffect(() => {
    if (id) {
      fetch(`/api/disputes/${id}`)
        .then(res => res.json())
        .then(data => {
          setData(data)
          setSelectedEvidences(data.evidences.map((e: Evidence) => e.id))
          setLoading(false)
        })
    }
  }, [id])

  const fetchData = () => {
    if (id) {
      fetch(`/api/disputes/${id}`)
        .then(res => res.json())
        .then(data => {
          setData(data)
        })
    }
  }

  const loadAccessRecords = (batchId: string) => {
    fetch(`/api/batches/${batchId}/access-records`)
      .then(res => res.json())
      .then(records => setAccessRecords(records))
  }

  const handleExport = async () => {
    if (!id) return
    
    try {
      const res = await fetch(`/api/disputes/${id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidenceIds: selectedEvidences, operator: '客服' })
      })

      if (res.status === 400) {
        const err = await res.json()
        setMessage({ type: 'error', text: `导出失败: ${err.error}` })
        return
      }

      const result = await res.json()
      if (result.reused) {
        setMessage({ type: 'success', text: '复用已有批次，正在准备下载...' })
      } else {
        setMessage({ type: 'success', text: '已创建导出批次，请等待打包完成...' })
      }
      
      setTimeout(() => {
        fetchData()
        setMessage(null)
      }, 2000)
    } catch (error) {
      setMessage({ type: 'error', text: '导出失败，请重试' })
    }
  }

  const handleReauthorize = async (batchId: string) => {
    try {
      const res = await fetch(`/api/batches/${batchId}/reauthorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: '客服' })
      })

      if (res.ok) {
        setMessage({ type: 'success', text: '重新授权成功，下载链接已续期' })
        setTimeout(() => {
          fetchData()
          setMessage(null)
        }, 2000)
      }
    } catch (error) {
      setMessage({ type: 'error', text: '重新授权失败' })
    }
  }

  const handleDownloadReport = () => {
    if (id) {
      window.open(`/api/disputes/${id}/report`, '_blank')
    }
  }

  const toggleEvidence = (evidenceId: string) => {
    setSelectedEvidences(prev =>
      prev.includes(evidenceId)
        ? prev.filter(id => id !== evidenceId)
        : [...prev, evidenceId]
    )
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (!data) {
    return <div className="card">争议单不存在</div>
  }

  const { dispute, evidences, batches, validation } = data

  return (
    <div>
      <button className="btn mb-4" onClick={() => navigate('/')}>
        ← 返回列表
      </button>

      {message && (
        <div className={`alert ${message.type === 'error' ? 'alert-danger' : 'alert-success'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="card-title" style={{ border: 'none', margin: 0, padding: 0 }}>
              {dispute.orderId} - {dispute.customerName}
            </h2>
            <p className="mt-4" style={{ color: '#6b7280' }}>
              创建时间: {new Date(dispute.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={handleDownloadReport}>
              📄 下载完整报告
            </button>
          </div>
        </div>
      </div>

      {!validation.isValid && (
        <div className="alert alert-warning">
          <strong>⚠️ 材料不完整</strong>
          <ul style={{ marginTop: '8px', marginLeft: '20px' }}>
            {validation.missingEvidence.map(type => (
              <li key={type}>缺少: {typeMap[type] || type}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">📋 证据目录 ({evidences.length})</h3>
          <div>
            {evidences.length === 0 ? (
              <p style={{ color: '#6b7280' }}>暂无证据</p>
            ) : (
              evidences.map(evidence => (
                <div key={evidence.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={evidence.id}
                    checked={selectedEvidences.includes(evidence.id)}
                    onChange={() => toggleEvidence(evidence.id)}
                  />
                  <label htmlFor={evidence.id}>
                    <div>
                      <strong>{evidence.name}</strong>
                      <span className="badge badge-pending" style={{ marginLeft: '8px' }}>
                        {typeMap[evidence.type]}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      来源: {evidence.source} | {evidence.fileSize} bytes
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      SHA256: {evidence.hash.substring(0, 20)}...
                    </div>
                  </label>
                </div>
              ))
            )}
          </div>
          <div className="mt-4">
            <button
              className="btn btn-primary"
              onClick={handleExport}
              disabled={!validation.isValid || selectedEvidences.length === 0}
            >
              📦 导出证据包
            </button>
            {!validation.isValid && (
              <span style={{ marginLeft: '8px', color: '#dc2626', fontSize: '12px' }}>
                材料完整后才能导出
              </span>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">📦 导出批次 ({batches.length})</h3>
          {batches.length === 0 ? (
            <p style={{ color: '#6b7280' }}>暂无导出批次</p>
          ) : (
            <div>
              {batches.map(batch => (
                <div
                  key={batch.id}
                  style={{
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className={`badge ${batchBadgeClass[batch.status]}`}>
                        {batchStatusMap[batch.status]}
                      </span>
                      <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                        {batch.evidenceIds.length} 个证据
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {batch.status === 'ready' && batch.downloadUrl && (
                        <a
                          href={batch.downloadUrl}
                          className="btn btn-success"
                          style={{ fontSize: '12px', padding: '4px 12px', textDecoration: 'none' }}
                          download
                        >
                          下载
                        </a>
                      )}
                      {batch.status === 'expired' && (
                        <button
                          className="btn btn-warning"
                          style={{ fontSize: '12px', padding: '4px 12px' }}
                          onClick={() => handleReauthorize(batch.id)}
                        >
                          重新授权
                        </button>
                      )}
                      <button
                        className="btn"
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => loadAccessRecords(batch.id)}
                      >
                        领取记录
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                    创建: {new Date(batch.createdAt).toLocaleString('zh-CN')}
                    <br />
                    过期: {new Date(batch.expiresAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {accessRecords.length > 0 && (
        <div className="card">
          <h3 className="card-title">📝 领取记录</h3>
          <table className="table">
            <thead>
              <tr>
                <th>操作人</th>
                <th>操作类型</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {accessRecords.map(record => (
                <tr key={record.id}>
                  <td>{record.operator}</td>
                  <td>
                    {record.action === 'download' ? '下载' : 
                     record.action === 'view' ? '查看' : '重新授权'}
                  </td>
                  <td>{new Date(record.accessedAt).toLocaleString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
