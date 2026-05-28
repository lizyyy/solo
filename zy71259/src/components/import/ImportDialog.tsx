import { useState, useRef } from 'react'
import { useExposureStore } from '@/store/exposureStore'
import { parseCSV, parseExcel, type DataType } from '@/utils/parser'
import { detectAnomalies } from '@/utils/hedgingCalc'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

const typeOptions: { value: DataType; label: string }[] = [
  { value: 'subsidiary', label: '子公司' },
  { value: 'currency', label: '币种' },
  { value: 'exposure', label: '应收应付敞口' },
  { value: 'hedge', label: '套保合约' },
  { value: 'rate', label: '汇率' },
]

export default function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [selectedType, setSelectedType] = useState<DataType>('exposure')
  const [warnings, setWarnings] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const store = useExposureStore()

  if (!open) return null

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setWarnings([])

    try {
      if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const result = parseCSV(text, selectedType)
        setWarnings(result.warnings)
        applyData(result.type, result.data)
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const result = parseExcel(buffer, selectedType)
        setWarnings(result.warnings)
        applyData(result.type, result.data)
      } else {
        setWarnings(['不支持的文件格式，请使用 CSV 或 Excel 文件'])
      }
    } catch (err) {
      setWarnings([`导入失败: ${err instanceof Error ? err.message : '未知错误'}`])
    } finally {
      setImporting(false)
    }
  }

  const applyData = (type: DataType, data: unknown[]) => {
    switch (type) {
      case 'subsidiary':
        store.setSubsidiaries([...store.subsidiaries, ...(data as typeof store.subsidiaries)])
        break
      case 'currency':
        store.setCurrencies([...store.currencies, ...(data as typeof store.currencies)])
        break
      case 'exposure':
        store.setExposures([...store.exposures, ...(data as typeof store.exposures)])
        break
      case 'hedge':
        store.setHedgeContracts([...store.hedgeContracts, ...(data as typeof store.hedgeContracts)])
        break
      case 'rate':
        store.setExchangeRates([...store.exchangeRates, ...(data as typeof store.exchangeRates)])
        break
    }
    runAnomalyDetection()
    store.setDataLoaded(true)
  }

  const runAnomalyDetection = () => {
    const anomalies = detectAnomalies(
      useExposureStore.getState().subsidiaries,
      useExposureStore.getState().exposures,
      useExposureStore.getState().hedgeContracts,
      useExposureStore.getState().exchangeRates
    )
    store.setAnomalies(anomalies)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-2xl w-[480px] max-h-[80vh] overflow-auto animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-accent-green" />
            <h3 className="font-display font-bold text-sm">数据导入</h3>
          </div>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-txt-secondary mb-2 block">数据类型</label>
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((opt) => (
                <span
                  key={opt.value}
                  className={`tag ${selectedType === opt.value ? 'tag-active' : 'tag-inactive'}`}
                  onClick={() => setSelectedType(opt.value)}
                >
                  {opt.label}
                </span>
              ))}
            </div>
          </div>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-accent-green/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileText size={32} className="mx-auto mb-2 text-txt-muted" />
            <p className="text-sm text-txt-secondary">点击选择文件或拖拽到此处</p>
            <p className="text-xs text-txt-muted mt-1">支持 CSV / XLSX 格式</p>
            <input ref={fileRef} type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFile} />
          </div>

          {importing && (
            <div className="text-center text-xs text-accent-green animate-pulse">正在导入...</div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-accent-gold bg-accent-gold/5 rounded p-2">
                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-deep/50 rounded-lg p-3">
            <p className="text-xs text-txt-muted">
              导入数据将保留原始口径，手工备注字段独立存储不被覆盖。异常标记为附加标注，不修改原始数据。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
