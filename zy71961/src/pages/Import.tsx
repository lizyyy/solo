import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileJson, CheckCircle, Clock, AlertTriangle, Loader2, X } from 'lucide-react'
import { useAppStore } from '@/store'
import * as api from '@/api/client'
import { cn } from '@/lib/utils'
import type { MaterialRecord, RecordType } from '@/types'

interface ParseResult {
  bundleId: string
  records: MaterialRecord[]
}

const CATEGORIES: {
  type: RecordType
  label: string
  colorVar: string
  bgColor: string
  borderColor: string
  icon: typeof CheckCircle
}[] = [
  {
    type: 'normal',
    label: '正常记录',
    colorVar: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.10)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    icon: CheckCircle,
  },
  {
    type: 'late_arrival',
    label: '晚到附件',
    colorVar: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    icon: Clock,
  },
  {
    type: 'duplicate',
    label: '重复项',
    colorVar: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.10)',
    borderColor: 'rgba(249, 115, 22, 0.25)',
    icon: AlertTriangle,
  },
  {
    type: 'correction',
    label: '人工更正',
    colorVar: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    icon: X,
  },
]

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  parsing: { label: '解析中', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  parsed: { label: '已解析', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  confirmed: { label: '已确认', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  error: { label: '异常', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' },
}

export default function Import() {
  const { models, bundles, loading, loadModels, loadBundles, confirmBundle } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadModels()
    loadBundles()
  }, [])

  useEffect(() => {
    if (parseResult) {
      CATEGORIES.forEach((_, i) => {
        setTimeout(() => {
          setVisibleCards((prev) => new Set(prev).add(i))
        }, i * 120)
      })
    } else {
      setVisibleCards(new Set())
    }
  }, [parseResult])

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) return
    setIsUploading(true)
    setUploadProgress(0)
    setParseResult(null)

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + Math.random() * 15
      })
    }, 200)

    try {
      const result = await api.uploadBundle(file)
      clearInterval(interval)
      setUploadProgress(100)
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setParseResult({ bundleId: result.bundle.id, records: result.records })
        setSelectedDate(new Date().toISOString().slice(0, 10))
        loadBundles()
      }, 400)
    } catch {
      clearInterval(interval)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [loadBundles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [handleUpload])

  const handleConfirm = useCallback(async () => {
    if (!parseResult || !selectedModel || !selectedDate) return
    setConfirming(true)
    try {
      await confirmBundle(parseResult.bundleId, selectedModel, selectedDate)
      setParseResult(null)
      setSelectedModel('')
      setSelectedDate('')
      await loadBundles()
    } finally {
      setConfirming(false)
    }
  }, [parseResult, selectedModel, selectedDate, confirmBundle, loadBundles])

  const getRecordsByType = (type: RecordType) => {
    if (!parseResult) return []
    return parseResult.records.filter((r) => r.type === type)
  }

  const totalRecords = parseResult?.records.length ?? 0

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          材料包导入
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          上传 JSON 格式的模型漂移材料包，系统将自动解析并分类
        </p>
      </div>

      {!parseResult && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-20 transition-all duration-300',
            isDragging
              ? 'scale-[1.01] border-[var(--accent-amber)] bg-[rgba(245,158,11,0.06)]'
              : 'border-[var(--bg-tertiary)] hover:border-[var(--accent-amber)] hover:bg-[rgba(245,158,11,0.03)]',
            isUploading && 'pointer-events-none',
          )}
          style={{ backgroundColor: isDragging ? undefined : 'var(--bg-primary)' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--accent-amber)' }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  正在上传并解析...
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  请稍候，系统正在处理您的文件
                </p>
              </div>
              <div className="mt-2 h-1.5 w-64 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(uploadProgress, 100)}%`,
                    backgroundColor: 'var(--accent-amber)',
                  }}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {Math.round(uploadProgress)}%
              </p>
            </div>
          ) : (
            <>
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
              >
                <Upload className="h-8 w-8" style={{ color: 'var(--accent-amber)' }} />
              </div>
              <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                拖拽文件到此处，或点击选择文件
              </p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                支持 .json 格式的材料包文件
              </p>
              <div className="mt-4 flex items-center gap-2">
                <FileJson className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  JSON
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {parseResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              解析结果
            </h2>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              共 {totalRecords} 条记录
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((cat, idx) => {
              const records = getRecordsByType(cat.type)
              const count = records.length
              const pct = totalRecords > 0 ? ((count / totalRecords) * 100).toFixed(1) : '0.0'
              const Icon = cat.icon
              const isVisible = visibleCards.has(idx)

              return (
                <div
                  key={cat.type}
                  className={cn(
                    'rounded-xl border p-5 transition-all duration-500',
                    isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
                  )}
                  style={{
                    backgroundColor: cat.bgColor,
                    borderColor: cat.borderColor,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-5 w-5" style={{ color: cat.colorVar }} />
                      <span className="text-sm font-medium" style={{ color: cat.colorVar }}>
                        {cat.label}
                      </span>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        color: cat.colorVar,
                        backgroundColor: cat.bgColor,
                        border: `1px solid ${cat.borderColor}`,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-3xl font-bold" style={{ color: cat.colorVar }}>
                      {count}
                    </span>
                    <span className="ml-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                      条
                    </span>
                  </div>

                  {records.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {records.slice(0, 3).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                          style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
                        >
                          <span className="truncate text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                            {r.raw_data.length > 60 ? r.raw_data.slice(0, 60) + '...' : r.raw_data}
                          </span>
                          {r.confidence < 0.8 && (
                            <span className="shrink-0 text-[10px]" style={{ color: 'var(--accent-amber)' }}>
                              低置信
                            </span>
                          )}
                        </div>
                      ))}
                      {records.length > 3 && (
                        <p className="px-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          还有 {records.length - 3} 条...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div
            className="rounded-xl border p-6"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--bg-tertiary)',
            }}
          >
            <h3 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              确认并生成报告
            </h3>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  选择模型
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="">请选择模型</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-sm" style={{ color: 'var(--text-secondary)' }}>
                  报告日期
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent-amber)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <button
                onClick={handleConfirm}
                disabled={!selectedModel || !selectedDate || confirming}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium transition-all',
                  selectedModel && selectedDate && !confirming
                    ? 'hover:opacity-90'
                    : 'cursor-not-allowed opacity-50',
                )}
                style={{
                  backgroundColor: 'var(--accent-amber)',
                  color: '#0F172A',
                }}
              >
                {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirming ? '生成中...' : '确认生成报告'}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setParseResult(null)
                setSelectedModel('')
                setSelectedDate('')
              }}
              className="text-sm transition-colors hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              重新上传
            </button>
          </div>
        </div>
      )}

      <div
        className="rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--bg-tertiary)',
        }}
      >
        <h2 className="mb-4 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          导入历史
        </h2>
        {loading && bundles.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileJson className="mb-3 h-10 w-10" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              暂无导入记录
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bg-tertiary)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    文件名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    上传时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {bundles.map((b) => {
                  const status = STATUS_MAP[b.status] ?? STATUS_MAP.error
                  return (
                    <tr
                      key={b.id}
                      className="border-t transition-colors hover:bg-[var(--bg-secondary)]"
                      style={{ borderColor: 'var(--bg-tertiary)' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {b.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(b.uploaded_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            color: status.color,
                            backgroundColor: status.bg,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
