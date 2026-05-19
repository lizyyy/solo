import { useEffect, useState } from 'react'
import { interceptRecordApi, InterceptRecord } from '../api'
import { exportApi } from '../api'

const InterceptRecords = () => {
  const [records, setRecords] = useState<InterceptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [resolveModal, setResolveModal] = useState<{ id: number; resolved_by: string; resolution_note: string } | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<InterceptRecord | null>(null)

  useEffect(() => {
    loadRecords()
  }, [statusFilter])

  const loadRecords = async () => {
    setLoading(true)
    try {
      const response = await interceptRecordApi.getAll(statusFilter ? { status: statusFilter } : undefined)
      setRecords(response.data)
    } catch (error) {
      console.error('Failed to load records:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!resolveModal) return
    
    try {
      await interceptRecordApi.resolve(resolveModal.id, {
        resolved_by: resolveModal.resolved_by,
        resolution_note: resolveModal.resolution_note,
      })
      setResolveModal(null)
      loadRecords()
    } catch (error) {
      console.error('Failed to resolve record:', error)
    }
  }

  const handleExportAll = async () => {
    try {
      const response = await exportApi.interceptRecords(statusFilter || undefined)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `intercept-records-${Date.now()}.xlsx`)
      document.body.appendChild(link)
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      open: 'status-open',
      resolved: 'status-resolved',
    }
    return statusMap[status] || 'status-open'
  }

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600'
      case 'warning': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">异常队列</h1>
        <div className="flex gap-4">
          <select
            className="px-4 py-2 border rounded-lg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="open">待解决</option>
            <option value="resolved">已解决</option>
          </select>
          <button onClick={handleExportAll} className="btn btn-success">
            导出全部
          </button>
        </div>
      </div>

      <div className="card">
        {records.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>变更申请ID</th>
                  <th>拦截原因</th>
                  <th>严重程度</th>
                  <th>状态</th>
                  <th>拦截时间</th>
                  <th>解决人</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="font-mono">#{record.id}</td>
                    <td className="font-mono text-blue-600">CR-{record.change_request_id}</td>
                    <td className="max-w-xs truncate">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="text-left hover:text-blue-600"
                      >
                        {record.reason}
                      </button>
                    </td>
                    <td>
                      <span className={getSeverityClass(record.severity)}>{record.severity}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>{new Date(record.intercept_time).toLocaleString('zh-CN')}</td>
                    <td>{record.resolved_by || '-'}</td>
                    <td>
                      <div className="flex gap-2">
                        {record.status === 'open' && (
                          <button
                            onClick={() => setResolveModal({ id: record.id, resolved_by: '', resolution_note: '' })}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            解决
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          详情
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无异常记录</p>
        )}
      </div>

      {resolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">解决异常</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">解决人</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={resolveModal.resolved_by}
                  onChange={(e) => setResolveModal({ ...resolveModal, resolved_by: e.target.value })}
                  placeholder="输入解决人名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">解决说明</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  value={resolveModal.resolution_note}
                  onChange={(e) => setResolveModal({ ...resolveModal, resolution_note: e.target.value })}
                  placeholder="输入解决说明"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setResolveModal(null)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleResolve} className="btn btn-primary">
                确认解决
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">异常详情</h2>
              <button onClick={() => setSelectedRecord(null)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">拦截ID:</span>
                  <span className="ml-2 font-mono">#{selectedRecord.id}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">状态:</span>
                  <span className={`ml-2 status-badge ${getStatusClass(selectedRecord.status)}`}>
                    {selectedRecord.status}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">变更申请ID:</span>
                  <span className="ml-2 font-mono">CR-{selectedRecord.change_request_id}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">严重程度:</span>
                  <span className={`ml-2 ${getSeverityClass(selectedRecord.severity)}`}>
                    {selectedRecord.severity}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">拦截时间:</span>
                  <span className="ml-2">{new Date(selectedRecord.intercept_time).toLocaleString('zh-CN')}</span>
                </div>
                {selectedRecord.resolved_at && (
                  <div>
                    <span className="text-sm text-gray-500">解决时间:</span>
                    <span className="ml-2">{new Date(selectedRecord.resolved_at).toLocaleString('zh-CN')}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-sm text-gray-500">拦截原因:</span>
                <p className="mt-1">{selectedRecord.reason}</p>
              </div>

              {selectedRecord.resolution_note && (
                <div>
                  <span className="text-sm text-gray-500">解决说明:</span>
                  <p className="mt-1">{selectedRecord.resolution_note}</p>
                </div>
              )}

              {selectedRecord.failed_sample && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-2">失败样例</h3>
                  <pre className="text-xs overflow-x-auto bg-gray-800 text-green-400 p-3 rounded">
                    {JSON.stringify(selectedRecord.failed_sample, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InterceptRecords
