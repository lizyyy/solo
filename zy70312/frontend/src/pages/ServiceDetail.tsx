import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { dashboardAPI } from '../api/client'
import { 
  getStatusBadgeClass, getDecisionBadgeClass, statusLabelMap, decisionLabelMap, 
  formatPercent, getProgressColor, formatDateTime, freezeReasonLabelMap 
} from '../utils'
import type { DetailedDashboard } from '../types'

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<DetailedDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [showFreezeModal, setShowFreezeModal] = useState(false)
  
  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getServiceDetail(id)
        setDetail(data)
      } catch (error) {
        console.error('Failed to fetch service detail:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [id])
  
  if (loading) {
    return <div className="card p-8 text-center text-gray-500">加载中...</div>
  }
  
  if (!detail) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-500 mb-4">服务不存在</p>
        <button onClick={() => navigate('/')} className="btn btn-primary">
          返回概览
        </button>
      </div>
    )
  }
  
  const budgetPercent = detail.consumption?.remainingPercent ?? 0
  
  const trendOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['错误率(%)', '预算剩余(%)', '燃烧速度(x)'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: detail.trend.map(t => formatDateTime(t.timestamp)),
    },
    yAxis: [
      { type: 'value', name: '百分比(%)', max: 100 },
      { type: 'value', name: '燃烧速度(x)' },
    ],
    series: [
      {
        name: '错误率(%)',
        type: 'line',
        smooth: true,
        data: detail.trend.map(t => t.errorRate),
        itemStyle: { color: '#F53F3F' },
        areaStyle: { opacity: 0.1 },
      },
      {
        name: '预算剩余(%)',
        type: 'line',
        smooth: true,
        data: detail.trend.map(t => t.budgetRemaining),
        itemStyle: { color: '#00B42A' },
        yAxisIndex: 0,
      },
      {
        name: '燃烧速度(x)',
        type: 'line',
        smooth: true,
        data: detail.trend.map(t => t.burnRate),
        itemStyle: { color: '#FF7D00' },
        yAxisIndex: 1,
      },
    ],
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <button onClick={() => navigate('/')} className="btn btn-secondary btn-sm">
          ← 返回
        </button>
        <h2 className="text-2xl font-bold text-gray-900">{detail.service.name}</h2>
        <span className={getStatusBadgeClass(detail.status)}>
          {statusLabelMap[detail.status]}
        </span>
        <span className={getDecisionBadgeClass(detail.decision)}>
          {decisionLabelMap[detail.decision]}
        </span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-2">服务信息</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">名称</span>
              <span className="font-medium">{detail.service.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">负责人</span>
              <span className="font-medium">{detail.service.owner}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">描述</span>
              <span className="font-medium text-right max-w-[60%]">{detail.service.description}</span>
            </div>
          </div>
        </div>
        
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-2">错误预算</h3>
          {detail.consumption ? (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">剩余</span>
                  <span className="font-medium" style={{ color: getProgressColor(budgetPercent) }}>
                    {formatPercent(budgetPercent)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="h-3 rounded-full transition-all"
                    style={{ 
                      width: `${budgetPercent}%`,
                      backgroundColor: getProgressColor(budgetPercent)
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">燃烧速度</span>
                <span className="font-medium">{detail.consumption.burnRate.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">燃烧等级</span>
                <span className={`font-medium ${
                  detail.consumption.burnRateLevel === 'critical' ? 'text-red-600' :
                  detail.consumption.burnRateLevel === 'warning' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {detail.consumption.burnRateLevel === 'critical' ? '严重' :
                   detail.consumption.burnRateLevel === 'warning' ? '警告' : '正常'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">无预算数据</p>
          )}
        </div>
        
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-2">操作</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setShowExceptionModal(true)}
              className="w-full btn btn-secondary btn-sm justify-center"
            >
              申请例外审批
            </button>
            {detail.status === 'frozen' ? (
              <button 
                onClick={async () => {
                  if (detail.activeFreezes.length > 0) {
                    await dashboardAPI.liftFreeze(detail.activeFreezes[0].id, 'SRE')
                    window.location.reload()
                  }
                }}
                className="w-full btn btn-secondary btn-sm justify-center"
              >
                解除冻结
              </button>
            ) : (
              <button 
                onClick={() => setShowFreezeModal(true)}
                className="w-full btn btn-danger btn-sm justify-center"
              >
                手动冻结
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">原因分析</h3>
          <ul className="space-y-2">
            {detail.reasons.map((reason, i) => (
              <li key={i} className="flex items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 mr-2 flex-shrink-0"></span>
                <span className="text-gray-700">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">操作建议</h3>
          <ul className="space-y-2">
            {detail.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start">
                <svg className="w-4 h-4 text-primary mt-1 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-gray-700">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {detail.activeFreezes.length > 0 && (
        <div className="card p-5 border-l-4 border-l-red-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">发布冻结记录</h3>
          {detail.activeFreezes.map(freeze => (
            <div key={freeze.id} className="bg-red-50 p-4 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <span className="font-medium text-red-800">
                  {freezeReasonLabelMap[freeze.reason] || freeze.reason}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDateTime(freeze.createdAt)}
                </span>
              </div>
              <p className="text-gray-700">{freeze.reasonDetail}</p>
              <p className="text-sm text-gray-500 mt-2">触发者: {freeze.triggeredBy}</p>
            </div>
          ))}
        </div>
      )}
      
      {detail.trend.length > 0 && (
        <div className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">趋势图表</h3>
          <ReactECharts option={trendOption} style={{ height: '400px' }} />
        </div>
      )}
      
      {showExceptionModal && (
        <ExceptionModal 
          serviceId={id!} 
          onClose={() => setShowExceptionModal(false)}
          onSuccess={() => { setShowExceptionModal(false); window.location.reload(); }}
        />
      )}
      
      {showFreezeModal && (
        <FreezeModal 
          serviceId={id!} 
          onClose={() => setShowFreezeModal(false)}
          onSuccess={() => { setShowFreezeModal(false); window.location.reload(); }}
        />
      )}
    </div>
  )
}

function ExceptionModal({ 
  serviceId, onClose, onSuccess 
}: { 
  serviceId: string; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
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
      await dashboardAPI.createException({ ...form, serviceId })
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
        <h3 className="text-lg font-semibold mb-4">申请例外审批</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
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

function FreezeModal({ 
  serviceId, onClose, onSuccess 
}: { 
  serviceId: string; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    reason: 'manual',
    reasonDetail: '',
  })
  const [submitting, setSubmitting] = useState(false)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await dashboardAPI.createFreeze({ ...form, serviceId })
      onSuccess()
    } catch (error) {
      console.error('Failed to create freeze:', error)
    } finally {
      setSubmitting(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">手动冻结发布</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">冻结原因</label>
            <select
              value={form.reason}
              onChange={e => setForm({ ...form, reason: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="manual">手动冻结</option>
              <option value="budget_exhausted">预算耗尽</option>
              <option value="rapid_burn">快速燃烧</option>
              <option value="sustained_burn">持续燃烧</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">详细说明</label>
            <textarea
              value={form.reasonDetail}
              onChange={e => setForm({ ...form, reasonDetail: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              rows={3}
              placeholder="请详细说明冻结发布的原因..."
              required
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              取消
            </button>
            <button type="submit" disabled={submitting} className="btn btn-danger btn-sm">
              {submitting ? '提交中...' : '确认冻结'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
