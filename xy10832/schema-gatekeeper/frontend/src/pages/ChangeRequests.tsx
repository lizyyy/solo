import { useEffect, useState } from 'react'
import { changeRequestApi, ChangeRequest, schemaApi, SchemaVersion, statusHistoryApi, StatusHistory } from '../api'
import { exportApi } from '../api'

const ChangeRequests = () => {
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [schemas, setSchemas] = useState<SchemaVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null)
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [newRequest, setNewRequest] = useState({
    schema_id: 0,
    title: '',
    change_type: '',
    created_by: '',
    old_schema: '',
    new_schema: '',
  })

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [requestsRes, schemasRes] = await Promise.all([
        changeRequestApi.getAll(statusFilter ? { status: statusFilter } : undefined),
        schemaApi.getAll(),
      ])
      setRequests(requestsRes.data)
      setSchemas(schemasRes.data)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRequest = async () => {
    try {
      await changeRequestApi.create({
        ...newRequest,
        old_schema: JSON.parse(newRequest.old_schema),
        new_schema: JSON.parse(newRequest.new_schema),
      })
      setShowModal(false)
      setNewRequest({
        schema_id: 0,
        title: '',
        change_type: '',
        created_by: '',
        old_schema: '',
        new_schema: '',
      })
      loadData()
    } catch (error) {
      console.error('Failed to create request:', error)
      alert('创建失败，请检查输入')
    }
  }

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await changeRequestApi.updateStatus(id, { status, approved_by: 'admin' })
      loadData()
    } catch (error: any) {
      alert(error.response?.data?.detail || '状态更新失败')
    }
  }

  const handleExportImpact = async (requestId: number) => {
    try {
      const response = await exportApi.impactReport(requestId)
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `impact-report-${requestId}.xlsx`)
      document.body.appendChild(link)
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const loadStatusHistory = async (requestId: number) => {
    setHistoryLoading(true)
    try {
      const response = await statusHistoryApi.getByChangeRequestId(requestId)
      setStatusHistory(response.data)
      setShowHistoryModal(true)
    } catch (error) {
      console.error('Failed to load status history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      blocked: 'status-blocked',
      deployed: 'status-pending',
      completed: 'status-approved',
    }
    return statusMap[status] || 'status-pending'
  }

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      pending: '待处理',
      approved: '已批准',
      rejected: '已拒绝',
      blocked: '已阻塞',
      deployed: '已部署',
      completed: '已完成',
    }
    return labelMap[status] || status
  }

  const getAvailableTransitions = (status: string) => {
    const transitions: Record<string, string[]> = {
      pending: ['approved', 'rejected', 'blocked'],
      blocked: ['approved', 'rejected'],
      approved: ['deployed'],
      deployed: ['completed'],
      rejected: ['pending'],
    }
    return transitions[status] || []
  }

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">变更申请</h1>
        <div className="flex gap-4">
          <select
            className="px-4 py-2 border rounded-lg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
            <option value="blocked">已阻塞</option>
          </select>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            + 新建变更
          </button>
        </div>
      </div>

      <div className="card">
        {requests.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>申请ID</th>
                  <th>标题</th>
                  <th>兼容性</th>
                  <th>状态</th>
                  <th>创建人</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td className="font-mono text-blue-600">{req.request_id}</td>
                    <td>
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="text-left hover:text-blue-600"
                      >
                        {req.title}
                      </button>
                    </td>
                    <td>
                      {req.compatibility_result ? (
                        req.compatibility_result.is_compatible ? (
                          <span className="text-green-600 font-medium">✓ 兼容</span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            ✗ {req.compatibility_result.breaking_changes.length}个破坏性变更
                          </span>
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>{req.created_by || '-'}</td>
                    <td>{new Date(req.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        {getAvailableTransitions(req.status).map((targetStatus) => (
                          <button
                            key={targetStatus}
                            onClick={() => handleStatusUpdate(req.id, targetStatus)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            {targetStatus === 'approved' ? '批准' :
                             targetStatus === 'rejected' ? '拒绝' :
                             targetStatus === 'blocked' ? '阻塞' :
                             targetStatus === 'deployed' ? '部署' :
                             targetStatus === 'completed' ? '完成' : targetStatus}
                          </button>
                        ))}
                        <button
                          onClick={() => handleExportImpact(req.id)}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          导出影响报告
                        </button>
                        <button
                          onClick={() => loadStatusHistory(req.id)}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        >
                          历史轨迹
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">暂无变更申请</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">新建变更申请</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">关联 Schema</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newRequest.schema_id}
                  onChange={(e) => setNewRequest({ ...newRequest, schema_id: Number(e.target.value) })}
                >
                  <option value={0}>请选择 Schema</option>
                  {schemas.map((s) => (
                    <option key={s.id} value={s.id}>{s.schema_name} v{s.version}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">标题</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">变更类型</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newRequest.change_type}
                  onChange={(e) => setNewRequest({ ...newRequest, change_type: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">创建人</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  value={newRequest.created_by}
                  onChange={(e) => setNewRequest({ ...newRequest, created_by: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">旧 Schema (JSON 格式，例如: {`{"user_id": {"type": "string", "required": true}}`})</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  rows={4}
                  value={newRequest.old_schema}
                  onChange={(e) => setNewRequest({ ...newRequest, old_schema: e.target.value })}
                  placeholder='{"fields": {"user_id": {"type": "string", "required": true}}}'
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">新 Schema (JSON 格式)</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  rows={4}
                  value={newRequest.new_schema}
                  onChange={(e) => setNewRequest({ ...newRequest, new_schema: e.target.value })}
                  placeholder='{"fields": {"user_id": {"type": "string", "required": true}, "email": {"type": "string", "required": false}}}'
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleCreateRequest} className="btn btn-primary">
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">{selectedRequest.title}</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">申请ID:</span>
                <span className="ml-2 font-mono">{selectedRequest.request_id}</span>
              </div>

              <div>
                <span className="text-sm text-gray-500">状态:</span>
                <span className={`ml-2 status-badge ${getStatusClass(selectedRequest.status)}`}>
                  {selectedRequest.status}
                </span>
              </div>

              {selectedRequest.compatibility_result && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-2">兼容性检测结果</h3>
                  
                  {selectedRequest.compatibility_result.breaking_changes.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-red-600 font-medium mb-1">破坏性变更:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {selectedRequest.compatibility_result.breaking_changes.map((c, i) => (
                          <li key={i} className="text-red-700">{c.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRequest.compatibility_result.warnings.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-yellow-600 font-medium mb-1">警告:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {selectedRequest.compatibility_result.warnings.map((w, i) => (
                          <li key={i} className="text-yellow-700">{w.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedRequest.compatibility_result.affected_consumers.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-orange-600 font-medium mb-1">受影响消费者:</h4>
                      <ul className="list-disc list-inside text-sm">
                        {selectedRequest.compatibility_result.affected_consumers.map((c, i) => (
                          <li key={i} className="text-orange-700">{c.consumer_name} ({c.team || '未知团队'})</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h4 className="text-blue-600 font-medium mb-1">建议:</h4>
                    <ul className="list-disc list-inside text-sm">
                      {selectedRequest.compatibility_result.recommendations.map((r, i) => (
                        <li key={i} className="text-blue-700">{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">状态历史轨迹</h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-8">加载中...</div>
            ) : statusHistory.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-6">
                  {statusHistory.map((history, index) => (
                    <div key={history.id} className="relative pl-10">
                      <div className={`absolute left-2 top-1 w-5 h-5 rounded-full border-2 bg-white ${
                        history.to_status === 'approved' || history.to_status === 'completed' 
                          ? 'border-green-500 bg-green-100' 
                          : history.to_status === 'rejected' 
                            ? 'border-red-500 bg-red-100' 
                            : history.to_status === 'blocked' 
                              ? 'border-orange-500 bg-orange-100' 
                              : 'border-blue-500 bg-blue-100'
                      }`}>
                        <div className="w-full h-full flex items-center justify-center text-xs">
                          {index === 0 ? '✓' : '•'}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`status-badge ${getStatusClass(history.to_status)}`}>
                            {getStatusLabel(history.to_status)}
                          </span>
                          {history.from_status && (
                            <span className="text-sm text-gray-500">
                              ← 从 {getStatusLabel(history.from_status)} 变更
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 space-y-1">
                          {history.changed_by && (
                            <div>
                              <span className="font-medium">操作人:</span> {history.changed_by}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">时间:</span> {new Date(history.changed_at).toLocaleString('zh-CN')}
                          </div>
                          {history.comments && (
                            <div>
                              <span className="font-medium">备注:</span> {history.comments}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">暂无状态历史记录</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChangeRequests
