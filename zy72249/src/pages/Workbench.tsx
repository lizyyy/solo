import { useEffect, useRef, useState } from 'react'
import { Upload, FileSearch, Terminal, FileText, AlertTriangle, ShieldAlert, Clock } from 'lucide-react'
import StepIndicator from '@/components/StepIndicator'
import { useStore } from '@/store'

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = ref.current
    const startTime = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (target - start) * eased)
      setValue(current)
      ref.current = current
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return value
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Upload; label: string; value: number; color: string }) {
  const display = useCountUp(value)
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <div className="font-mono text-2xl font-bold text-gray-900">{display}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}

export default function Workbench() {
  const { currentBatch, workflowStep, fetchBatches, createBatch, importRecords, compareBatch, fetchReplayCommand, replayData, auditLogs, fetchAuditLogs } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [batchName, setBatchName] = useState('')

  useEffect(() => {
    fetchBatches().then(() => {
      fetchAuditLogs()
    })
  }, [fetchBatches, fetchAuditLogs])

  const batch = currentBatch

  const handleCreateBatch = async () => {
    if (!batchName.trim()) return
    await createBatch(batchName.trim())
    setBatchName('')
    setShowCreate(false)
  }

  const handleImport = async () => {
    if (!batch) return
    const sampleRecords = [
      { businessNo: 'DRV-2024-001', exDividendDate: '2024-06-15', amount: 100000, isFee: false, isPrincipal: true, source: 'confirmation' },
      { businessNo: 'DRV-2024-002', exDividendDate: '2024-06-15', amount: 5000, isFee: true, feeAmount: 5000, source: 'confirmation' },
      { businessNo: 'DRV-2024-002', exDividendDate: '2024-06-15', amount: 95000, isPrincipal: true, principalAmount: 95000, source: 'confirmation' },
      { businessNo: 'DRV-2024-003', exDividendDate: '2024-06-20', amount: 200000, taxRateRemark: '旧口径：税率10%', caliberType: 'old', source: 'confirmation' },
    ]
    await importRecords(batch.id, sampleRecords)
  }

  const handleCompare = async () => {
    if (!batch) return
    await compareBatch(batch.id)
  }

  const handleReplay = async () => {
    if (!batch) return
    await fetchReplayCommand(batch.id)
    await fetchAuditLogs({ batchId: batch.id })
  }

  const actionLabels: Record<string, string> = {
    batch_created: '批次创建', record_imported: '记录导入', comparison_triggered: '比对触发',
    discrepancy_detected: '差异检出', conflict_detected: '冲突检出', conflict_resolved: '冲突裁决',
    old_caliber_detected: '旧口径检出', tax_remark_reviewed: '备注补录', replay_executed: '复盘执行',
    replay_import_started: '复盘导入', replay_compare_started: '复盘比对',
  }

  const recentLogs = auditLogs.slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      <StepIndicator currentStep={workflowStep} />

      {!batch && !showCreate && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-gray-500">暂无批次，请创建新批次开始工作</p>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-[var(--color-teal)] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90">
            创建批次
          </button>
        </div>
      )}

      {showCreate && (
        <div className="mt-8 mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">创建新批次</h3>
          <input
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            placeholder="输入批次名称"
            className="mb-4 w-full rounded-lg border px-3 py-2 text-sm focus:border-[var(--color-teal)] focus:outline-none"
            onKeyDown={e => e.key === 'Enter' && handleCreateBatch()}
          />
          <div className="flex gap-2">
            <button onClick={handleCreateBatch} className="rounded-lg bg-[var(--color-teal)] px-4 py-2 text-sm text-white hover:opacity-90">确认</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          </div>
        </div>
      )}

      {batch && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{batch.name}</h2>
              <p className="text-xs text-gray-400">批次状态：{batch.status} · 创建于 {new Date(batch.created_at).toLocaleString('zh-CN')}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-4">
            <StatCard icon={FileText} label="记录数" value={batch.total_records} color="bg-blue-500" />
            <StatCard icon={AlertTriangle} label="差异数" value={batch.discrepancy_count} color="bg-teal-500" />
            <StatCard icon={ShieldAlert} label="冲突数" value={batch.conflict_count} color="bg-[var(--color-amber)]" />
            <StatCard icon={Clock} label="待复核数" value={batch.pending_review_count} color="bg-purple-500" />
          </div>

          <div className="mt-8 flex gap-4">
            <button onClick={handleImport} className="flex items-center gap-2 rounded-lg bg-[var(--color-teal)] px-5 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90">
              <Upload className="h-4 w-4" />导入除权日截图
            </button>
            <button onClick={handleCompare} className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-teal)] px-5 py-3 text-sm font-medium text-[var(--color-teal)] hover:bg-teal-50">
              <FileSearch className="h-4 w-4" />补看税费率备注
            </button>
            <button onClick={handleReplay} className="flex items-center gap-2 rounded-lg border-2 border-gray-300 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Terminal className="h-4 w-4" />生成复盘命令
            </button>
          </div>

          {replayData && (
            <div className="mt-6">
              <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                <div className="mb-2 text-xs text-gray-400">复盘命令已生成</div>
                <pre className="max-h-32 overflow-auto font-mono text-xs text-green-400 whitespace-pre-wrap">{replayData.fullCommand}</pre>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">最近操作</h3>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-gray-400">暂无操作记录</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-sm">
                    <span className="text-gray-700">{actionLabels[log.action] || log.action}</span>
                    <span className="font-mono text-xs text-gray-400">{new Date(log.timestamp).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
