import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, AlertCircle, CheckCircle, Download, Upload, Database, Camera, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { CorrosionPoint, ImportError, Severity } from '@/types'

const COLUMN_MAPPINGS: Record<string, string[]> = {
  id: ['点位ID', 'point_id', 'id', '编号', '点位编号'],
  pipeId: ['管线编号', '管段', 'pipe_id', 'pipeId', '管线', '管段编号'],
  x: ['坐标X', 'x', 'X', 'X坐标'],
  y: ['坐标Y', 'y', 'Y', 'Y坐标'],
  z: ['坐标Z', 'z', 'Z', 'Z坐标'],
  severity: ['腐蚀等级', '严重度', 'severity', '等级', '腐蚀程度'],
  depth: ['腐蚀深度', 'depth', '深度(mm)', '深度', '腐蚀深度(mm)'],
  thickness: ['壁厚', '剩余壁厚', 'thickness', '壁厚(mm)'],
  inspectedAt: ['巡检日期', '检测日期', 'inspectedAt', 'date', '日期', '检测时间'],
  description: ['备注', '描述', 'description', '说明'],
  source: ['来源', 'source'],
}

const SEVERITY_MAP: Record<string, Severity> = {
  '无腐蚀': 'none',
  '无': 'none',
  'none': 'none',
  '轻微': 'minor',
  '轻度': 'minor',
  'minor': 'minor',
  '中等': 'moderate',
  '中度': 'moderate',
  'moderate': 'moderate',
  '较重': 'severe',
  '重度': 'severe',
  'severe': 'severe',
  '严重': 'critical',
  'critical': 'critical',
  '危急': 'critical',
}

const TEMPLATE_DATA = [
  {
    '点位ID': 'pt-100',
    '管线编号': '管段A-1',
    '坐标X': -4,
    '坐标Y': 0.15,
    '坐标Z': -3,
    '腐蚀等级': '轻微',
    '腐蚀深度(mm)': 1.2,
    '剩余壁厚(mm)': 10.8,
    '巡检日期': '2026-04-14',
    '备注': 'A区1号管线西段，轻微点蚀',
    '来源': 'excel',
  },
  {
    '点位ID': 'pt-101',
    '管线编号': '管段B-2',
    '坐标X': 2,
    '坐标Y': 1.65,
    '坐标Z': -2,
    '腐蚀等级': '严重',
    '腐蚀深度(mm)': 6.3,
    '剩余壁厚(mm)': 5.0,
    '巡检日期': '2026-04-20',
    '备注': 'B区2号管线东南段，严重坑蚀',
    '来源': 'excel',
  },
]

type ParsedRow = Record<string, unknown>
type ValidatedRow = {
  row: ParsedRow
  rowNumber: number
  errors: ImportError[]
  point?: CorrosionPoint
}

export default function ImportZone() {
  const excelRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [photoCount, setPhotoCount] = useState<number>(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{ imported: number; errors: number } | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const batchImportPoints = useStore((s) => s.batchImportPoints)
  const clearImportErrors = useStore((s) => s.clearImportErrors)
  const addImportErrors = useStore((s) => s.addImportErrors)
  const pipes = useStore((s) => s.pipes)
  const points = useStore((s) => s.points)

  const detectColumnMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {}
    for (const targetField of Object.keys(COLUMN_MAPPINGS)) {
      const aliases = COLUMN_MAPPINGS[targetField]
      for (const alias of aliases) {
        const matchedHeader = headers.find(
          (h) => h.trim().toLowerCase() === alias.toLowerCase()
        )
        if (matchedHeader) {
          mapping[targetField] = matchedHeader
          break
        }
      }
    }
    return mapping
  }

  const validateRow = (
    row: ParsedRow,
    rowNumber: number,
    sourceFile: string,
    existingIds: Set<string>,
    processedIds: Set<string>,
    pipeIdMap: Map<string, string>
  ): ValidatedRow => {
    const errors: ImportError[] = []
    const point: Partial<CorrosionPoint> = {}

    const getValue = (field: string) => {
      const col = columnMap[field]
      return col ? row[col] : undefined
    }

    const id = String(getValue('id') ?? '').trim()
    if (!id) {
      errors.push({
        id: '',
        rowNumber,
        field: 'id',
        value: '',
        errorType: 'missing_field',
        message: '点位ID不能为空',
        sourceFile,
      })
    } else {
      point.id = id
      if (existingIds.has(id) || processedIds.has(id)) {
        errors.push({
          id: '',
          rowNumber,
          field: 'id',
          value: id,
          errorType: 'duplicate_id',
          message: `点位ID ${id} 已存在`,
          sourceFile,
        })
      }
      processedIds.add(id)
    }

    const pipeIdRaw = String(getValue('pipeId') ?? '').trim()
    if (!pipeIdRaw) {
      errors.push({
        id: '',
        rowNumber,
        field: 'pipeId',
        value: '',
        errorType: 'missing_field',
        message: '管线编号不能为空',
        sourceFile,
      })
    } else {
      const mappedPipeId = pipeIdMap.get(pipeIdRaw) || pipeIdRaw
      const pipeExists = pipes.some((p) => p.id === mappedPipeId || p.aliasExcel === pipeIdRaw || p.aliasGis === pipeIdRaw)
      if (!pipeExists) {
        errors.push({
          id: '',
          rowNumber,
          field: 'pipeId',
          value: pipeIdRaw,
          errorType: 'unknown_pipe',
          message: `管线 ${pipeIdRaw} 不存在于系统中`,
          sourceFile,
        })
      } else {
        point.pipeId = mappedPipeId
      }
    }

    const xRaw = getValue('x')
    const yRaw = getValue('y')
    const zRaw = getValue('z')

    const x = xRaw !== undefined && xRaw !== '' ? Number(xRaw) : NaN
    const y = yRaw !== undefined && yRaw !== '' ? Number(yRaw) : NaN
    const z = zRaw !== undefined && zRaw !== '' ? Number(zRaw) : NaN

    if (isNaN(x)) {
      errors.push({
        id: '',
        rowNumber,
        field: 'x',
        value: String(xRaw ?? ''),
        errorType: 'invalid_format',
        message: 'X坐标必须为有效数字',
        sourceFile,
      })
    } else {
      point.x = x
    }

    if (isNaN(y)) {
      errors.push({
        id: '',
        rowNumber,
        field: 'y',
        value: String(yRaw ?? ''),
        errorType: 'invalid_format',
        message: 'Y坐标必须为有效数字',
        sourceFile,
      })
    } else {
      point.y = y
    }

    if (isNaN(z)) {
      errors.push({
        id: '',
        rowNumber,
        field: 'z',
        value: String(zRaw ?? ''),
        errorType: 'invalid_format',
        message: 'Z坐标必须为有效数字',
        sourceFile,
      })
    } else {
      point.z = z
    }

    const severityRaw = String(getValue('severity') ?? '').trim()
    if (severityRaw) {
      const severity = SEVERITY_MAP[severityRaw] || SEVERITY_MAP[severityRaw.toLowerCase()]
      if (!severity) {
        errors.push({
          id: '',
          rowNumber,
          field: 'severity',
          value: severityRaw,
          errorType: 'invalid_format',
          message: `腐蚀等级 "${severityRaw}" 无效，有效值: 无腐蚀/轻微/中等/较重/严重`,
          sourceFile,
        })
      } else {
        point.severity = severity
      }
    } else {
      point.severity = 'none'
    }

    const depthRaw = getValue('depth')
    if (depthRaw !== undefined && depthRaw !== '') {
      const depth = Number(depthRaw)
      if (isNaN(depth)) {
        errors.push({
          id: '',
          rowNumber,
          field: 'depth',
          value: String(depthRaw),
          errorType: 'invalid_format',
          message: '腐蚀深度必须为有效数字',
          sourceFile,
        })
      } else if (depth < 0 || depth > 20) {
        errors.push({
          id: '',
          rowNumber,
          field: 'depth',
          value: String(depth),
          errorType: 'out_of_range',
          message: `腐蚀深度 ${depth}mm 超出有效范围 (0-20mm)`,
          sourceFile,
        })
      } else {
        point.depth = depth
      }
    }

    const thicknessRaw = getValue('thickness')
    if (thicknessRaw !== undefined && thicknessRaw !== '') {
      const thickness = Number(thicknessRaw)
      if (isNaN(thickness)) {
        errors.push({
          id: '',
          rowNumber,
          field: 'thickness',
          value: String(thicknessRaw),
          errorType: 'invalid_format',
          message: '壁厚必须为有效数字',
          sourceFile,
        })
      } else if (thickness < 0 || thickness > 50) {
        errors.push({
          id: '',
          rowNumber,
          field: 'thickness',
          value: String(thickness),
          errorType: 'out_of_range',
          message: `壁厚 ${thickness}mm 超出有效范围 (0-50mm)`,
          sourceFile,
        })
      } else {
        point.thickness = thickness
      }
    }

    const inspectedAtRaw = getValue('inspectedAt')
    if (inspectedAtRaw !== undefined && inspectedAtRaw !== '') {
      const dateStr = String(inspectedAtRaw)
      const parsedDate = new Date(dateStr)
      if (isNaN(parsedDate.getTime())) {
        errors.push({
          id: '',
          rowNumber,
          field: 'inspectedAt',
          value: dateStr,
          errorType: 'invalid_format',
          message: `日期格式无效: ${dateStr}`,
          sourceFile,
        })
      } else {
        point.inspectedAt = parsedDate.toISOString()
      }
    } else {
      point.inspectedAt = new Date().toISOString()
    }

    const descriptionRaw = getValue('description')
    if (descriptionRaw !== undefined && descriptionRaw !== '') {
      point.description = String(descriptionRaw)
    }

    point.source = 'excel'
    point.sourceFile = sourceFile
    point.importedAt = new Date().toISOString()
    point.status = 'normal'

    if (point.severity && point.severity !== 'none') {
      point.status = 'anomaly'
    }

    return {
      row,
      rowNumber,
      errors,
      point: errors.length === 0 ? (point as CorrosionPoint) : undefined,
    }
  }

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    clearImportErrors()
    setImportResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ParsedRow[]

      setParsedData(jsonData)

      if (jsonData.length > 0) {
        const headers = Object.keys(jsonData[0])
        const mapping = detectColumnMapping(headers)
        setColumnMap(mapping)

        const existingIds = new Set(points.map((p) => p.id))
        const processedIds = new Set<string>()
        const pipeIdMap = new Map<string, string>()
        pipes.forEach((p) => {
          pipeIdMap.set(p.aliasExcel, p.id)
          pipeIdMap.set(p.aliasGis, p.id)
          pipeIdMap.set(p.name, p.id)
          pipeIdMap.set(p.id, p.id)
        })

        const validated = jsonData.map((row, idx) =>
          validateRow(row, idx + 2, file.name, existingIds, processedIds, pipeIdMap)
        )
        setValidatedRows(validated)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPhotoCount(files.length)
  }

  const handleGisImport = () => {
    alert('GIS数据已模拟导入')
  }

  const handleConfirmImport = () => {
    const validPoints = validatedRows
      .filter((r) => r.errors.length === 0 && r.point)
      .map((r) => r.point!)

    const allErrors = validatedRows.flatMap((r) => r.errors)

    if (allErrors.length > 0) {
      addImportErrors(allErrors)
    }

    const result = batchImportPoints(validPoints, fileName || 'excel_import.xlsx')
    setImportResult({ imported: result.imported, errors: allErrors.length })
  }

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet(TEMPLATE_DATA)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '腐蚀点位导入模板')
    XLSX.writeFile(workbook, '腐蚀点位导入模板.xlsx')
  }

  const handleClear = () => {
    setParsedData([])
    setValidatedRows([])
    setColumnMap({})
    setFileName(null)
    setImportResult(null)
    setShowErrors(false)
    if (excelRef.current) excelRef.current.value = ''
  }

  const totalErrors = validatedRows.reduce((sum, r) => sum + r.errors.length, 0)
  const hasErrors = totalErrors > 0
  const errorRows = validatedRows.filter((r) => r.errors.length > 0)

  const previewColumns = parsedData.length > 0 ? Object.keys(parsedData[0]) : []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/30 bg-white/[0.03] p-6 transition-colors hover:border-cyan-500/50">
          <Database size={32} className="mb-3 text-cyan-400" />
          <p className="mb-3 text-sm text-gray-400">GIS数据</p>
          <button
            onClick={handleGisImport}
            className="rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
          >
            <Upload size={14} className="mr-1.5 inline" />
            点击模拟导入 GIS 数据
          </button>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/30 bg-white/[0.03] p-6 transition-colors hover:border-cyan-500/50">
          <FileSpreadsheet size={32} className="mb-3 text-cyan-400" />
          <p className="mb-3 text-sm text-gray-400">Excel文件</p>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelChange}
          />
          <div className="flex gap-2">
            <button
              onClick={() => excelRef.current?.click()}
              className="rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
            >
              <Upload size={14} className="mr-1.5 inline" />
              上传 Excel
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="rounded-md border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-300"
            >
              <Download size={14} className="mr-1.5 inline" />
              下载模板
            </button>
          </div>
          {fileName && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-green-400">{fileName}</p>
              <button
                onClick={handleClear}
                className="text-gray-500 hover:text-gray-300"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/30 bg-white/[0.03] p-6 transition-colors hover:border-cyan-500/50">
          <Camera size={32} className="mb-3 text-cyan-400" />
          <p className="mb-3 text-sm text-gray-400">巡检照片</p>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            onClick={() => photoRef.current?.click()}
            className="rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
          >
            <Upload size={14} className="mr-1.5 inline" />
            上传巡检照片
          </button>
          {photoCount > 0 && (
            <p className="mt-2 text-xs text-green-400">已选择 {photoCount} 张照片</p>
          )}
        </div>
      </div>

      {parsedData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-cyan-400">数据预览</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-gray-400">
                  {validatedRows.filter((r) => r.errors.length === 0).length} 条有效
                </span>
              </div>
              {hasErrors && (
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300"
                >
                  <AlertCircle size={14} />
                  <span>{totalErrors} 个错误</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/10 bg-white/[0.05]">
                    <th className="px-3 py-2.5 text-left font-medium text-gray-400">行号</th>
                    {previewColumns.map((col) => (
                      <th
                        key={col}
                        className={`px-3 py-2.5 text-left font-medium ${
                          Object.values(columnMap).includes(col)
                            ? 'text-cyan-400'
                            : 'text-gray-500'
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validatedRows.map((vRow, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-white/5 transition-colors ${
                        vRow.errors.length > 0
                          ? 'border-red-500/50 bg-red-500/5'
                          : idx % 2 === 0
                          ? 'bg-white/[0.02]'
                          : 'bg-white/[0.05]'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {vRow.rowNumber}
                      </td>
                      {previewColumns.map((col) => (
                        <td
                          key={col}
                          className={`px-3 py-2 text-gray-300 ${
                            vRow.errors.some((e) => columnMap[e.field!] === col)
                              ? 'text-red-400'
                              : ''
                          }`}
                        >
                          {String(vRow.row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showErrors && errorRows.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400" />
                <h4 className="text-sm font-semibold text-red-400">导入错误详情</h4>
              </div>
              <div className="max-h-60 space-y-2 overflow-auto">
                {errorRows.map((vRow) =>
                  vRow.errors.map((err, errIdx) => (
                    <div
                      key={`${vRow.rowNumber}-${errIdx}`}
                      className="flex items-start gap-3 rounded-md bg-black/30 p-3"
                    >
                      <span className="shrink-0 rounded bg-red-500/20 px-2 py-0.5 font-mono text-xs text-red-400">
                        第{vRow.rowNumber}行
                      </span>
                      <div className="flex-1 space-y-0.5">
                        <div className="text-xs">
                          <span className="text-gray-400">字段: </span>
                          <span className="font-mono text-red-300">{err.field}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-400">值: </span>
                          <span className="font-mono text-gray-300">{err.value || '(空)'}</span>
                        </div>
                        <p className="text-xs text-red-400">{err.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {Object.keys(columnMap).length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium text-gray-400">检测到的列映射</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(columnMap).map(([field, col]) => (
                  <span
                    key={field}
                    className="rounded bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300"
                  >
                    {col} → {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            {importResult ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 px-3 py-1.5">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-sm text-green-400">
                    成功导入 {importResult.imported} 条
                  </span>
                </div>
                {importResult.errors > 0 && (
                  <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5">
                    <AlertCircle size={14} className="text-red-400" />
                    <span className="text-sm text-red-400">
                      {importResult.errors} 条错误
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="rounded-md border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={validatedRows.length === 0 || importResult !== null}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  validatedRows.length === 0 || importResult !== null
                    ? 'cursor-not-allowed bg-gray-600/30 text-gray-500'
                    : hasErrors
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                }`}
              >
                <Database size={14} className="mr-1.5 inline" />
                {hasErrors ? `导入有效数据（${totalErrors}条错误将记录）` : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}

      {parsedData.length === 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-cyan-400">字段映射说明</h3>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.05]">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-400">系统字段</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-400">可识别的列名</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(COLUMN_MAPPINGS).map(([field, aliases]) => (
                  <tr key={field} className="border-b border-white/5">
                    <td className="px-4 py-2 font-mono text-cyan-300">{field}</td>
                    <td className="px-4 py-2 text-gray-400">{aliases.join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
