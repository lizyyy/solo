import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { Upload, FileSpreadsheet, Database } from 'lucide-react'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { generateSampleData } from '@/utils/sampleData'
import type { TensileCurve } from '@/types'
import { cn } from '@/lib/utils'

export default function DataImport() {
  const { curves, setCurves, setFilteredCurves, applyFilter } = useAnalysisStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCurves = useCallback(
    (data: TensileCurve[]) => {
      setCurves(data)
      setFilteredCurves(data)
      applyFilter()
    },
    [setCurves, setFilteredCurves, applyFilter]
  )

  const parseCSV = useCallback(
    (text: string) => {
      setIsProcessing(true)
      setError(null)
      try {
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        })

        if (result.errors.length > 0) {
          setError(`解析错误: ${result.errors[0].message}`)
          setIsProcessing(false)
          return
        }

        const rows = result.data as Record<string, string>[]
        const parsed: TensileCurve[] = rows.map((row, i) => {
          const strainParts = (row.strain || '').split(',').map(Number).filter((v) => !isNaN(v))
          const stressParts = (row.stress || '').split(',').map(Number).filter((v) => !isNaN(v))

          return {
            id: `C-${String(i + 1).padStart(3, '0')}`,
            sampleId: row.sampleId || `S-${i + 1}`,
            batchNo: row.batchNo || '',
            deviceId: row.deviceId || '',
            strain: strainParts,
            stress: stressParts,
            fractureType: row.fractureType || undefined,
            isAnomaly: row.isAnomaly === 'true' || row.isAnomaly === '1',
          }
        })

        loadCurves(parsed)
      } catch (e) {
        setError(`解析失败: ${(e as Error).message}`)
      }
      setIsProcessing(false)
    },
    [loadCurves]
  )

  const handleFile = useCallback(
    (file: File) => {
      setIsProcessing(true)
      setError(null)

      const ext = file.name.split('.').pop()?.toLowerCase()

      if (ext === 'csv') {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          parseCSV(text)
        }
        reader.onerror = () => {
          setError('文件读取失败')
          setIsProcessing(false)
        }
        reader.readAsText(file)
      } else if (ext === 'xlsx') {
        import('xlsx').then((XLSX) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer)
              const workbook = XLSX.read(data, { type: 'array' })
              const sheetName = workbook.SheetNames[0]
              const sheet = workbook.Sheets[sheetName]
              const csvText = XLSX.utils.sheet_to_csv(sheet)
              parseCSV(csvText)
            } catch (err) {
              setError(`Excel 解析失败: ${(err as Error).message}`)
              setIsProcessing(false)
            }
          }
          reader.onerror = () => {
            setError('文件读取失败')
            setIsProcessing(false)
          }
          reader.readAsArrayBuffer(file)
        })
      } else {
        setError('仅支持 .csv 和 .xlsx 文件')
        setIsProcessing(false)
      }
    },
    [parseCSV]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleLoadSample = useCallback(() => {
    setIsProcessing(true)
    setError(null)
    const data = generateSampleData()
    loadCurves(data)
    setIsProcessing(false)
  }, [loadCurves])

  const anomalyCount = curves.filter((c) => c.isAnomaly).length
  const batchSet = new Set(curves.map((c) => c.batchNo))
  const deviceSet = new Set(curves.map((c) => c.deviceId))

  const stats = curves.length > 0 && (
    <div className="mt-6 grid grid-cols-4 gap-3">
      {[
        { label: '总曲线数', value: curves.length, color: 'text-sky' },
        { label: '异常数量', value: anomalyCount, color: 'text-warn' },
        { label: '批次数', value: batchSet.size, color: 'text-amber' },
        { label: '设备数', value: deviceSet.size, color: 'text-cold' },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-cold/20 bg-steel/60 px-4 py-3 text-center"
        >
          <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: s.color === 'text-sky' ? '#4A90D9' : s.color === 'text-warn' ? '#D94A4A' : s.color === 'text-amber' ? '#E8913A' : '#3A4A5C' }}>
            {s.value}
          </p>
          <p className="mt-1 text-xs text-cold/70">{s.label}</p>
        </div>
      ))}
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-8 flex items-center gap-3">
        <Database size={24} className="text-sky" />
        <h1 className="text-xl font-semibold text-white">数据导入</h1>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all duration-200',
          isDragging
            ? 'border-amber bg-amber/5 shadow-lg shadow-amber/10'
            : 'border-cold/30 bg-steel/30 hover:border-sky/50 hover:bg-sky/5'
        )}
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.csv,.xlsx'
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) handleFile(file)
          }
          input.click()
        }}
      >
        <div
          className={cn(
            'mb-4 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-200',
            isDragging ? 'bg-amber/20' : 'bg-cold/10'
          )}
        >
          <Upload
            size={28}
            className={cn(
              'transition-colors duration-200',
              isDragging ? 'text-amber' : 'text-cold/60'
            )}
          />
        </div>
        <p className="mb-1 text-sm font-medium text-white/80">
          拖拽文件到此处或点击上传
        </p>
        <p className="text-xs text-cold/50">
          支持 .csv / .xlsx 格式
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-cold/40">
          <FileSpreadsheet size={12} />
          <span>字段: sampleId, batchNo, deviceId, fractureType, strain, stress</span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleLoadSample}
          disabled={isProcessing}
          className={cn(
            'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200',
            isProcessing
              ? 'cursor-not-allowed bg-cold/20 text-cold/50'
              : 'bg-amber/15 text-amber hover:bg-amber/25 active:scale-[0.97]'
          )}
        >
          <Database size={16} />
          加载样例数据
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {error}
        </div>
      )}

      {stats}
    </div>
  )
}
