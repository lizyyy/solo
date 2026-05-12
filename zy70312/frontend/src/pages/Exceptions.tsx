import { useState, useEffect } from 'react'
import { dashboardAPI } from '../api/client'
import { formatTime, exceptionStatusLabelMap } from '../utils'
import type { ExceptionApproval } from '../types'

export default function Exceptions() {
  const [exceptions, setExceptions] = useState<ExceptionApproval[]>([])
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [exc, svc] = await Promise.all([
          dashboardAPI.getExceptions(),
          dashboardAPI.getServices(),
        ])
        setExceptions(exc)
        setServices(svc.map(s => ({ id: s.id, name: s.name })))
      } catch (error) {
        console.error('Failed to fetch exceptions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])
  
  const handleApprove = async (id: string) => {
    try {
      await dashboardAPI.approveException(id, 'SRE')
      const updated = await dashboardAPI.getExceptions()
      setExceptions(updated)
    } catch (error) {
      console.error('Failed to approve exception:', error)
    }
  }
  
  const handleReject = async (id: string) => {
    try {
      await dashboardAPI.rejectException(id, 'SRE')
      const updated = await dashboardAPI.getExceptions()
      setExceptions(updated)
    } catch (error) {
      console.error('Failed to reject exception:', error)
    }
  }
  
  const getServiceName = (id: string) => {
    return services.find(s => s.id === id)?.name || id
  }
  
  const filteredExceptions = filter === 'all' 
    ? exceptions 
    : exceptions.filter(e => e.status === filter)
  
  if (loading) {
    return <div className="card p-8 text-center text-gray-500">加载中...</div>
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">例外审批管理</h2>
          <p className="text-gray-500 mt-1">管理发布冻结期间的例外审批申请</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全部状态</option>
            <option value="pending">待审批</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
            <option value="expired">已过期</option>
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建申请
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="待审批" count={exceptions.filter(e => e.status === 'pending').length} color="#FF7D00" />
        <StatCard label="已通过" count={exceptions.filter(e => e.status === 'approved').length} color="#00B42A" />
        <StatCard label="已拒绝" count={exceptions.filter(e => e.status === 'rejected').length} color="#F53F3F" />
        <StatCard label="已过期" count={exceptions.filter(e => e.status === 'expired').length} color="#86909C" />
      </div>
      
      <div className="card overflow-hidden">
        {filteredExceptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            暂无例外审批记录
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredExceptions.map(exc => (
              <div key={exc.id} className="p-5">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-medium text-gray-900">{getServiceName(exc.serviceId)}</span>
                      <span className="text-sm text-gray-500">发布: {exc.releaseId}</span>
                      <span className={`status-badge ${
                        exc.status === 'approved' ? 'bg-green-100 text-green-800' :
                        exc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        exc.status === 'expired' ? 'bg-gray-200 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exceptionStatusLabelMap[exc.status]}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2">{exc.reason}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>申请人: {exc.requestedBy}</span>
                      {exc.approvedBy && <span>审批人: {exc.approvedBy}</span>}
                      <span>申请时间: {formatTime(exc.createdAt)}</span>
                      <span>有效期至: {formatTime(exc.expiresAt)}</span>
                    </div>
                  </div>
                  {exc.status === 'pending' && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleApprove(exc.id)}
                        className="btn btn-primary btn-sm"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReject(exc.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        拒绝
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {showCreateModal && (
        <CreateModal 
          services={services}
          onClose={() => setShowCreateModal(false)}
          onSuccess={async () => { 
            setShowCreateModal(false)
            const updated = await dashboardAPI.getExceptions()
            setExceptions(updated)
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{count}</div>
    </div>
  )
}

function CreateModal({ 
  services, onClose, onSuccess 
}: { 
  services: { id: string; name: string }[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    serviceId: services[0]?.id || '',
    releaseId: '',
    reason: '',
    requestedBy: '',
    expiresInHours: 4,
  })
  const [submitting, setSubmitting] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await dashboardAPI.createException(form)
      onSuccess()
    } catch (error) {
      console.error('Failed to create exception:', error)
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">新建例外审批</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">服务</label>
            <select
              value={form.serviceId}
              onChange={e => setForm({ ...form, serviceId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">发布编号</label>
            <input
              type="text"
              value={form.releaseId}
              onChange={e => setForm({ ...form, releaseId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="例如: RELEASE-20260512-001"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请人</label>
            <input
              type="text"
              value={form.requestedBy}
              onChange={e => setForm({ ...form, requestedBy: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="您的姓名"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">有效期(小时)</label>
            <input
              type="number"
              value={form.expiresInHours}
              onChange={e => setForm({ ...form, expiresInHours: parseInt(e.target.value) || 4 })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              min={1}
              max={72}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">原因说明</label>
            <textarea
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="请详细说明需要例外审批的原因..."
              required
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
              {submitting ? '提交中...' : '提交申请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
