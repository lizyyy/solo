import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

const URGENCY_MAP = {
  urgent: '紧急',
  normal: '普通',
  low: '低'
}

function Statistics() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/statistics')
      const data = await res.json()
      setStats(data)
    } catch (e) {
      console.error('获取统计数据失败', e)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = (data, filename, headers) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportBuildingStats = () => {
    if (!stats || !stats.buildingStats) return

    const headers = ['楼栋', '总工单数', '已完工数', '完工率', '平均处理时长(小时)']
    const data = stats.buildingStats.map(item => [
      item.building,
      item.total_orders,
      item.completed_orders,
      `${((item.completed_orders / item.total_orders) * 100).toFixed(1)}%`,
      item.avg_processing_hours ? item.avg_processing_hours.toFixed(2) : '-'
    ])

    exportToCSV(data, `楼栋统计_${dayjs().format('YYYYMMDD')}.csv`, headers)
  }

  const exportMaterialStats = () => {
    if (!stats || !stats.materialStats) return

    const headers = ['材料名称', '单位', '已消耗总量', '当前库存']
    const data = stats.materialStats.map(item => [
      item.name,
      item.unit,
      item.total_used || 0,
      item.current_stock
    ])

    exportToCSV(data, `材料消耗统计_${dayjs().format('YYYYMMDD')}.csv`, headers)
  }

  const exportUrgencyStats = () => {
    if (!stats || !stats.urgencyStats) return

    const headers = ['紧急程度', '工单总数', '已完工数', '完工率']
    const data = stats.urgencyStats.map(item => [
      URGENCY_MAP[item.urgency] || item.urgency,
      item.count,
      item.completed,
      `${((item.completed / item.count) * 100).toFixed(1)}%`
    ])

    exportToCSV(data, `紧急程度统计_${dayjs().format('YYYYMMDD')}.csv`, headers)
  }

  const exportAll = () => {
    exportBuildingStats()
    setTimeout(() => exportMaterialStats(), 500)
    setTimeout(() => exportUrgencyStats(), 1000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">暂无统计数据</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">统计报表</h2>
        <button
          onClick={exportAll}
          className="btn btn-primary"
        >
          📥 导出全部报表
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <span className="text-2xl">📋</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">总工单数</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overallStats.total_orders}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <span className="text-2xl">⏳</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">待处理</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.overallStats.pending_orders}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <span className="text-2xl">🔧</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">进行中</p>
              <p className="text-2xl font-bold text-purple-600">{stats.overallStats.in_progress_orders}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">已完工</p>
              <p className="text-2xl font-bold text-green-600">{stats.overallStats.completed_orders}</p>
            </div>
          </div>
        </div>
      </div>

      {stats.overallStats.avg_satisfaction && (
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <span className="text-2xl">⭐</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">平均满意度</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.overallStats.avg_satisfaction.toFixed(1)}
                </p>
                <span className="text-yellow-500">/ 5.0</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">各楼栋工单统计</h3>
          <button
            onClick={exportBuildingStats}
            className="btn btn-secondary text-sm"
          >
            📥 导出CSV
          </button>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">楼栋</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总工单数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">已完工</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">完工率</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均处理时长</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.buildingStats.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-gray-900">{item.building}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.total_orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-green-600 font-medium">{item.completed_orders}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(item.completed_orders / item.total_orders) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {((item.completed_orders / item.total_orders) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.avg_processing_hours ? `${item.avg_processing_hours.toFixed(2)} 小时` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">材料消耗统计</h3>
            <button
              onClick={exportMaterialStats}
              className="btn btn-secondary text-sm"
            >
              📥 导出CSV
            </button>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {stats.materialStats.map((material) => (
                <div key={material.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{material.name}</span>
                    <span className="text-sm text-gray-500">
                      消耗：{material.total_used || 0} {material.unit} | 库存：{material.current_stock}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        material.current_stock < 10 ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min((material.total_used || 0) / Math.max(material.total_used || 1, material.current_stock) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">紧急程度分布</h3>
            <button
              onClick={exportUrgencyStats}
              className="btn btn-secondary text-sm"
            >
              📥 导出CSV
            </button>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {stats.urgencyStats.map((item) => (
                <div key={item.urgency}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      item.urgency === 'urgent' ? 'bg-red-100 text-red-700' :
                      item.urgency === 'normal' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {URGENCY_MAP[item.urgency]}
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.count} 单 ({item.completed} 已完工)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        item.urgency === 'urgent' ? 'bg-red-500' :
                        item.urgency === 'normal' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${(item.count / stats.overallStats.total_orders) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">📊 统计说明</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li><strong>楼栋统计：</strong>按楼栋汇总工单数量、完成率和平均处理时长</li>
          <li><strong>平均处理时长：</strong>从派工到完工的平均耗时（仅统计已完工工单）</li>
          <li><strong>材料消耗：</strong>统计各类材料的领用总量和当前库存</li>
          <li><strong>导出功能：</strong>支持单独导出或一键导出全部CSV报表</li>
        </ul>
      </div>
    </div>
  )
}

export default Statistics
