import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExhibitionStore } from '@/store/useExhibitionStore'
import type { Artwork, Light, VisitorPath, Wall, SafetyZone, Source, ValidationStatus } from '@/types'
import { SOURCE_TYPE_LABELS, VALIDATION_STATUS_CONFIG } from '@/types'
import { Upload, FileJson, FileSpreadsheet, FileText, ArrowLeft, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

type ImportTab = 'artworks' | 'lights' | 'paths' | 'walls' | 'safetyZones'
type ParseFormat = 'json' | 'csv' | 'text'

interface ParsedRow {
  raw: Record<string, string>
  status: ValidationStatus
  issues: string[]
}

function gid(): string {
  return Math.random().toString(36).substring(2, 10)
}

export function ImportPage() {
  const navigate = useNavigate()
  const importData = useExhibitionStore((s) => s.importData)
  const [activeTab, setActiveTab] = useState<ImportTab>('artworks')
  const [format, setFormat] = useState<ParseFormat>('json')
  const [textInput, setTextInput] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceType, setSourceType] = useState<Source['type']>('manual')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [imported, setImported] = useState(false)

  const parseAndValidate = useCallback(() => {
    if (!textInput.trim()) return

    const source: Source = {
      id: `src-${gid()}`,
      type: sourceType,
      label: sourceLabel || SOURCE_TYPE_LABELS[sourceType],
      detail: `通过导入页面录入`,
      importedAt: new Date().toISOString(),
    }

    let rows: Record<string, string>[] = []

    try {
      if (format === 'json') {
        const parsed = JSON.parse(textInput)
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        rows = arr.map((item: Record<string, unknown>) => {
          const strRecord: Record<string, string> = {}
          for (const [k, v] of Object.entries(item)) {
            strRecord[k] = String(v ?? '')
          }
          return strRecord
        })
      } else if (format === 'csv') {
        const lines = textInput.trim().split('\n')
        if (lines.length < 2) return
        const headers = lines[0].split(',').map((h) => h.trim())
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',').map((v) => v.trim())
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => {
            row[h] = vals[idx] || ''
          })
          rows.push(row)
        }
      } else {
        const lines = textInput.trim().split('\n')
        const headers = lines[0].split(/[\t|]/).map((h) => h.trim())
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(/[\t|]/).map((v) => v.trim())
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => {
            row[h] = vals[idx] || ''
          })
          rows.push(row)
        }
      }
    } catch {
      rows = []
    }

    const validated: ParsedRow[] = rows.map((raw) => {
      const issues: string[] = []
      let status: ValidationStatus = 'normal'

      if (activeTab === 'artworks') {
        if (!raw.title) { issues.push('缺少作品名称'); status = 'missing' }
        if (!raw.width || parseFloat(raw.width) <= 0) { issues.push('宽度无效'); status = status === 'normal' ? 'missing' : status }
        if (!raw.height || parseFloat(raw.height) <= 0) { issues.push('高度无效'); status = status === 'normal' ? 'missing' : status }
        if (parseFloat(raw.width) > 10 || parseFloat(raw.height) > 10) { issues.push('尺寸超出合理范围'); status = 'invalid' }
      } else if (activeTab === 'lights') {
        if (!raw.type) { issues.push('缺少灯光类型'); status = 'missing' }
        if (parseFloat(raw.intensity) > 10) { issues.push('亮度异常高'); status = 'invalid' }
        if (parseFloat(raw.range) > 50) { issues.push('范围异常大'); status = 'invalid' }
      } else if (activeTab === 'paths') {
        if (!raw.points) { issues.push('缺少路径点'); status = 'missing' }
      }

      return { raw, status, issues }
    })

    setParsedRows(validated)
  }, [textInput, format, activeTab, sourceType, sourceLabel])

  const doImport = useCallback(() => {
    if (parsedRows.length === 0) return

    const sourceId = `src-${gid()}`
    const newSource: Source = {
      id: sourceId,
      type: sourceType,
      label: sourceLabel || SOURCE_TYPE_LABELS[sourceType],
      detail: `通过导入页面录入`,
      importedAt: new Date().toISOString(),
    }

    if (activeTab === 'artworks') {
      const artworks: Artwork[] = parsedRows.map((row, idx) => ({
        id: `art-${gid()}`,
        exhibitionId: 'demo-exhibition-001',
        title: row.raw.title || '未命名',
        width: parseFloat(row.raw.width) || 0,
        height: parseFloat(row.raw.height) || 0,
        depth: parseFloat(row.raw.depth) || 0.05,
        posX: parseFloat(row.raw.posX) || 0,
        posY: parseFloat(row.raw.posY) || 1.5,
        posZ: parseFloat(row.raw.posZ) || 0,
        rotY: parseFloat(row.raw.rotY) || 0,
        wallId: row.raw.wallId || '',
        sourceId,
        validationStatus: row.status,
        processingOrder: idx + 1,
      }))
      importData({ artworks, sources: [newSource] })
    } else if (activeTab === 'lights') {
      const lights: Light[] = parsedRows.map((row, idx) => ({
        id: `light-${gid()}`,
        exhibitionId: 'demo-exhibition-001',
        type: (row.raw.type as Light['type']) || 'point',
        posX: parseFloat(row.raw.posX) || 0,
        posY: parseFloat(row.raw.posY) || 3,
        posZ: parseFloat(row.raw.posZ) || 0,
        intensity: parseFloat(row.raw.intensity) || 1,
        range: parseFloat(row.raw.range) || 5,
        color: row.raw.color || '#ffffff',
        sourceId,
        validationStatus: row.status,
        processingOrder: idx + 1,
      }))
      importData({ lights, sources: [newSource] })
    } else if (activeTab === 'paths') {
      const paths: VisitorPath[] = parsedRows.map((row, idx) => {
        let points = []
        try { points = JSON.parse(row.raw.points) } catch { points = [] }
        return {
          id: `path-${gid()}`,
          exhibitionId: 'demo-exhibition-001',
          name: row.raw.name || `路线 ${idx + 1}`,
          points,
          sourceId,
          validationStatus: row.status,
          processingOrder: idx + 1,
        }
      })
      importData({ paths, sources: [newSource] })
    } else if (activeTab === 'walls') {
      const walls: Wall[] = parsedRows.map((row) => ({
        id: `wall-${gid()}`,
        exhibitionId: 'demo-exhibition-001',
        startX: parseFloat(row.raw.startX) || 0,
        startY: parseFloat(row.raw.startY) || 0,
        startZ: parseFloat(row.raw.startZ) || 0,
        endX: parseFloat(row.raw.endX) || 0,
        endY: parseFloat(row.raw.endY) || 0,
        endZ: parseFloat(row.raw.endZ) || 0,
        height: parseFloat(row.raw.height) || 4,
        sourceId,
      }))
      importData({ walls, sources: [newSource] })
    } else if (activeTab === 'safetyZones') {
      const zones: SafetyZone[] = parsedRows.map((row) => ({
        id: `sz-${gid()}`,
        exhibitionId: 'demo-exhibition-001',
        artworkId: row.raw.artworkId || '',
        distance: parseFloat(row.raw.distance) || 0.8,
        sourceId,
      }))
      importData({ safetyZones: zones, sources: [newSource] })
    }

    setImported(true)
  }, [parsedRows, activeTab, sourceType, sourceLabel, importData])

  const tabs: { key: ImportTab; label: string }[] = [
    { key: 'artworks', label: '作品' },
    { key: 'lights', label: '灯光' },
    { key: 'paths', label: '动线' },
    { key: 'walls', label: '展墙' },
    { key: 'safetyZones', label: '安全距离' },
  ]

  const sampleData: Record<ImportTab, string> = {
    artworks: '[\n  {"title":"新作品","width":"1.2","height":"0.8","depth":"0.05","posX":"0","posY":"1.8","posZ":"-4.9","rotY":"0","wallId":"wall-n"}\n]',
    lights: '[\n  {"type":"point","posX":"2","posY":"3.8","posZ":"-2","intensity":"1.0","range":"5","color":"#ffffff"}\n]',
    paths: '[\n  {"name":"新路线","points":"[{\"x\":0,\"y\":0,\"z\":4,\"time\":0},{\"x\":2,\"y\":0,\"z\":0,\"time\":10}]"}\n]',
    walls: '[\n  {"startX":"-3","startY":"0","startZ":"-5","endX":"3","endY":"0","endZ":"-5","height":"4"}\n]',
    safetyZones: '[\n  {"artworkId":"art-1","distance":"0.8"}\n]',
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-zinc-200 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-display text-2xl font-semibold">数据导入</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setParsedRows([]); setImported(false) }}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-[#16213e] rounded-xl p-5 border border-zinc-700/30">
              <div className="flex items-center gap-3 mb-4">
                <Upload className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">输入数据</span>
              </div>

              <div className="flex gap-2 mb-3">
                {(['json', 'csv', 'text'] as ParseFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      format === f
                        ? 'bg-zinc-600 text-zinc-100'
                        : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700/50'
                    }`}
                  >
                    {f === 'json' ? <span className="flex items-center gap-1"><FileJson className="w-3 h-3" />JSON</span> :
                     f === 'csv' ? <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" />CSV</span> :
                     <span className="flex items-center gap-1"><FileText className="w-3 h-3" />文本</span>}
                  </button>
                ))}
              </div>

              <textarea
                value={textInput}
                onChange={(e) => { setTextInput(e.target.value); setImported(false) }}
                placeholder={`粘贴${format.toUpperCase()}格式数据...\n\n示例：\n${sampleData[activeTab]}`}
                className="w-full h-48 bg-[#0f0f1a] border border-zinc-700/30 rounded-lg p-3 text-sm font-mono text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-blue-500/50"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">来源类型</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as Source['type'])}
                    className="w-full bg-[#0f0f1a] border border-zinc-700/30 rounded-md px-2 py-1.5 text-sm text-zinc-300 focus:outline-none"
                  >
                    {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">来源标签</label>
                  <input
                    value={sourceLabel}
                    onChange={(e) => setSourceLabel(e.target.value)}
                    placeholder="如：李馆长的邮件"
                    className="w-full bg-[#0f0f1a] border border-zinc-700/30 rounded-md px-2 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={parseAndValidate}
                  disabled={!textInput.trim()}
                  className="flex-1 py-2 text-sm rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  解析校验
                </button>
                <button
                  onClick={doImport}
                  disabled={parsedRows.length === 0 || imported}
                  className="flex-1 py-2 text-sm rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {imported ? '已导入' : '确认导入'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#16213e] rounded-xl p-5 border border-zinc-700/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">解析预览</span>
              {parsedRows.length > 0 && (
                <span className="text-xs text-zinc-500">
                  {parsedRows.length} 条记录
                </span>
              )}
            </div>

            {parsedRows.length === 0 ? (
              <div className="text-zinc-600 text-sm text-center py-12">
                输入数据后点击"解析校验"查看预览
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {parsedRows.map((row, idx) => {
                  const cfg = VALIDATION_STATUS_CONFIG[row.status]
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border p-3 text-xs"
                      style={{
                        borderColor: cfg.color + '40',
                        backgroundColor: cfg.bg,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-zinc-400">#{idx + 1}</span>
                        <span className="flex items-center gap-1" style={{ color: cfg.color }}>
                          {row.status === 'normal' && <CheckCircle2 className="w-3 h-3" />}
                          {row.status === 'missing' && <AlertTriangle className="w-3 h-3" />}
                          {row.status === 'invalid' && <XCircle className="w-3 h-3" />}
                          {cfg.label}
                        </span>
                      </div>
                      <div className="font-mono text-zinc-400 space-y-0.5">
                        {Object.entries(row.raw).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-zinc-600 min-w-[80px]">{k}:</span>
                            <span className="text-zinc-300 truncate">{v}</span>
                          </div>
                        ))}
                      </div>
                      {row.issues.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-zinc-700/30">
                          {row.issues.map((issue, i) => (
                            <div key={i} className="text-amber-400/80">⚠ {issue}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
