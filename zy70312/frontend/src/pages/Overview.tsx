import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardAPI } from '../api/client'
import { getStatusBadgeClass, getDecisionBadgeClass, statusLabelMap, decisionLabelMap, formatPercent, getProgressColor } from '../utils'
import type { ServiceDashboard } from '../types'

export default function Overview() {
  const [overview, setOverview] = useState<ServiceDashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)
  
  const fetchData = async () => {
    try {
      const data = await dashboardAPI.getOverview()
      setOverview(data)
    } catch (error) {
      console.error('Failed to fetch overview:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])
  
  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }
  
  const stats = {
    total: overview.length,
    healthy: overview.filter(s => s.status === 'healthy').length,
    warning: overview.filter(s => s.status === 'warning').length,
    critical: overview.filter(s => s.status === 'critical').length,
    frozen: overview.filter(s => s.status === 'frozen').length,
    missing: overview.filter(s => s.status === 'missing_metrics').length,
  }
  
  const filteredOverview = filterStatus === 'all' 
    ? overview 
    : overview.filter(s => s.status === filterStatus)
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">服务概览</h2>
        <div className="flex items-center space-x-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">全部状态</option>
            <option value="healthy">健康</option>
            <option value="warning">警告</option>
            <option value="critical">严重</option>
            <option value="frozen">已冻结</option>
            <option value="missing_metrics">指标缺失</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
          >
            <svg className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="总服务数" value={stats.total} color="#165DFF" />
        <StatCard label="健康" value={stats.healthy} color="#00B42A" />
        <StatCard label="警告" value={stats.warning} color="#FF7D00" />
        <StatCard label="严重" value={stats.critical} color="#F53F3F" />
        <StatCard label="已冻结" value={stats.frozen} color="#CB2634" />
        <StatCard label="指标缺失" value={stats.missing} color="#86909C" />
      </div>
      
      {loading ? (
        <div className="card p-8 text-center text-gray-500">
          加载中...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOverview.map(item => (
            <ServiceCard key={item.service.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function ServiceCard({ item }: { item: ServiceDashboard }) {
  const budgetPercent = item.consumption?.remainingPercent ?? 0
  
  return (
    <Link to={`/services/${item.service.id}`} className="block">
      <div className="card p-5 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{item.service.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{item.service.description}</p>
            <p className="text-xs text-gray-400 mt-1">负责人: {item.service.owner}</p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={getStatusBadgeClass(item.status)}>
              {statusLabelMap[item.status]}
            </span>
            <span className={getDecisionBadgeClass(item.decision)}>
              {decisionLabelMap[item.decision]}
            </span>
          </div>
        </div>
        
        {item.consumption && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">错误预算剩余</span>
              <span className="font-medium" style={{ color: getProgressColor(budgetPercent) }}>
                {formatPercent(budgetPercent)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="h-2.5 rounded-full transition-all"
                style={{ 
                  width: `${budgetPercent}%`,
                  backgroundColor: getProgressColor(budgetPercent)
                }}
              />
            </div>
          </div>
        )}
        
        <div className="flex items-center space-x-4 text-sm">
          {item.consumption && (
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              燃烧速度: <span className="font-medium ml-1">{item.consumption.burnRate.toFixed(2)}x</span>
            </div>
          )}
          
          {item.activeFreezes.length > 0 && (
            <div className="flex items-center text-red-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              发布冻结中
            </div>
          )}
          
          {item.hasActiveException && (
            <div className="flex items-center text-orange-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              有例外审批
            </div>
          )}
          
          {item.metricsGap?.hasGap && (
            <div className="flex items-center text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              指标缺失
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
