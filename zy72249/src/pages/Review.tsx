import { useEffect, useState } from 'react'
import { Search, Play } from 'lucide-react'
import Timeline from '@/components/Timeline'
import CommandGenerator from '@/components/CommandGenerator'
import { useStore } from '@/store'

export default function Review() {
  const { auditLogs, fetchAuditLogs, replayData, fetchReplayCommand, executeReplay, currentBatch } = useStore()
  const [batchIdInput, setBatchIdInput] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [businessNo, setBusinessNo] = useState('')

  useEffect(() => {
    fetchAuditLogs()
    if (currentBatch) {
      fetchReplayCommand(currentBatch.id)
    }
  }, [currentBatch, fetchAuditLogs, fetchReplayCommand])

  const handleSearch = () => {
    const filters: Record<string, string> = {}
    if (batchIdInput) filters.batchId = batchIdInput
    if (businessNo) filters.action = businessNo
    fetchAuditLogs(filters)
  }

  const handleGenerateCommand = () => {
    if (batchIdInput) {
      fetchReplayCommand(batchIdInput)
    } else if (currentBatch) {
      fetchReplayCommand(currentBatch.id)
    }
  }

  const handleExecuteReplay = async () => {
    const id = batchIdInput || currentBatch?.id
    if (!id) return
    await executeReplay(id)
  }

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      <h2 className="mb-6 text-xl font-bold text-gray-900">复盘记录</h2>

      <div className="mb-6 flex items-end gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">批次ID</label>
          <input
            value={batchIdInput}
            onChange={e => setBatchIdInput(e.target.value)}
            placeholder="输入批次ID"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">开始日期</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">结束日期</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">业务号</label>
          <input
            value={businessNo}
            onChange={e => setBusinessNo(e.target.value)}
            placeholder="业务号"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] px-5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Search className="h-4 w-4" />搜索
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">操作时间线</h3>
            <Timeline logs={auditLogs} />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">命令生成器</h3>
              <button
                onClick={handleGenerateCommand}
                className="text-xs text-[var(--color-teal)] hover:underline"
              >
                生成命令
              </button>
            </div>
            <CommandGenerator
              command={replayData?.fullCommand || ''}
              batchId={batchIdInput || currentBatch?.id}
            />
            <button
              onClick={handleExecuteReplay}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-teal)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <Play className="h-4 w-4" />执行复盘
            </button>
          </div>

          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">历史结果</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 text-left font-medium">批次</th>
                  <th className="py-2 text-left font-medium">操作</th>
                  <th className="py-2 text-right font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 8).map(log => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-gray-600">{log.batch_id.slice(0, 8)}...</td>
                    <td className="py-2 text-gray-700">{log.action}</td>
                    <td className="py-2 text-right font-mono text-gray-400">{new Date(log.timestamp).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
