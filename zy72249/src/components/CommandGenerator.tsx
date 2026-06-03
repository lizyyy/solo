import { useState } from 'react'
import { Copy, Check, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandGeneratorProps {
  command: string
  batchId?: string
}

export default function CommandGenerator({ command, batchId }: CommandGeneratorProps) {
  const [copied, setCopied] = useState(false)
  const [editableBatchId, setEditableBatchId] = useState(batchId || '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Terminal className="h-4 w-4" />
          <span>复盘命令</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">批次ID:</label>
            <input
              value={editableBatchId}
              onChange={e => setEditableBatchId(e.target.value)}
              className="rounded border border-gray-600 bg-gray-800 px-2 py-1 font-mono text-xs text-gray-200 focus:border-[var(--color-amber)] focus:outline-none"
            />
          </div>
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors',
              copied ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto p-4">
        <pre className="font-mono text-xs leading-relaxed text-green-400 whitespace-pre-wrap">
          {command || '暂无命令'}
        </pre>
      </div>
    </div>
  )
}
