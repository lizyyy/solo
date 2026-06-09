import { useState, useCallback } from 'react'
import { Upload, FileUp, CheckCircle, AlertCircle, Clock, X, Eye, FileText, AlertTriangle, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { DirectionStatus, ImportResult } from '@/types'
import { cn } from '@/lib/utils'

interface PreviewRecord {
  originalLineNumber: number
  sensorId: string
  temperature: number
  direction: string
  directionNormalized: string | null
  directionStatus: DirectionStatus
  reason: string
}

const DIRECTION_RULES: Array<{
  pattern: RegExp
  normalizedValue: string | null
  action: 'auto_fix' | 'mark_invalid'
  description: string
}> = [
  {
    pattern: /^(正方向|正向|正|positive|\+)$/i,
    normalizedValue: 'positive',
    action: 'auto_fix',
    description: '正方向标准值',
  },
  {
    pattern: /^(负方向|负向|负|negative|-)$/i,
    normalizedValue: 'negative',
    action: 'auto_fix',
    description: '负方向标准值',
  },
  {
    pattern: /^(向左|左|left|向右|右|right|反方向|反向|反转|reverse|backward)$/i,
    normalizedValue: null,
    action: 'mark_invalid',
    description: '口语化方向表达，判定为无效(abnormal)，无法进入复核链路',
  },
]

function evaluateDirection(direction: string): {
  normalizedValue: string | null
  status: DirectionStatus
  reason: string
} {
  if (!direction || typeof direction !== 'string') {
    return { normalizedValue: null, status: 'abnormal', reason: '方向字段为空' }
  }

  const trimmed = direction.trim()

  for (const rule of DIRECTION_RULES) {
    if (rule.pattern.test(trimmed)) {
      if (rule.action === 'auto_fix') {
        return {
          normalizedValue: rule.normalizedValue,
          status: 'normal',
          reason: rule.description,
        }
      }
      if (rule.action === 'mark_invalid') {
        return {
          normalizedValue: null,
          status: 'abnormal',
          reason: rule.description,
        }
      }
    }
  }

  return {
    normalizedValue: null,
    status: 'abnormal',
    reason: `未识别的方向值: ${trimmed}`,
  }
}

export default function ImportPage() {
  const [records, setRecords] = useState<PreviewRecord[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const parseFile = useCallback(async (file: File): Promise<PreviewRecord[]> => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const records: PreviewRecord[] = []

    if (extension === 'csv') {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return []

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const sensorIdx = headers.findIndex(h => h.includes('sensor') || h.includes('传感器') || h === 'id')
      const tempIdx = headers.findIndex(h => h.includes('temp') || h.includes('温度'))
      const dirIdx = headers.findIndex(h => h.includes('direction') || h.includes('方向'))

      lines.slice(1).forEach((line, idx) => {
        const values = line.split(',')
        const direction = values[dirIdx]?.trim() || ''
        const sensorId = values[sensorIdx]?.trim() || ''
        const temperature = parseFloat(values[tempIdx]?.trim() || '0')
        const evaluated = evaluateDirection(direction)

        records.push({
          originalLineNumber: idx + 2,
          sensorId,
          temperature: isNaN(temperature) ? 0 : temperature,
          direction,
          directionNormalized: evaluated.normalizedValue,
          directionStatus: evaluated.status,
          reason: evaluated.reason,
        })
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

      jsonData.forEach((row, idx) => {
        const direction = String(row['direction'] || row['Direction'] || row['方向'] || '')
        const sensorId = String(row['sensorId'] || row['SensorId'] || row['sensor_id'] || row['传感器编号'] || row['id'] || '')
        const temperature = Number(row['temperature'] || row['Temperature'] || row['温度'] || 0)
        const evaluated = evaluateDirection(direction)

        records.push({
          originalLineNumber: idx + 2,
          sensorId,
          temperature: isNaN(temperature) ? 0 : temperature,
          direction,
          directionNormalized: evaluated.normalizedValue,
          directionStatus: evaluated.status,
          reason: evaluated.reason,
        })
      })
    }

    return records
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setErrorMsg(null)
    setImportResult(null)
    setFile(selectedFile)
    const parsedRecords = await parseFile(selectedFile)
    setRecords(parsedRecords)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return

    const extension = droppedFile.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      setErrorMsg('请上传 CSV 或 Excel 文件')
      return
    }

    setErrorMsg(null)
    setImportResult(null)
    setFile(droppedFile)
    const parsedRecords = await parseFile(droppedFile)
    setRecords(parsedRecords)
  }

  const handleImport = async () => {
    if (!file) return

    setLoading(true)
    setErrorMsg(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/calibration/import', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json() as ImportResult

      if (!response.ok || !result.success) {
        setErrorMsg(result.error || '导入失败，请重试')
        return
      }

      setImportResult(result)
    } catch {
      setErrorMsg('网络错误，导入失败，请检查连接后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setRecords([])
    setFile(null)
    setImportResult(null)
    setErrorMsg(null)
  }

  const stats = {
    total: records.length,
    normal: records.filter(r => r.directionStatus === 'normal').length,
    abnormal: records.filter(r => r.directionStatus === 'abnormal').length,
    pendingReview: records.filter(r => r.directionStatus === 'pending_review').length,
  }

  const getStatusStyle = (status: DirectionStatus) => {
    switch (status) {
      case 'normal':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'abnormal':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: DirectionStatus) => {
    switch (status) {
      case 'normal':
        return '正常'
      case 'abnormal':
        return '无效'
      case 'pending_review':
        return '待复核'
      default:
        return status
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">温度校准记录导入</h2>
          <p className="text-gray-500 mt-1">上传温度校准数据文件，系统将自动进行方向校验</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <p className="font-medium text-red-800">{errorMsg}</p>
        </div>
      )}

      {records.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200',
            isDragging
              ? 'border-[#E8792B] bg-[#E8792B]/5'
              : 'border-gray-300 hover:border-[#1B2A4A]/50 hover:bg-gray-50'
          )}
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#1B2A4A]/10 flex items-center justify-center">
            <Upload className="w-10 h-10 text-[#1B2A4A]" />
          </div>
          <p className="text-lg font-medium text-gray-700 mb-2">拖拽文件到此处上传</p>
          <p className="text-gray-500 mb-6">支持 CSV、Excel (.xlsx, .xls) 格式</p>
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-[#1B2A4A] text-white rounded-xl cursor-pointer hover:bg-[#1B2A4A]/90 transition-colors">
            <FileUp className="w-5 h-5" />
            选择文件
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">导入总数</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">正常记录</p>
                  <p className="text-2xl font-bold text-green-600">{stats.normal}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">无效记录</p>
                  <p className="text-2xl font-bold text-red-600">{stats.abnormal}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">待复核</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendingReview}</p>
                </div>
              </div>
            </div>
          </div>

          {importResult && importResult.success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">导入成功</p>
                  <p className="text-sm text-green-600">
                    共导入 {importResult.imported} 条，正常 {importResult.imported - importResult.abnormal - importResult.pendingReview} 条，无效 {importResult.abnormal} 条，待复核 {importResult.pendingReview} 条
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-gray-700">数据预览</span>
                {file && (
                  <span className="text-sm text-gray-500">- {file.name}</span>
                )}
              </div>
              <button
                onClick={handleClear}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
                清除
              </button>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原始行号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">温度 (°C)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标准化方向</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">异常原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record, index) => (
                    <tr
                      key={index}
                      className={cn(
                        'hover:bg-gray-50 transition-colors',
                        record.directionStatus === 'abnormal' && 'bg-red-50/50',
                        record.directionStatus === 'pending_review' && 'bg-yellow-50/50'
                      )}
                    >
                      <td className="px-6 py-4 text-sm text-gray-500">{record.originalLineNumber}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.sensorId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.temperature.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{record.direction}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {record.directionNormalized || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium border',
                          getStatusStyle(record.directionStatus)
                        )}>
                          {getStatusLabel(record.directionStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {record.directionStatus !== 'normal' ? (
                          <div className="flex items-start gap-1 text-sm text-red-600">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{record.reason}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-green-600">校验通过</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              onClick={handleClear}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              重新上传
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className={cn(
                'px-8 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2',
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#E8792B] text-white hover:bg-[#E8792B]/90 shadow-lg shadow-[#E8792B]/30'
              )}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? '导入中...' : '确认导入'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
