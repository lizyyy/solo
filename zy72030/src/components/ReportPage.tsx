import { useState } from 'react'
import { X, Download, FileJson, FileSpreadsheet, ArrowLeft, BarChart3, Users, AlertTriangle, Clock, Star } from 'lucide-react'
import { useActivityStore } from '@/store'
import { cn, formatDateTime, formatTime, generateSummary, exportToCSV, downloadFile } from '@/utils'
import {
  FAILURE_REASON_LABELS,
  SOURCE_LABELS,
  RESULT_LABELS,
} from '@/types'
import type { ExplorerRecord, RecordResult, FailureReason } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ReportPage({ open, onClose }: Props) {
  const { currentActivity, records } = useActivityStore()
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('csv')

  if (!open || !currentActivity) return null

  const total = records.length
  const success = records.filter((r) => r.result === 'success').length
  const failure = records.filter((r) => r.result === 'failure').length
  const pending = records.filter((r) => r.result === 'pending_review').length
  const totalScore = records.reduce((sum, r) => sum + r.score, 0)
  const avgScore = total > 0 ? (totalScore / total).toFixed(1) : '0'
  const totalTime = records.reduce((sum, r) => sum + r.timeCostSeconds, 0)

  const failureByReason = records.reduce((acc, r) => {
    if (r.failureReason) {
      acc[r.failureReason] = (acc[r.failureReason] || 0) + 1
    }
    return acc
  }, {} as Record<FailureReason, number>)

  const sourceStats = records.reduce((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const exceptionRecords = records.filter(
    (r) => r.result !== 'success' || r.failureReason === 'other_exception'
  )

  const summaryText = generateSummary(records)

  const handleExport = () => {
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `多面体矿山探险_${currentActivity.id.slice(0, 8)}_${dateStr}`

    if (exportFormat === 'csv') {
      const csv = exportToCSV(records)
      downloadFile(csv, `${filename}.csv`, 'text/csv')
    } else {
      const json = JSON.stringify(
        {
          activity: currentActivity,
          records,
          summary: summaryText,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      )
      downloadFile(json, `${filename}.json`, 'application/json')
    }
  }

  const getResultColor = (result: RecordResult) => {
    switch (result) {
      case 'success':
        return 'bg-emerald-500'
      case 'failure':
        return 'bg-red-500'
      case 'pending_review':
        return 'bg-amber-500'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'realtime':
        return 'bg-blue-900/60 text-blue-300 border-blue-700'
      case 'group_supplement':
        return 'bg-purple-900/60 text-purple-300 border-purple-700'
      case 'old_standard':
        return 'bg-orange-900/60 text-orange-300 border-orange-700'
      default:
        return 'bg-gray-700 text-gray-300 border-gray-600'
    }
  }

  return (
    <div className="fixed inset-0 bg-[#1a1a2e] z-40 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            返回控制台
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#16213e] rounded-lg p-1 border border-[#0f3460]">
              <button
                onClick={() => setExportFormat('csv')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  exportFormat === 'csv'
                    ? 'bg-[#f0a500] text-[#1a1a2e] font-medium'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <FileSpreadsheet size={14} />
                CSV
              </button>
              <button
                onClick={() => setExportFormat('json')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                  exportFormat === 'json'
                    ? 'bg-[#f0a500] text-[#1a1a2e] font-medium'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <FileJson size={14} />
                JSON
              </button>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-[#f0a500] hover:bg-[#f5b624] text-[#1a1a2e] px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              <Download size={16} />
              导出
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: '"Noto Serif SC", serif' }}>
            多面体矿山探险 · 复盘报告
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <span>活动ID：{currentActivity.id}</span>
            <span>开始时间：{formatDateTime(currentActivity.createdAt)}</span>
            {currentActivity.settledAt && (
              <span>结算时间：{formatDateTime(currentActivity.settledAt)}</span>
            )}
            <span>总耗时：{formatTime(currentActivity.totalElapsedSeconds)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#16213e] rounded-xl p-5 border border-[#0f3460]">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <BarChart3 size={16} />
              总记录数
            </div>
            <div className="text-4xl font-bold text-white font-mono">{total}</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-5 border border-emerald-900/50">
            <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
              <Star size={16} />
              成功
            </div>
            <div className="text-4xl font-bold text-emerald-400 font-mono">{success}</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-5 border border-red-900/50">
            <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
              <AlertTriangle size={16} />
              失败
            </div>
            <div className="text-4xl font-bold text-red-400 font-mono">{failure}</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-5 border border-amber-900/50">
            <div className="flex items-center gap-2 text-amber-400 text-sm mb-2">
              <Users size={16} />
              平均分
            </div>
            <div className="text-4xl font-bold text-[#f0a500] font-mono">{avgScore}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#16213e] rounded-xl p-5 border border-[#0f3460]">
            <h3 className="text-lg font-bold text-white mb-4">失败原因分布</h3>
            {Object.keys(failureByReason).length === 0 ? (
              <p className="text-gray-500 text-sm">暂无失败记录</p>
            ) : (
              <div className="space-y-3">
                {(Object.keys(failureByReason) as FailureReason[]).map((reason) => (
                  <div key={reason}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{FAILURE_REASON_LABELS[reason]}</span>
                      <span className="text-white font-mono">{failureByReason[reason]}</span>
                    </div>
                    <div className="h-2 bg-[#0f3460] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#f0a500] rounded-full transition-all"
                        style={{
                          width: `${(failureByReason[reason] / Math.max(failure, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#16213e] rounded-xl p-5 border border-[#0f3460]">
            <h3 className="text-lg font-bold text-white mb-4">数据来源分布</h3>
            <div className="space-y-3">
              {Object.keys(sourceStats).map((source) => (
                <div key={source}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source}</span>
                    <span className="text-white font-mono">{sourceStats[source]}</span>
                  </div>
                  <div className="h-2 bg-[#0f3460] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{
                        width: `${(sourceStats[source] / total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[#16213e] rounded-xl p-5 border border-[#0f3460] mb-8">
          <h3 className="text-lg font-bold text-white mb-3">同事式汇总</h3>
          <div className="p-4 bg-[#0f3460] rounded-lg text-gray-200 whitespace-pre-line leading-relaxed">
            {summaryText}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            备注：例外情况（失败、待确认、其他异常）已单独列出，未在汇总数字中合并处理，
            复盘时请逐条查看。
          </p>
        </div>

        {exceptionRecords.length > 0 && (
          <div className="bg-red-950/30 rounded-xl p-5 border border-red-900/50 mb-8">
            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} />
              例外记录（需重点关注）
            </h3>
            <div className="space-y-3">
              {exceptionRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-black/30 rounded-lg p-4 border border-red-900/30"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn('w-2 h-2 rounded-full', getResultColor(record.result))} />
                    <span className="font-mono text-[#f0a500] font-bold">#{record.sequenceNumber}</span>
                    <span className="text-white">{record.polyhedronType}</span>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded border',
                        getSourceColor(record.source)
                      )}
                    >
                      {SOURCE_LABELS[record.source as keyof typeof SOURCE_LABELS] || record.source}
                    </span>
                  </div>
                  <p className="text-sm text-red-300 mb-2">
                    {record.failureDetail || `${RESULT_LABELS[record.result]}，得分${record.score}`}
                  </p>
                  {record.rawNote && (
                    <p className="text-xs text-gray-400 italic">原始备注：{record.rawNote}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2 font-mono">
                    处理时间：{formatDateTime(record.processedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#16213e] rounded-xl border border-[#0f3460] overflow-hidden">
          <div className="p-5 border-b border-[#0f3460]">
            <h3 className="text-lg font-bold text-white">逐条明细</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f3460]">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">序号</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">多面体</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">得分</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">耗时</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">结果</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">失败原因</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">来源</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">原始备注</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">处理时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, idx) => (
                  <tr
                    key={record.id}
                    className={cn(
                      'border-t border-[#0f3460]',
                      idx % 2 === 0 ? 'bg-[#1a1a2e]' : 'bg-[#16213e]'
                    )}
                  >
                    <td className="px-4 py-3 text-[#f0a500] font-mono font-bold">{record.sequenceNumber}</td>
                    <td className="px-4 py-3 text-white">{record.polyhedronType}</td>
                    <td className="px-4 py-3 text-yellow-400 font-mono">{record.score}</td>
                    <td className="px-4 py-3 text-blue-400 font-mono">{record.timeCostSeconds}s</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
                          record.result === 'success'
                            ? 'bg-emerald-900/50 text-emerald-400'
                            : record.result === 'failure'
                            ? 'bg-red-900/50 text-red-400'
                            : 'bg-amber-900/50 text-amber-400'
                        )}
                      >
                        {RESULT_LABELS[record.result]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {record.failureReason
                        ? FAILURE_REASON_LABELS[record.failureReason]
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded border',
                          getSourceColor(record.source)
                        )}
                      >
                        {SOURCE_LABELS[record.source as keyof typeof SOURCE_LABELS] || record.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 italic max-w-xs truncate" title={record.rawNote}>
                      {record.rawNote || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                      {formatDateTime(record.processedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 p-4 bg-[#16213e] rounded-xl border border-[#0f3460]">
          <div className="flex items-start gap-2">
            <Clock size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-500">
              本报告导出时间：{formatDateTime(new Date().toISOString())} ·
              接手的同事如需核对某条记录的判定依据，请直接查看处理时间和来源标签，
              所有原始备注均完整保留，未做清洗。
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
