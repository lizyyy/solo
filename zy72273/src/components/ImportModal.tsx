import { useState } from 'react'
import { X, Upload } from 'lucide-react'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImport: (jsonData: string) => Promise<boolean>
}

export default function ImportModal({ open, onClose, onImport }: ImportModalProps) {
  const [jsonInput, setJsonInput] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleImport = async () => {
    setError(null)
    if (!jsonInput.trim()) {
      setError('请输入 JSON 数据')
      return
    }
    try {
      JSON.parse(jsonInput)
    } catch {
      setError('JSON 格式不正确，请检查输入')
      return
    }
    setImporting(true)
    const success = await onImport(jsonInput)
    setImporting(false)
    if (success) {
      setJsonInput('')
      onClose()
    } else {
      setError('导入失败，请重试')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-text-primary">导入校准数据</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => { setJsonInput(e.target.value); setError(null) }}
          placeholder='粘贴 JSON 数据，例如: {"beaconId":"B001",...}'
          className="w-full h-48 rounded border border-border bg-bg p-3 text-sm text-text-primary data-font placeholder:text-text-secondary/50 resize-none focus:outline-none focus:border-accent"
        />

        {error && <p className="text-xs text-status-red mt-2">{error}</p>}

        <div className="flex justify-end mt-4">
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
