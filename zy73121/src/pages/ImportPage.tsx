import { useEffect, useState, useRef } from 'react'
import { FileUp, ClipboardPaste, AlertTriangle, Info, CheckCircle, Loader2 } from 'lucide-react'
import { useAnomalyStore } from '@/hooks/useAnomalyStore'
import ImportPreview from '@/components/ImportPreview'
import ImportResult from '@/components/ImportResult'
import type { ShipRecord } from '@/utils/types'
import { cn } from '@/lib/utils'

const SAMPLE_JSON = `[
  {
    "buoyId": "BY-001",
    "recordTimestamp": "${new Date(Date.now() - 3600000).toISOString()}",
    "recordLat": 28.5,
    "recordLng": 121.3,
    "waterTemp": 24.5,
    "salinity": 32.1,
    "dissolvedOxygen": 7.2,
    "phValue": 8.1,
    "isBoundarySample": true,
    "linkedAnomalyId": ""
  },
  {
    "buoyId": "BY-002",
    "recordTimestamp": "${new Date(Date.now() - 7200000).toISOString()}",
    "recordLat": 122.5,
    "recordLng": 30.2,
    "waterTemp": 25.8,
    "salinity": 33.5,
    "dissolvedOxygen": 6.8,
    "phValue": 8.0,
    "isBoundarySample": false,
    "linkedAnomalyId": ""
  }
]`

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function parseShipRecords(text: string): ShipRecord[] | null {
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return null

    return parsed.map((item) => ({
      id: item.id || generateId(),
      buoyId: String(item.buoyId || item.buoy_id || 'UNKNOWN'),
      recordTimestamp: String(item.recordTimestamp || item.record_timestamp || item.timestamp || new Date().toISOString()),
      recordLat: Number(item.recordLat || item.record_lat || item.lat || 0),
      recordLng: Number(item.recordLng || item.record_lng || item.lng || 0),
      waterTemp: Number(item.waterTemp || item.water_temp || item.temp || 0),
      salinity: Number(item.salinity || 0),
      dissolvedOxygen: Number(item.dissolvedOxygen || item.dissolved_oxygen || item.do || 0),
      phValue: Number(item.phValue || item.ph || 0),
      isBoundarySample: Boolean(item.isBoundarySample || item.boundary_sample || false),
      linkedAnomalyId: String(item.linkedAnomalyId || item.linked_anomaly_id || generateId()),
    }))
  } catch {
    return null
  }
}

export default function ImportPage() {
  const { initialize, anomalies, shipRecords, importShipRecords } = useAnomalyStore()
  const [inputText, setInputText] = useState('')
  const [previewRecords, setPreviewRecords] = useState<ShipRecord[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    added: number
    skipped: number
    boundary: number
    suspended: number
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    initialize()
  }, [initialize])

  const handleParse = () => {
    if (!inputText.trim()) {
      setParseError('请输入或粘贴船上记录数据')
      setPreviewRecords(null)
      return
    }

    const records = parseShipRecords(inputText)
    if (!records) {
      setParseError('数据格式错误，请检查 JSON 格式是否正确')
      setPreviewRecords(null)
      return
    }

    if (records.length === 0) {
      setParseError('未解析到有效记录')
      setPreviewRecords(null)
      return
    }

    if (records.length > 10) {
      setParseError(`单次导入最多支持 10 条记录，当前共 ${records.length} 条，请分批导入`)
      setPreviewRecords(null)
      return
    }

    setParseError(null)
    setPreviewRecords(records)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setInputText(text)
      const records = parseShipRecords(text)
      if (records) {
        if (records.length > 10) {
          setParseError(`单次导入最多支持 10 条记录，当前共 ${records.length} 条，请分批导入`)
          setPreviewRecords(null)
        } else {
          setParseError(null)
          setPreviewRecords(records)
        }
      } else {
        setParseError('文件格式错误，请检查 JSON 格式')
        setPreviewRecords(null)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleLoadSample = () => {
    setInputText(SAMPLE_JSON)
    setParseError(null)
    setPreviewRecords(null)
  }

  const handleImport = async () => {
    if (!previewRecords || previewRecords.length === 0) return

    const hasBoundary = previewRecords.some((r) => r.isBoundarySample)
    if (!hasBoundary) {
      if (!confirm('建议每次导入至少包含1条边界样本以验证确认逻辑。是否继续？')) {
        return
      }
    }

    setIsImporting(true)
    await new Promise((resolve) => setTimeout(resolve, 800))

    const result = importShipRecords(previewRecords)
    setImportResult(result)
    setIsImporting(false)
  }

  const handleReset = () => {
    setInputText('')
    setPreviewRecords(null)
    setParseError(null)
    setImportResult(null)
  }

  const handleCloseResult = () => {
    setImportResult(null)
    handleReset()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface font-display mb-2">导入船上记录</h1>
        <p className="text-sm text-muted">
          批量导入船上人工记录，支持 JSON 格式。系统将自动检测重复、经纬度反写和边界样本
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-surface font-display">输入数据</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadSample}
                  className="text-xs text-neon hover:text-neon/80 transition-colors"
                >
                  加载示例数据
                </button>
                <span className="text-ocean-700">|</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs text-neon hover:text-neon/80 transition-colors"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  上传文件
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                setParseError(null)
              }}
              placeholder={`粘贴 JSON 格式的船上记录，例如：\n[\n  {\n    "buoyId": "BY-001",\n    "recordTimestamp": "2024-01-15T10:30:00Z",\n    "recordLat": 28.5,\n    "recordLng": 121.3,\n    "isBoundarySample": true\n  }\n]`}
              className="w-full h-64 px-4 py-3 rounded-lg bg-ocean-900 border border-ocean-700 text-surface font-mono text-sm placeholder:text-muted/50 focus:outline-none focus:border-neon/50 transition-colors resize-none"
            />

            {parseError && (
              <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-alert/10 border border-alert/30">
                <AlertTriangle className="w-4 h-4 text-alert flex-shrink-0 mt-0.5" />
                <p className="text-sm text-alert">{parseError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleParse}
                disabled={!inputText.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all',
                  inputText.trim()
                    ? 'bg-neon text-ocean-950 hover:bg-neon/90'
                    : 'bg-ocean-700 text-muted cursor-not-allowed'
                )}
              >
                <ClipboardPaste className="w-4 h-4" />
                解析预览
              </button>
              {previewRecords && (
                <>
                  <button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neon text-ocean-950 font-semibold hover:bg-neon/90 transition-all disabled:opacity-50"
                  >
                    {isImporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileUp className="w-4 h-4" />
                    )}
                    {isImporting ? '导入中...' : '确认导入'}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isImporting}
                    className="px-4 py-2.5 rounded-lg text-muted hover:text-surface hover:bg-ocean-700/50 transition-colors disabled:opacity-50"
                  >
                    重置
                  </button>
                </>
              )}
            </div>
          </div>

          {previewRecords && (
            <ImportPreview
              records={previewRecords}
              existingShipRecords={shipRecords}
              existingAnomalies={anomalies}
            />
          )}
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-neon" />
              <h3 className="font-semibold text-surface font-display">导入说明</h3>
            </div>
            <ul className="space-y-3 text-sm text-muted">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
                <span>单次最多导入 10 条记录，建议少量多次</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
                <span>每次导入建议包含至少 1 条边界样本</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
                <span>重复记录自动跳过，数据不翻倍</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
                <span>已有备注不会被新导入覆盖</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-alert flex-shrink-0 mt-0.5" />
                <span>经纬度疑似反写自动挂起，需人工确认</span>
              </li>
            </ul>
          </div>

          <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 p-5">
            <h3 className="font-semibold text-surface font-display mb-3">当前数据统计</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">异常记录总数</span>
                <span className="font-mono font-semibold text-surface">{anomalies.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">船上记录总数</span>
                <span className="font-mono font-semibold text-neon">{shipRecords.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">挂起待确认</span>
                <span className="font-mono font-semibold text-alert">
                  {anomalies.filter((a) => a.status === 'SUSPENDED').length}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-ocean-800/30 backdrop-blur-sm rounded-xl border border-ocean-700 p-5">
            <h3 className="font-semibold text-surface font-display mb-2">💡 接手同事</h3>
            <p className="text-xs text-muted leading-relaxed">
              导入材料在此处上传，异常在左侧【异常队列】查看，导出按钮在异常列表右上角。
            </p>
          </div>
        </div>
      </div>

      {importResult && (
        <ImportResult result={importResult} onClose={handleCloseResult} />
      )}
    </div>
  )
}
