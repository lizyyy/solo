import { useRecordStore } from '../store/useRecordStore'
import { useNavigate } from 'react-router-dom'
import { FileBarChart, CheckCircle, AlertTriangle, AlertCircle, Download, MapPin, Eye, FileText } from 'lucide-react'
import StatCard from '../components/summary/StatCard'
import { statusLabels, statusColors } from '../types'
import { useState } from 'react'

export default function SummaryPage() {
  const navigate = useNavigate()
  const { getStats, getStreetSummaries, getExcludedFromSummary } = useRecordStore()
  const stats = getStats()
  const streetSummaries = getStreetSummaries()
  const excluded = getExcludedFromSummary()
  const [copied, setCopied] = useState(false)

  const handleExport = () => {
    let content = '地铁口无障碍绕行记录 - 街道摘要\n'
    content += `生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}\n`
    content += '='.repeat(60) + '\n\n'

    content += '一、总体统计\n'
    content += `- 记录总数：${stats.total}\n`
    content += `- 进入街道摘要：${stats.normal + stats.completed + stats.rampSupplemented}\n`
    content += `  - 正常记录：${stats.normal}\n`
    content += `  - 坡道补录：${stats.rampSupplemented}\n`
    content += `  - 已完成复核：${stats.completed}\n`
    content += `- 不进入街道摘要：${stats.nameConflict + stats.dataConflict}\n`
    content += `  - 名称待复核：${stats.nameConflict}\n`
    content += `  - 口径冲突：${stats.dataConflict}\n\n`

    content += '二、进入街道摘要的记录\n'
    if (streetSummaries.length === 0) {
      content += '（暂无记录）\n'
    } else {
      streetSummaries.forEach((street) => {
        content += `\n【${street.street}】共 ${street.count} 条记录\n`
        content += '-'.repeat(40) + '\n'
        street.records.forEach((record) => {
          content += `  · ${record.communityName}（${statusLabels[record.status]}）\n`
          content += `    地铁站：${record.metroStation}\n`
          const finalRoute = record.finalSource === 'ramp' && record.rampRecord
            ? record.rampRecord.detourRoute
            : record.constructionNotice.detourRoute
          content += `    绕行路线：${finalRoute}\n`
          const finalInfo = record.finalSource === 'ramp' && record.rampRecord
            ? record.rampRecord.barrierFreeInfo
            : record.constructionNotice.barrierFreeInfo
          content += `    无障碍信息：${finalInfo}\n`
          if (record.reviewer) {
            content += `    复核人：${record.reviewer}\n`
          }
          if (record.finalSource) {
            content += `    最终口径：${record.finalSource === 'ramp' ? '以坡道记录为准' : '以施工告示为准'}\n`
          }
          content += '\n'
        })
      })
    }

    content += '\n三、不进入街道摘要的记录\n'
    if (excluded.length === 0) {
      content += '（无）\n'
    } else {
      excluded.forEach((record) => {
        content += `  · ${record.communityName}（${statusLabels[record.status]}）\n`
        content += `    原因：${record.status === 'name_conflict' ? '新旧名称待市政巡检员复核' : '口径冲突待老马确认'}\n`
        if (record.oldCommunityName) {
          content += `    新旧名称：${record.communityName} / ${record.oldCommunityName}\n`
        }
        content += '\n'
      })
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `地铁口无障碍绕行摘要_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FileBarChart className="w-7 h-7 text-blue-800" />
            <h1 className="text-2xl font-bold text-gray-800">街道会看摘要</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/wizard')}
              className="flex items-center space-x-2 bg-green-700 hover:bg-green-800 text-white px-4 py-2.5 rounded font-medium text-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>三步流程导入</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded font-medium transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>已导出</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>导出摘要</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard title="记录总数" value={stats.total} icon={FileBarChart} color="text-blue-600" bgColor="bg-white" />
          <StatCard
            title="进入街道摘要"
            value={stats.normal + stats.completed + stats.rampSupplemented}
            icon={CheckCircle}
            color="text-green-600"
            bgColor="bg-white"
          />
          <StatCard title="名称待复核" value={stats.nameConflict} icon={AlertCircle} color="text-yellow-600" bgColor="bg-white" />
          <StatCard title="口径冲突" value={stats.dataConflict} icon={AlertTriangle} color="text-red-600" bgColor="bg-white" />
        </div>

        {streetSummaries.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
              <h2 className="font-semibold text-green-800">进入街道摘要的记录（已复核通过）</h2>
              <p className="text-sm text-green-600">仅正常、已完成、坡道补录的记录进入摘要</p>
            </div>
            <div className="divide-y divide-gray-200">
              {streetSummaries.map((street) => (
                <div key={street.street} className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800 text-lg">{street.street}</h3>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      {street.count} 条记录
                    </span>
                  </div>
                  <div className="space-y-3">
                    {street.records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-start justify-between p-4 bg-green-50 rounded-lg hover:bg-green-100 cursor-pointer border border-green-100"
                        onClick={() => navigate(`/record/${record.id}`)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <span className="font-medium text-gray-900">{record.communityName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[record.status]}`}>
                              {statusLabels[record.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{record.metroStation}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">绕行路线：</span>
                            {record.finalSource === 'ramp' && record.rampRecord
                              ? record.rampRecord.detourRoute
                              : record.constructionNotice.detourRoute}
                          </p>
                          {record.finalSource && (
                            <p className="text-xs text-gray-400 mt-1">
                              最终口径：{record.finalSource === 'ramp' ? '以坡道记录为准' : '以施工告示为准'}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs text-gray-500 ml-4">
                          {record.reviewer && <p>复核人：{record.reviewer}</p>}
                          <p>更新于：{record.updatedAt}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center mb-6">
            <p className="text-gray-600">暂无记录进入街道摘要</p>
            <p className="text-sm text-gray-500 mt-1">请先通过三步流程导入并复核记录</p>
            <button
              onClick={() => navigate('/wizard')}
              className="mt-4 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium"
            >
              开始导入
            </button>
          </div>
        )}

        {excluded.length > 0 && (
          <div className="bg-white rounded-lg border-2 border-red-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 bg-red-50">
              <h2 className="font-semibold text-red-800">不进入街道摘要的记录（待复核）</h2>
              <p className="text-sm text-red-600">以下记录需复核完成后方可进入街道摘要</p>
            </div>
            <div className="divide-y divide-red-100">
              {excluded.map((record) => (
                <div
                  key={record.id}
                  className="p-4 flex items-start justify-between hover:bg-red-50 cursor-pointer"
                  onClick={() => navigate(`/record/${record.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-1">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-gray-900">{record.communityName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[record.status]}`}>
                        {statusLabels[record.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 ml-7">{record.metroStation}</p>
                    <p className="text-sm text-red-600 ml-7 mt-1">
                      {record.status === 'name_conflict'
                        ? '新旧名称待市政巡检员复核，复核后方可进入摘要'
                        : '口径冲突待老马确认，确认后方可进入摘要'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500 ml-4">
                    <p>更新于：{record.updatedAt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">摘要说明</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 仅正常、已完成、坡道补录的记录进入街道摘要</li>
            <li>• 名称待复核记录需市政巡检员现场确认后才进入摘要</li>
            <li>• 口径冲突记录需老马确认后才进入摘要</li>
            <li>• 补录后复核状态和报告说明同步更新</li>
            <li>• 导出文件与页面展示的"进入/不进入摘要"判断一致</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
