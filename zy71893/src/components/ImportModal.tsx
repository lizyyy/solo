import { useState, useRef } from 'react'
import Modal from './Modal'
import { useDeviationStore } from '@/store/useDeviationStore'
import type { DeviationType, RecordSource } from '@/types'
import { Upload, AlertCircle, CheckCircle } from 'lucide-react'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [csvText, setCsvText] = useState('')
  const [result, setResult] = useState<{ imported: number; duplicates: number; duplicateList: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRecords = useDeviationStore((s) => s.importRecords)

  const handleImport = () => {
    const text = csvText.trim()
    if (!text) return
    const lines = text.split('\n').filter((l) => l.trim())
    const parsed = lines
      .map((line) => {
        const f = parseCSVLine(line)
        if (f.length < 7) return null
        return {
          code: f[0],
          deviationType: f[1] as DeviationType,
          source: f[2] as RecordSource,
          equipmentCode: f[3],
          discoveredAt: f[4],
          createdBy: f[5],
          description: f.slice(6).join(','),
        }
      })
      .filter(Boolean) as { code: string; deviationType: DeviationType; source: RecordSource; equipmentCode: string; discoveredAt: string; createdBy: string; description: string }[]

    if (parsed.length === 0) return
    const res = importRecords(parsed)
    setResult(res)
    setCsvText('')
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setCsvText(ev.target?.result as string ?? '')
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="导入偏差记录">
      <div className="space-y-4">
        <textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setResult(null) }}
          placeholder={'记录编号,偏差类型,来源,设备编号,发现时间,创建人,偏差描述\nBC-2026-0200,normal_deviation,manual_entry,BLR-01,2026-06-01T10:00:00,张建国,描述内容'}
          rows={6}
          className="w-full bg-slate-800 border border-iron-lighter rounded-md p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-signal resize-none"
        />
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-iron-lighter rounded-lg p-8 text-center hover:border-signal transition-colors cursor-pointer"
        >
          <Upload className="mx-auto mb-2 text-slate-400" size={24} />
          <p className="text-sm text-slate-400">点击或拖拽上传 CSV 文件</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </div>
        {result && result.duplicates > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-md p-3 text-sm text-orange-300 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>以下编号重复已跳过: {result.duplicateList.join(', ')}</span>
          </div>
        )}
        {result && result.imported > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-md p-3 text-sm text-emerald-300 flex items-start gap-2">
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
            <span>成功导入 {result.imported} 条记录</span>
          </div>
        )}
        <button onClick={handleImport} className="w-full bg-signal hover:bg-signal-dim text-white font-medium py-2 rounded-md transition-colors">
          导入
        </button>
      </div>
    </Modal>
  )
}
