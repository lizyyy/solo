import { useState, useEffect } from "react"
import { AlertTriangle, Download, Filter, CheckCircle, Clock, XCircle, Thermometer, Navigation, Search, RefreshCw } from "lucide-react"
import * as XLSX from "xlsx"
import type { AnomalyRecord } from "@/types"
import { cn } from "@/lib/utils"

const mockAnomalies: AnomalyRecord[] = [
  { id: '1', sensorId: 'SENS-001', anomalyType: 'temperature_abnormal', temperature: 35.2, threshold: 30, detectedTime: '2024-01-15 10:30', status: 'pending', remark: '温度超出正常范围' },
  { id: '2', sensorId: 'SENS-002', anomalyType: 'temperature_abnormal', temperature: 32.8, threshold: 30, detectedTime: '2024-01-15 10:35', status: 'resolved', remark: '已确认传感器异常，已更换' },
  { id: '3', sensorId: 'SENS-003', anomalyType: 'direction_invalid', direction: 'INVALID', detectedTime: '2024-01-15 11:00', status: 'pending', remark: '方向值无效' },
  { id: '4', sensorId: 'SENS-004', anomalyType: 'sensor_missing', detectedTime: '2024-01-15 11:15', status: 'ignored', remark: '传感器离线' },
  { id: '5', sensorId: 'SENS-005', anomalyType: 'temperature_abnormal', temperature: 31.5, threshold: 30, detectedTime: '2024-01-15 11:30', status: 'pending', remark: '温度超出正常范围' },
  { id: '6', sensorId: 'SENS-006', anomalyType: 'direction_invalid', direction: 'UNKNOWN', detectedTime: '2024-01-15 12:00', status: 'resolved', remark: '已修正方向值为 UP' },
  { id: '7', sensorId: 'SENS-007', anomalyType: 'temperature_abnormal', temperature: 34.1, threshold: 30, detectedTime: '2024-01-15 12:30', status: 'pending', remark: '温度超出正常范围' },
  { id: '8', sensorId: 'SENS-008', anomalyType: 'sensor_missing', detectedTime: '2024-01-15 13:00', status: 'pending', remark: '传感器无数据' },
  { id: '9', sensorId: 'SENS-009', anomalyType: 'direction_invalid', direction: 'ERR', detectedTime: '2024-01-15 13:30', status: 'pending', remark: '方向值错误' },
  { id: '10', sensorId: 'SENS-010', anomalyType: 'temperature_abnormal', temperature: 36.0, threshold: 30, detectedTime: '2024-01-15 14:00', status: 'resolved', remark: '环境温度影响，已确认' },
]

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchAnomalies()
  }, [])

  const fetchAnomalies = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/anomalies')
      if (response.ok) {
        const data = await response.json() as AnomalyRecord[]
        setAnomalies(data)
      } else {
        setAnomalies(mockAnomalies)
      }
    } catch {
      setAnomalies(mockAnomalies)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (anomalyId: string, newStatus: 'pending' | 'resolved' | 'ignored') => {
    try {
      const response = await fetch(`/api/anomalies/${anomalyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        setAnomalies(prev => prev.map(a =>
          a.id === anomalyId ? { ...a, status: newStatus } : a
        ))
      }
    } catch {
      setAnomalies(prev => prev.map(a =>
        a.id === anomalyId ? { ...a, status: newStatus } : a
      ))
    }
  }

  const handleExport = () => {
    setExporting(true)
    try {
      const exportData = filteredAnomalies.map(a => ({
        '传感器编号': a.sensorId,
        '异常类型': getTypeLabel(a.anomalyType),
        '温度': a.temperature || '-',
        '方向': a.direction || '-',
        '阈值': a.threshold || '-',
        '检测时间': a.detectedTime,
        '状态': getStatusLabel(a.status),
        '备注': a.remark || '',
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '异常工况')
      XLSX.writeFile(workbook, `异常工况表_${new Date().toISOString().split('T')[0]}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  const filteredAnomalies = anomalies.filter(anomaly => {
    const matchesSearch = anomaly.sensorId.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || anomaly.status === statusFilter
    const matchesType = typeFilter === 'all' || anomaly.anomalyType === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const groupedAnomalies = {
    temperature_abnormal: filteredAnomalies.filter(a => a.anomalyType === 'temperature_abnormal'),
    direction_invalid: filteredAnomalies.filter(a => a.anomalyType === 'direction_invalid'),
    sensor_missing: filteredAnomalies.filter(a => a.anomalyType === 'sensor_missing'),
  }

  const stats = {
    total: anomalies.length,
    pending: anomalies.filter(a => a.status === 'pending').length,
    resolved: anomalies.filter(a => a.status === 'resolved').length,
    ignored: anomalies.filter(a => a.status === 'ignored').length,
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'temperature_abnormal':
        return <Thermometer className="w-5 h-5" />
      case 'direction_invalid':
        return <Navigation className="w-5 h-5" />
      case 'sensor_missing':
        return <AlertTriangle className="w-5 h-5" />
      default:
        return <AlertTriangle className="w-5 h-5" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'temperature_abnormal':
        return '温度异常'
      case 'direction_invalid':
        return '方向无效'
      case 'sensor_missing':
        return '传感器缺失'
      default:
        return type
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'ignored':
        return 'bg-gray-100 text-gray-600 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return '待处理'
      case 'resolved':
        return '已解决'
      case 'ignored':
        return '已忽略'
      default:
        return status
    }
  }

  const renderAnomalyTable = (anomalyList: AnomalyRecord[], title: string, color: string) => {
    if (anomalyList.length === 0) return null

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-100 ${color}`}>
          <div className="flex items-center gap-3">
            {getTypeIcon(anomalyList[0].anomalyType)}
            <span className="font-semibold">{title}</span>
            <span className="px-2 py-0.5 bg-white/80 rounded text-sm">{anomalyList.length} 条</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">检测时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {anomalyList.map((anomaly) => (
                <tr key={anomaly.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">{anomaly.sensorId}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {anomaly.anomalyType === 'temperature_abnormal' && (
                      <span>当前 {anomaly.temperature}°C / 阈值 {anomaly.threshold}°C</span>
                    )}
                    {anomaly.anomalyType === 'direction_invalid' && (
                      <span>方向值: {anomaly.direction}</span>
                    )}
                    {anomaly.anomalyType === 'sensor_missing' && (
                      <span>传感器无数据</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{anomaly.detectedTime}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium border",
                      getStatusStyle(anomaly.status)
                    )}>
                      {getStatusLabel(anomaly.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{anomaly.remark}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {anomaly.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(anomaly.id, 'resolved')}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="标记已解决"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(anomaly.id, 'ignored')}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            title="忽略"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {anomaly.status === 'resolved' && (
                        <button
                          onClick={() => handleStatusChange(anomaly.id, 'pending')}
                          className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="重新打开"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      {anomaly.status === 'ignored' && (
                        <button
                          onClick={() => handleStatusChange(anomaly.id, 'pending')}
                          className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="重新打开"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">异常工况表</h2>
          <p className="text-gray-500 mt-1">查看和处理系统检测到的异常工况</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1B2A4A] text-white rounded-xl hover:bg-[#1B2A4A]/90 transition-colors disabled:opacity-50"
        >
          <Download className="w-5 h-5" />
          {exporting ? '导出中...' : '导出Excel'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">异常总数</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已解决</p>
              <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已忽略</p>
              <p className="text-2xl font-bold text-gray-600">{stats.ignored}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索传感器编号..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
            >
              <option value="all">全部类型</option>
              <option value="temperature_abnormal">温度异常</option>
              <option value="direction_invalid">方向无效</option>
              <option value="sensor_missing">传感器缺失</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
            >
              <option value="all">全部状态</option>
              <option value="pending">待处理</option>
              <option value="resolved">已解决</option>
              <option value="ignored">已忽略</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          加载中...
        </div>
      ) : filteredAnomalies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">暂无异常记录</p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderAnomalyTable(groupedAnomalies.temperature_abnormal, '温度异常', 'bg-red-50 text-red-700')}
          {renderAnomalyTable(groupedAnomalies.direction_invalid, '方向无效', 'bg-orange-50 text-orange-700')}
          {renderAnomalyTable(groupedAnomalies.sensor_missing, '传感器缺失', 'bg-yellow-50 text-yellow-700')}
        </div>
      )}
    </div>
  )
}
