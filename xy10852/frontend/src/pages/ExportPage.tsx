import { useState } from 'react'
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react'
import { preferenceApi } from '../services/api'
import type { ChannelType, BusinessScene } from '../types'

export default function ExportPage() {
  const [exportType, setExportType] = useState<'preferences' | 'history' | 'interceptions' | 'anomalies'>('preferences')
  const [format, setFormat] = useState<'json' | 'csv' | 'excel'>('json')
  const [filters, setFilters] = useState({
    user_id: '',
    channel: '',
    business_scene: ''
  })
  const [exporting, setExporting] = useState(false)

  const channels: ChannelType[] = ['sms', 'email', 'in_app']
  const scenes: BusinessScene[] = ['transactional', 'marketing', 'security', 'system']

  const getExportApi = () => {
    switch (exportType) {
      case 'preferences': return preferenceApi.exportPreferences
      case 'history': return preferenceApi.exportHistory
      case 'interceptions': return preferenceApi.exportInterceptions
      case 'anomalies': return preferenceApi.exportAnomalies
      default: return preferenceApi.exportPreferences
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const api = getExportApi()
      const response = await api({
        user_id: filters.user_id || undefined,
        channel: (filters.channel as ChannelType) || undefined,
        business_scene: (filters.business_scene as BusinessScene) || undefined,
        export_format: format
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const ext = format === 'excel' ? 'xlsx' : format
      link.setAttribute('download', `${exportType}_${Date.now()}.${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  const getFormatIcon = (f: string) => {
    switch (f) {
      case 'json': return <FileJson className="w-5 h-5" />
      case 'csv': return <FileText className="w-5 h-5" />
      case 'excel': return <FileSpreadsheet className="w-5 h-5" />
      default: return <FileText className="w-5 h-5" />
    }
  }

  const exportTypes = [
    { id: 'preferences', label: '偏好配置', description: '导出用户通知偏好配置数据' },
    { id: 'history', label: '变更历史', description: '导出偏好变更历史记录' },
    { id: 'interceptions', label: '拦截记录', description: '导出通知拦截记录' },
    { id: 'anomalies', label: '异常队列', description: '导出异常处理记录' }
  ]

  const formats = [
    { id: 'json', label: 'JSON', description: '适合程序处理' },
    { id: 'csv', label: 'CSV', description: '适合表格软件' },
    { id: 'excel', label: 'Excel', description: '带格式的Excel文件' }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">数据导出</h1>
          <p className="text-gray-500 mt-1">导出通知偏好系统数据</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">选择导出类型</h2>
          <div className="space-y-3">
            {exportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setExportType(type.id as any)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  exportType === type.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`font-medium ${
                  exportType === type.id ? 'text-blue-700' : 'text-gray-800'
                }`}>
                  {type.label}
                </p>
                <p className="text-sm text-gray-500 mt-1">{type.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">选择导出格式</h2>
          <div className="space-y-3">
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id as any)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  format === f.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${
                    format === f.id ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {getFormatIcon(f.id)}
                  </div>
                  <div>
                    <p className={`font-medium ${
                      format === f.id ? 'text-blue-700' : 'text-gray-800'
                    }`}>
                      {f.label}
                    </p>
                    <p className="text-sm text-gray-500">{f.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">筛选条件</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户ID</label>
            <input
              type="text"
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="留空导出所有用户"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">通知渠道</label>
            <select
              value={filters.channel}
              onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部渠道</option>
              {channels.map((c) => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">业务场景</label>
            <select
              value={filters.business_scene}
              onChange={(e) => setFilters({ ...filters, business_scene: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部场景</option>
              {scenes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">导出预览</h3>
            <p className="text-sm text-gray-500 mt-1">
              将导出 <span className="font-medium text-blue-600">{
                exportTypes.find(t => t.id === exportType)?.label
              }</span> 数据，格式为 <span className="font-medium text-blue-600">{format.toUpperCase()}</span>
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download className={`w-5 h-5 ${exporting ? 'animate-spin' : ''}`} />
            {exporting ? '导出中...' : '开始导出'}
          </button>
        </div>
      </div>
    </div>
  )
}
