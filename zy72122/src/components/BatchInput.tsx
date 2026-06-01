import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { parseBatchInput } from '@/utils/unitConverter'
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function BatchInput() {
  const addRecords = useStore((s) => s.addRecords)
  const [text, setText] = useState('')
  const [sourceType, setSourceType] = useState<'photo' | 'manual' | 'legacy'>('photo')
  const [sourceRef, setSourceRef] = useState('')
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleImport = () => {
    if (!text.trim()) return

    const parsed = parseBatchInput(text)
    if (parsed.length === 0) {
      setFeedback({
        type: 'error',
        message: '未能解析到有效数据，请检查格式',
      })
      return
    }

    addRecords(
      parsed.map((p) => ({
        ...p,
        source: { type: sourceType, reference: sourceRef || '批量导入' },
      }))
    )

    setFeedback({
      type: 'success',
      message: `成功导入 ${parsed.length} 条记录`,
    })
    setText('')
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400">
          批量粘贴数据
        </label>
        <span className="text-[10px] text-slate-600">
          格式：时间戳, 刚度+单位, 位移+单位, 力+单位
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`2026-05-20T10:00:00, 25.5N/mm, 15.2mm, 387.6N\n2026-05-20T10:01:00, 25.5N/mm, 52.8mm, 1346.4N\n2026-05-20T10:02:00, 25.5N/mm, 8.3mm, 211.65N`}
        rows={6}
        className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
      />

      <div className="flex gap-2">
        <select
          value={sourceType}
          onChange={(e) =>
            setSourceType(e.target.value as 'photo' | 'manual' | 'legacy')
          }
          className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-200"
        >
          <option value="photo">现场照片</option>
          <option value="manual">手工记录</option>
          <option value="legacy">旧口径补录</option>
        </select>
        <input
          type="text"
          value={sourceRef}
          onChange={(e) => setSourceRef(e.target.value)}
          placeholder="来源编号"
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 focus:border-orange-500 focus:outline-none"
        />
      </div>

      <button
        onClick={handleImport}
        disabled={!text.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-400 transition-all hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Upload className="h-4 w-4" />
        批量导入
      </button>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            feedback.type === 'success'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {feedback.message}
        </div>
      )}
    </div>
  )
}
