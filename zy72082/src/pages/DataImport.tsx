import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload,
  MapPin,
  Ruler,
  Eye,
  FileSpreadsheet,
  AlertTriangle,
  RefreshCw,
  Save,
  Trash2,
  FileUp,
} from 'lucide-react'
import { useStore } from '@/store'
import {
  STANDARD_FIELDS,
  SOURCE_TYPE_LABELS,
  DEFAULT_UNITS,
  UNIT_FACTORS,
} from '@/types'
import type { DataSource, UnifiedRecord } from '@/types'
import {
  extractUnitFromHeader,
  detectFieldType,
  convertValue,
  getStandardUnit,
} from '@/utils/unitConversion'

const DEMO_LECTURE_CSV = `路线编号,仓库代码,冷藏温度(℃),运输距离(km),载重(吨)
R-001,WH-A,-18.5,120,8
R-001,WH-B,-22.0,85,12
R-002,WH-A,-15.0,200,6
R-002,WH-C,-20.5,150,10
R-003,WH-B,-25.0,95,15`

const DEMO_SCREENSHOT_CSV = `线路ID,仓库ID,温度(°F),里程(英里),重量(kg)
R-001,WH-A,0.5,74.56,8000
R-001,WH-B,-7.6,52.82,12000
R-002,WH-A,5,124.27,6000
R-002,WH-C,-4.9,93.21,10000
R-003,WH-B,-13,59.03,15000`

const NUMERIC_FIELDS = ['temperature', 'mileage', 'vehicleCapacity']

const FIELD_LABELS: Record<string, string> = {
  routeId: '路线ID',
  warehouseId: '仓库ID',
  temperature: '温度',
  mileage: '里程',
  vehicleCapacity: '容量',
  productType: '产品类型',
  departureTime: '出发时间',
  arrivalTime: '到达时间',
}

interface ParsedHeader {
  originalHeader: string
  fieldName: string
  detectedUnit: string | null
  detectedStdField: string | null
}

export default function DataImport() {
  const {
    addDataSource,
    addRecords,
    addFieldMapping,
    addUnitConversion,
    records,
    dataSources,
    fieldMappings,
    unitConversions,
    toggleAnomaly,
    updateRecord,
    clearAllData,
    loadData,
    reprocessRecordsBySource,
  } = useStore()

  const [csvText, setCsvText] = useState('')
  const [sourceType, setSourceType] = useState<DataSource['type']>('business_table')
  const [sourceName, setSourceName] = useState('')
  const [parsedHeaders, setParsedHeaders] = useState<ParsedHeader[]>([])
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const [unitConvs, setUnitConvs] = useState<Record<string, { from: string; to: string }>>({})
  const [currentSourceId, setCurrentSourceId] = useState<number | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<UnifiedRecord>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [loadData])

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter((l) => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()))
    return { headers, rows }
  }

  const parseHeaders = (headers: string[]): ParsedHeader[] => {
    return headers.map((h) => {
      const { fieldName, unit } = extractUnitFromHeader(h)
      const detectedStdField = detectFieldType(fieldName)
      return {
        originalHeader: h,
        fieldName,
        detectedUnit: unit,
        detectedStdField,
      }
    })
  }

  const parseExcel = (buffer: ArrayBuffer) => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][]
    if (data.length < 2) return { headers: [], rows: [] }
    const headers = data[0].map((h) => String(h || '').trim())
    const rows = data.slice(1).map((row) => row.map((c) => String(c || '').trim()))
    return { headers, rows }
  }

  const processParsedData = useCallback(async (headers: string[], rows: string[][], fileName: string) => {
    if (headers.length === 0) {
      setImportMessage('文件解析失败，请检查格式')
      return
    }

    const parsed = parseHeaders(headers)
    setParsedHeaders(parsed)

    const defaultMap: Record<string, string> = {}
    const defaultUnits: Record<string, { from: string; to: string }> = {}

    parsed.forEach((ph) => {
      if (ph.detectedStdField) {
        defaultMap[ph.originalHeader] = ph.detectedStdField
        if (NUMERIC_FIELDS.includes(ph.detectedStdField)) {
          const stdUnit = getStandardUnit(ph.detectedStdField as any)
          defaultUnits[ph.detectedStdField] = {
            from: ph.detectedUnit || stdUnit,
            to: stdUnit,
          }
        }
      }
    })

    setFieldMap(defaultMap)
    setUnitConvs(defaultUnits)

    const name = sourceName || fileName || SOURCE_TYPE_LABELS[sourceType]
    const dsId = await addDataSource({
      type: sourceType,
      name,
      description: `导入${rows.length}条记录，${headers.length}个字段`,
      importedAt: new Date().toISOString(),
    })
    setCurrentSourceId(dsId)

    const recs: Omit<UnifiedRecord, 'id'>[] = rows.map((row, rowIdx) => {
      const vals: Record<string, string> = {}
      headers.forEach((h, i) => {
        vals[h] = row[i] || ''
      })

      const getMappedValue = (stdField: string) => {
        const origHeader = Object.entries(defaultMap).find(([, v]) => v === stdField)?.[0]
        return origHeader ? vals[origHeader] : ''
      }

      const tempRaw = parseFloat(getMappedValue('temperature')) || 0
      const mileageRaw = parseFloat(getMappedValue('mileage')) || 0
      const capacityRaw = parseFloat(getMappedValue('vehicleCapacity')) || 0

      const tempConv = defaultUnits.temperature
        ? convertValue(tempRaw, 'temperature', defaultUnits.temperature.from, defaultUnits.temperature.to)
        : tempRaw

      const mileageConv = defaultUnits.mileage
        ? convertValue(mileageRaw, 'mileage', defaultUnits.mileage.from, defaultUnits.mileage.to)
        : mileageRaw

      const capacityConv = defaultUnits.vehicleCapacity
        ? convertValue(capacityRaw, 'vehicleCapacity', defaultUnits.vehicleCapacity.from, defaultUnits.vehicleCapacity.to)
        : capacityRaw

      const isTempAnomaly = tempConv > 0 || tempConv < -60
      const isMileageAnomaly = mileageConv < 0 || mileageConv > 2000
      const isCapacityAnomaly = capacityConv < 0 || capacityConv > 100
      const isAnomaly = isTempAnomaly || isMileageAnomaly || isCapacityAnomaly
      const anomalyReason = [
        isTempAnomaly ? `温度异常(${tempConv}°C)` : '',
        isMileageAnomaly ? `里程异常(${mileageConv}km)` : '',
        isCapacityAnomaly ? `容量异常(${capacityConv}吨)` : '',
      ].filter(Boolean).join('；')

      return {
        dataSourceId: dsId,
        originalFieldName: headers.join(','),
        standardFieldName: Object.values(defaultMap).filter(Boolean).join(','),
        originalValue: row.join(','),
        originalUnit: parsed
          .map((p) => p.detectedUnit || '')
          .filter(Boolean)
          .join(','),
        convertedValue: tempConv,
        targetUnit: '℃',
        conversionVersionId: 'V1',
        isAnomaly,
        anomalyReason,
        routeId: getMappedValue('routeId') || `R-${String(rowIdx + 1).padStart(3, '0')}`,
        warehouseId: getMappedValue('warehouseId') || 'WH-UNKNOWN',
        temperature: tempConv,
        mileage: mileageConv,
        vehicleCapacity: capacityConv,
      }
    })

    const inserted = await addRecords(recs)
    setImportMessage(`成功导入 ${inserted.length} 条记录，来源：${name}`)
    setTimeout(() => setImportMessage(null), 5000)
  }, [sourceType, sourceName, addDataSource, addRecords, parseHeaders])

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const validExts = ['csv', 'xlsx', 'xls']

    if (!ext || !validExts.includes(ext)) {
      setImportMessage('不支持的文件格式，请上传 CSV 或 Excel 文件')
      setTimeout(() => setImportMessage(null), 5000)
      return
    }

    setSelectedFileName(file.name)
    setSourceName(file.name.replace(/\.(csv|xlsx|xls)$/i, ''))

    try {
      const buffer = await file.arrayBuffer()
      let headers: string[] = []
      let rows: string[][] = []

      if (ext === 'csv') {
        const text = new TextDecoder('utf-8').decode(buffer)
        const result = parseCSV(text)
        headers = result.headers
        rows = result.rows
        setCsvText(text)
      } else {
        const result = parseExcel(buffer)
        headers = result.headers
        rows = result.rows
        const csvContent = [
          headers.join(','),
          ...rows.map((r) => r.join(','))
        ].join('\n')
        setCsvText(csvContent)
      }

      processParsedData(headers, rows, file.name)
    } catch (e) {
      setImportMessage('文件解析失败：' + (e as Error).message)
      setTimeout(() => setImportMessage(null), 5000)
    }
  }, [processParsedData])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImport = async () => {
    if (!csvText.trim()) {
      setImportMessage('请先输入或粘贴 CSV 数据，或上传文件')
      return
    }
    const { headers, rows } = parseCSV(csvText)
    await processParsedData(headers, rows, selectedFileName || SOURCE_TYPE_LABELS[sourceType])
  }

  const handleSaveMapping = async () => {
    for (const [orig, std] of Object.entries(fieldMap)) {
      if (std) {
        await addFieldMapping({
          originalField: orig,
          standardField: std,
          createdAt: new Date().toISOString(),
        })
      }
    }
    let processed = 0
    if (currentSourceId !== null && parsedHeaders.length > 0) {
      processed = await reprocessRecordsBySource(currentSourceId, fieldMap, unitConvs, parsedHeaders)
    }
    setImportMessage(processed > 0
      ? `字段映射已保存，已重处理 ${processed} 条记录`
      : '字段映射已保存')
    setTimeout(() => setImportMessage(null), 5000)
  }

  const handleSaveConversion = async () => {
    const versionLabel = `V${unitConversions.length + 1}`
    for (const [field, conv] of Object.entries(unitConvs)) {
      const factors = UNIT_FACTORS[field as keyof typeof UNIT_FACTORS] || {}
      const factor = field === 'temperature'
        ? (conv.from === conv.to ? 1 : NaN)
        : ((factors[conv.to] || 1) / (factors[conv.from] || 1))
      await addUnitConversion({
        fromUnit: conv.from,
        toUnit: conv.to,
        factor: isNaN(factor) ? 1 : factor,
        version: versionLabel,
        createdAt: new Date().toISOString(),
      })
    }
    setImportMessage('单位换算规则已保存')
    setTimeout(() => setImportMessage(null), 3000)
  }

  const handleLoadDemo = (type: 'lecture' | 'screenshot') => {
    if (type === 'lecture') {
      setCsvText(DEMO_LECTURE_CSV)
      setSourceType('lecture')
      setSourceName('老师讲义-冷链运输台账')
    } else {
      setCsvText(DEMO_SCREENSHOT_CSV)
      setSourceType('screenshot')
      setSourceName('截图OCR-物流轨迹表')
    }
  }

  const handleEditRecord = (record: UnifiedRecord) => {
    setEditingRecordId(record.id!)
    setEditForm({
      routeId: record.routeId,
      warehouseId: record.warehouseId,
      temperature: record.temperature,
      mileage: record.mileage,
      vehicleCapacity: record.vehicleCapacity,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingRecordId) return
    await updateRecord(editingRecordId, editForm)
    setEditingRecordId(null)
    setEditForm({})
    setImportMessage('记录已更新')
    setTimeout(() => setImportMessage(null), 3000)
  }

  const handleClearAll = async () => {
    if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      await clearAllData()
      setCsvText('')
      setSourceName('')
      setParsedHeaders([])
      setFieldMap({})
      setUnitConvs({})
      setCurrentSourceId(null)
      setSelectedFileName(null)
      setIsDragging(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setImportMessage('所有数据已清空')
      setTimeout(() => setImportMessage(null), 3000)
    }
  }

  const sourceBadge = (type: DataSource['type']) => {
    const colors: Record<string, string> = {
      lecture: 'badge-info',
      business_table: 'badge-warning',
      screenshot: 'badge-danger',
      manual: 'badge-info',
    }
    return (
      <span className={`${colors[type]} text-xs`}>
        {SOURCE_TYPE_LABELS[type]}
      </span>
    )
  }

  const displayRecords = useMemo(() => [...records].reverse(), [records])

  const stats = useMemo(() => {
    const anomalyCount = records.filter((r) => r.isAnomaly).length
    const sources = [...new Set(records.map((r) => r.dataSourceId))]
    return {
      total: records.length,
      anomaly: anomalyCount,
      normal: records.length - anomalyCount,
      sourceCount: sources.length,
    }
  }, [records])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Upload className="w-5 h-5" /> 数据导入
        </h2>
        <div className="flex gap-2">
          {stats.total > 0 && (
            <button
              className="btn-danger flex items-center gap-1.5"
              onClick={handleClearAll}
            >
              <Trash2 className="w-3.5 h-3.5" /> 清空数据
            </button>
          )}
        </div>
      </div>

      {importMessage && (
        <div className="card p-3 bg-teal-50 border-teal-200 text-teal-900 text-sm flex items-center gap-2">
          <Save className="w-4 h-4" />
          {importMessage}
        </div>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-teal-800">{stats.total}</div>
            <div className="text-xs text-slate-500">总记录数</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{stats.normal}</div>
            <div className="text-xs text-slate-500">正常记录</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.anomaly}</div>
            <div className="text-xs text-slate-500">异常记录</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-navy-800">{stats.sourceCount}</div>
            <div className="text-xs text-slate-500">数据来源</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-5 space-y-4">
          <h3 className="font-semibold text-teal-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> 数据源录入
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <FileUp className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm text-slate-600">
              拖拽文件到此处，或<span className="text-teal-600 font-medium">点击选择文件</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              支持 CSV、Excel（.xlsx/.xls）格式
            </p>
            {selectedFileName && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs">
                <FileSpreadsheet className="w-3 h-3" />
                {selectedFileName}
              </div>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-white text-xs text-slate-400">或粘贴 CSV 文本</span>
            </div>
          </div>
          <textarea
            className="input-field min-h-[100px] font-mono text-xs"
            placeholder="粘贴 CSV 数据，第一行为表头..."
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">来源类型</label>
              <select
                className="select-field w-full"
                value={sourceType}
                onChange={(e) =>
                  setSourceType(e.target.value as DataSource['type'])
                }
              >
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">来源名称</label>
              <input
                className="input-field w-full"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="可选"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={handleImport}
            >
              <Upload className="w-4 h-4" /> 解析并导入
            </button>
            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => handleLoadDemo('lecture')}
            >
              <FileSpreadsheet className="w-4 h-4" /> 讲义样例
            </button>
            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => handleLoadDemo('screenshot')}
            >
              <FileSpreadsheet className="w-4 h-4" /> 截图样例(°F)
            </button>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h3 className="font-semibold text-teal-900 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> 字段映射面板
          </h3>
          {parsedHeaders.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {parsedHeaders.map((ph) => (
                <div key={ph.originalHeader} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="data-cell text-sm block truncate">
                      {ph.originalHeader}
                    </span>
                    {ph.detectedUnit && (
                      <span className="text-[10px] text-slate-400">
                        检测到单位：{ph.detectedUnit}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                  <select
                    className="select-field flex-1 text-xs"
                    value={fieldMap[ph.originalHeader] || ''}
                    onChange={(e) =>
                      setFieldMap((m) => ({
                        ...m,
                        [ph.originalHeader]: e.target.value,
                      }))
                    }
                  >
                    <option value="">-- 未映射 --</option>
                    {STANDARD_FIELDS.map((sf) => (
                      <option key={sf} value={sf}>
                        {FIELD_LABELS[sf] || sf}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                className="btn-primary w-full text-xs"
                onClick={handleSaveMapping}
              >
                保存映射规则
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">请先导入数据，系统将自动检测字段</p>
          )}
          {fieldMappings.length > 0 && (
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-medium text-slate-500">
                已保存映射规则（{fieldMappings.length}条）
              </p>
              <div className="max-h-[100px] overflow-y-auto space-y-1">
                {fieldMappings.map((m) => (
                  <p key={m.id} className="text-xs text-slate-600">
                    {m.originalField} → {FIELD_LABELS[m.standardField] || m.standardField}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-teal-900 flex items-center gap-2">
          <Ruler className="w-4 h-4" /> 单位标注与换算
        </h3>
        {Object.keys(unitConvs).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(unitConvs).map(([field, conv]) => {
              const def = DEFAULT_UNITS[field as keyof typeof DEFAULT_UNITS]
              if (!def) return null
              return (
                <div
                  key={field}
                  className="border border-slate-200 rounded-lg p-3 space-y-2"
                >
                  <p className="text-sm font-medium text-teal-800">
                    {FIELD_LABELS[field] || field}
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      className="select-field text-xs flex-1"
                      value={conv.from}
                      onChange={(e) =>
                        setUnitConvs((u) => ({
                          ...u,
                          [field]: { ...u[field], from: e.target.value },
                        }))
                      }
                    >
                      {[def.unit, ...def.alternatives].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400 text-xs">→</span>
                    <select
                      className="select-field text-xs flex-1"
                      value={conv.to}
                      onChange={(e) =>
                        setUnitConvs((u) => ({
                          ...u,
                          [field]: { ...u[field], to: e.target.value },
                        }))
                      }
                    >
                      {[def.unit, ...def.alternatives].map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {field === 'temperature'
                      ? conv.from === conv.to
                        ? '单位一致，无需换算'
                        : '温度将按公式自动换算'
                      : `换算系数: ${(
                          ((UNIT_FACTORS[field as keyof typeof UNIT_FACTORS]?.[conv.from] || 1) /
                            (UNIT_FACTORS[field as keyof typeof UNIT_FACTORS]?.[conv.to] || 1))
                        ).toFixed(4)} · 版本 V${unitConversions.length + 1}`}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            请先导入数据，系统将自动检测表头中的单位信息
          </p>
        )}
        {Object.keys(unitConvs).length > 0 && (
          <button className="btn-primary" onClick={handleSaveConversion}>
            保存换算规则
          </button>
        )}
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-teal-900 flex items-center gap-2">
            <Eye className="w-4 h-4" /> 数据预览表
          </h3>
          {currentSourceId && (
            <span className="text-xs text-slate-400">
              当前来源：{dataSources.find((d) => d.id === currentSourceId)?.name || '-'}
            </span>
          )}
        </div>
        {displayRecords.length > 0 ? (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    路线ID
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    仓库ID
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    温度(°C)
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    里程(km)
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    容量(吨)
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    来源
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    原始值
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    状态
                  </th>
                  <th className="text-left py-2 px-2 text-slate-500 font-medium text-xs">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((r) => {
                  const ds = dataSources.find((d) => d.id === r.dataSourceId)
                  const isEditing = editingRecordId === r.id
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-100 ${r.isAnomaly ? 'bg-amber-50' : ''}`}
                    >
                      {isEditing ? (
                        <>
                          <td className="py-1 px-2">
                            <input
                              className="input-field text-xs py-1 px-2"
                              value={editForm.routeId || ''}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, routeId: e.target.value }))
                              }
                            />
                          </td>
                          <td className="py-1 px-2">
                            <input
                              className="input-field text-xs py-1 px-2"
                              value={editForm.warehouseId || ''}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, warehouseId: e.target.value }))
                              }
                            />
                          </td>
                          <td className="py-1 px-2">
                            <input
                              type="number"
                              className="input-field text-xs py-1 px-2 w-20"
                              value={editForm.temperature ?? 0}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  temperature: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </td>
                          <td className="py-1 px-2">
                            <input
                              type="number"
                              className="input-field text-xs py-1 px-2 w-20"
                              value={editForm.mileage ?? 0}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  mileage: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </td>
                          <td className="py-1 px-2">
                            <input
                              type="number"
                              className="input-field text-xs py-1 px-2 w-20"
                              value={editForm.vehicleCapacity ?? 0}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  vehicleCapacity: parseFloat(e.target.value) || 0,
                                }))
                              }
                            />
                          </td>
                          <td colSpan={3} className="py-1 px-2">
                            <div className="flex gap-1">
                              <button
                                className="btn-primary text-xs py-1 px-2"
                                onClick={handleSaveEdit}
                              >
                                保存
                              </button>
                              <button
                                className="btn-ghost text-xs py-1 px-2"
                                onClick={() => {
                                  setEditingRecordId(null)
                                  setEditForm({})
                                }}
                              >
                                取消
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 px-2 data-cell">{r.routeId}</td>
                          <td className="py-1.5 px-2 data-cell">{r.warehouseId}</td>
                          <td className="py-1.5 px-2 data-cell">
                            {r.temperature.toFixed(1)}
                          </td>
                          <td className="py-1.5 px-2 data-cell">
                            {r.mileage.toFixed(1)}
                          </td>
                          <td className="py-1.5 px-2 data-cell">
                            {r.vehicleCapacity.toFixed(1)}
                          </td>
                          <td className="py-1.5 px-2">{ds ? sourceBadge(ds.type) : '-'}</td>
                          <td className="py-1.5 px-2 text-[10px] text-slate-400 font-mono max-w-[120px] truncate">
                            {r.originalValue}
                          </td>
                          <td className="py-1.5 px-2">
                            {r.isAnomaly ? (
                              <span className="badge-warning flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                异常
                              </span>
                            ) : (
                              <span className="badge-success">正常</span>
                            )}
                            {r.anomalyReason && (
                              <p className="text-[10px] text-amber-600 mt-0.5">
                                {r.anomalyReason}
                              </p>
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <div className="flex gap-1">
                              <button
                                className="text-xs text-teal-800 hover:underline"
                                onClick={() => handleEditRecord(r)}
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                              <button
                                className={`text-xs ${r.isAnomaly ? 'text-amber-600' : 'text-slate-400'}`}
                                onClick={() => toggleAnomaly(r.id!, r.isAnomaly)}
                                title={r.isAnomaly ? '取消异常标记' : '标记为异常'}
                              >
                                <AlertTriangle
                                  className={`w-3 h-3 ${r.isAnomaly ? 'fill-amber-400' : ''}`}
                                />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">
            暂无数据，请先导入 CSV 台账
          </p>
        )}
      </section>
    </div>
  )
}
