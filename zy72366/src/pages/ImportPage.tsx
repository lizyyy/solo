import { useState, useCallback } from "react"
import { Upload, FileUp, CheckCircle, AlertCircle, Clock, X, Eye, FileText, AlertTriangle } from "lucide-react"
import * as XLSX from "xlsx"
import type { CalibrationRecord, ImportResult } from "@/types"
import { cn } from "@/lib/utils"

interface PreviewRecord {
  rowNumber: number
  sensorId: string
  temperature: number
  direction: string
  directionStatus: 'valid' | 'invalid' | 'pending_review'
  validationErrors?: string[]
}

export default function ImportPage() {
  const [records, setRecords] = useState<PreviewRecord[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const validateDirection = (direction: string): { status: 'valid' | 'invalid' | 'pending_review'; errors: string[] } => {
    const normalizedDir = direction?.toUpperCase().trim() || ''
    const errors: string[] = []

    if (!normalizedDir) {
      return { status: 'invalid', errors: ['方向值为空'] }
    }

    const validDirections = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'NORTH', 'SOUTH', 'EAST', 'WEST']
    const ambiguousDirections = ['N', 'S', 'E', 'W', 'U', 'D', 'L', 'R']

    if (validDirections.includes(normalizedDir)) {
      return { status: 'valid', errors: [] }
    }

    if (ambiguousDirections.includes(normalizedDir)) {
      return { status: 'pending_review', errors: ['方向缩写需要人工复核'] }
    }

    return { status: 'invalid', errors: [`无效的方向值: ${direction}`] }
  }

  const parseFile = useCallback(async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    let records: PreviewRecord[] = []

    if (extension === 'csv') {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

      const sensorIdx = headers.findIndex(h => h.includes('sensor') || h.includes('传感器') || h === 'id')
      const tempIdx = headers.findIndex(h => h.includes('temp') || h.includes('温度'))
      const dirIdx = headers.findIndex(h => h.includes('direction') || h.includes('方向'))

      lines.slice(1).forEach((line, idx) => {
        const values = line.split(',')
        const direction = values[dirIdx]?.trim() || ''
        const validation = validateDirection(direction)

        records.push({
          rowNumber: idx + 2,
          sensorId: values[sensorIdx]?.trim() || '',
          temperature: parseFloat(values[tempIdx]) || 0,
          direction,
          directionStatus: validation.status,
          validationErrors: validation.errors,
        })
      })
    } else if (extension === 'xlsx' || extension === 'xls') {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

      records = jsonData.map((row, idx) => {
        const direction = String(row['direction'] || row['Direction'] || row['方向'] || '')
        const validation = validateDirection(direction)

        return {
          rowNumber: idx + 2,
          sensorId: String(row['sensorId'] || row['SensorId'] || row['传感器编号'] || row['id'] || ''),
          temperature: Number(row['temperature'] || row['Temperature'] || row['温度'] || 0),
          direction,
          directionStatus: validation.status,
          validationErrors: validation.errors,
        }
      })
    }

    return records
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImportResult(null)
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
      alert('请上传 CSV 或 Excel 文件')
      return
    }

    setFile(droppedFile)
    setImportResult(null)
    const parsedRecords = await parseFile(droppedFile)
    setRecords(parsedRecords)
  }

  const handleImport = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      if (file) formData.append('file', file)

      const response = await fetch('/api/calibration/import', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json() as ImportResult
        setImportResult(result)
      } else {
        alert('导入失败')
      }
    } catch {
      alert('导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setRecords([])
    setFile(null)
    setImportResult(null)
  }

  const stats = {
    total: records.length,
    valid: records.filter(r => r.directionStatus === 'valid').length,
    invalid: records.filter(r => r.directionStatus === 'invalid').length,
    pending: records.filter(r => r.directionStatus === 'pending_review').length,
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'invalid':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'valid':
        return '有效'
      case 'invalid':
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

      {records.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200",
            isDragging
              ? "border-[#E8792B] bg-[#E8792B]/5"
              : "border-gray-300 hover:border-[#1B2A4A]/50 hover:bg-gray-50"
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
                  <p className="text-sm text-gray-500">有效记录</p>
                  <p className="text-2xl font-bold text-green-600">{stats.valid}</p>
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
                  <p className="text-2xl font-bold text-red-600">{stats.invalid}</p>
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
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
              </div>
            </div>
          </div>

          {importResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">导入成功</p>
                  <p className="text-sm text-green-600">
                    共 {importResult.totalRecords} 条记录，有效 {importResult.validRecords} 条，待复核 {importResult.pendingReview} 条
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
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">行号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">传感器编号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">温度 (°C)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">校验状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record, index) => (
                    <tr key={index} className={cn(
                      "hover:bg-gray-50 transition-colors",
                      record.directionStatus === 'invalid' && 'bg-red-50/50',
                      record.directionStatus === 'pending_review' && 'bg-yellow-50/50'
                    )}>
                      <td className="px-6 py-4 text-sm text-gray-500">{record.rowNumber}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.sensorId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.temperature.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{record.direction}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border",
                          getStatusStyle(record.directionStatus)
                        )}>
                          {getStatusLabel(record.directionStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {record.validationErrors && record.validationErrors.length > 0 ? (
                          <div className="flex items-center gap-1 text-sm text-red-600">
                            <AlertTriangle className="w-4 h-4" />
                            {record.validationErrors.join(', ')}
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
              disabled={loading || stats.invalid > 0}
              className={cn(
                "px-8 py-2.5 rounded-xl font-medium transition-all duration-200",
                loading || stats.invalid > 0
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#E8792B] text-white hover:bg-[#E8792B]/90 shadow-lg shadow-[#E8792B]/30"
              )}
            >
              {loading ? "导入中..." : "确认导入"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
