import { useState, useRef } from 'react'
import { useReconciliationStore } from '@/store/useReconciliationStore'
import { X, FileUp, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import type { ImportStrategy } from '@/types'
import { STRATEGY_LABELS } from '@/types'
import type { ReconciliationRecord } from '@/types'
import { sampleRecords, edgeCaseRecords } from '@/data/sampleData'

interface ImportModalProps {
  onClose: () => void
}

export function ImportModal({ onClose }: ImportModalProps) {
  const { importRecords } = useReconciliationStore()
  const [strategy, setStrategy] = useState<ImportStrategy>('skip')
  const [result, setResult] = useState<{
    added: number
    skipped: number
    updated: number
    conflicts: number
    total: number
  } | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = (data: Partial<ReconciliationRecord>[]) => {
    const importResult = importRecords(data, strategy)
    setResult(importResult)
  }

  const processFile = (file: File) => {
    setError('')
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        const records = Array.isArray(data) ? data : data.records || [data]
        handleImport(records)
      } catch {
        setError('JSON 文件解析失败，请检查文件格式')
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const loadSampleData = () => {
    handleImport(sampleRecords)
  }

  const loadEdgeCaseData = () => {
    handleImport(edgeCaseRecords)
  }

  const strategies: {
    key: ImportStrategy
    label: string
    desc: string
  }[] = [
    {
      key: 'skip',
      label: STRATEGY_LABELS.skip,
      desc: '保留原记录，跳过重复项',
    },
    {
      key: 'update',
      label: STRATEGY_LABELS.update,
      desc: '用新数据覆盖已有记录',
    },
    {
      key: 'conflict',
      label: STRATEGY_LABELS.conflict,
      desc: '标记为冲突，由人工确认',
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-800">导入数据</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-2">
              重复数据处理策略
            </label>
            <div className="space-y-2">
              {strategies.map((s) => (
                <label
                  key={s.key}
                  className={`flex items-start gap-2 p-2.5 rounded border cursor-pointer transition-colors ${
                    strategy === s.key
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={s.key}
                    checked={strategy === s.key}
                    onChange={() => setStrategy(s.key)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-zinc-700">
                      {s.label}
                    </div>
                    <div className="text-xs text-zinc-400">{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-amber-400 bg-amber-50'
                : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <FileUp className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
            <p className="text-sm text-zinc-600">
              拖拽 JSON 文件到此处，或点击选择
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              格式：JSON 数组或包含 records 字段的对象
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="border-t border-zinc-100 pt-3">
            <p className="text-xs text-zinc-400 mb-2">或加载内置样例数据：</p>
            <div className="flex gap-2">
              <button
                onClick={loadSampleData}
                className="px-3 py-1.5 bg-[#1a1a2e] text-white text-xs rounded hover:bg-zinc-700 transition-colors"
              >
                加载主流程样例（3条）
              </button>
              <button
                onClick={loadEdgeCaseData}
                className="px-3 py-1.5 border border-zinc-300 text-zinc-600 text-xs rounded hover:bg-zinc-50 transition-colors"
              >
                加载边界测试（3条）
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex items-center gap-2 text-sm text-green-700 font-medium mb-2">
                <CheckCircle2 className="w-4 h-4" />
                导入完成
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-green-700">
                    {result.added}
                  </div>
                  <div className="text-xs text-green-600">新增</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-zinc-600">
                    {result.skipped}
                  </div>
                  <div className="text-xs text-zinc-500">跳过</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-blue-600">
                    {result.updated}
                  </div>
                  <div className="text-xs text-blue-500">更新</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-amber-600">
                    {result.conflicts}
                  </div>
                  <div className="text-xs text-amber-500">冲突</div>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-zinc-400">
                <Info className="w-3 h-3" />
                共处理 {result.total} 条记录
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-100 text-zinc-600 text-sm rounded hover:bg-zinc-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
