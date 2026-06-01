import { useState, useMemo } from 'react'
import { Upload, MapPin, Ruler, Eye, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store'
import {
  STANDARD_FIELDS,
  SOURCE_TYPE_LABELS,
  DEFAULT_UNITS,
  UNIT_FACTORS,
} from '@/types'
import type { DataSource, UnifiedRecord } from '@/types'

const DEMO_CSV = `路线ID,仓库ID,温度(℃),里程(km),容量(吨)
R-001,WH-A,-18.5,120,8
R-001,WH-B,-22.0,85,12
R-002,WH-A,-15.0,200,6
R-002,WH-C,-20.5,150,10
R-003,WH-B,-25.0,95,15`

const NUMERIC_FIELDS = ['temperature', 'mileage', 'vehicleCapacity']

const FIELD_LABELS: Record<string, string> = {
  routeId: '路线ID', warehouseId: '仓库ID', temperature: '温度',
  mileage: '里程', vehicleCapacity: '容量',
}

export default function DataImport() {
  const { addDataSource, addRecords, addFieldMapping, addUnitConversion, records, dataSources, fieldMappings, unitConversions } = useStore()
  const [csvText, setCsvText] = useState('')
  const [sourceType, setSourceType] = useState<DataSource['type']>('business_table')
  const [sourceName, setSourceName] = useState('')
  const [detectedFields, setDetectedFields] = useState<string[]>([])
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({})
  const [unitConvs, setUnitConvs] = useState<Record<string, { from: string; to: string }>>({})
  const [currentSourceId, setCurrentSourceId] = useState<number | null>(null)

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n').filter((l) => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()))
    return { headers, rows }
  }

  const handleImport = async () => {
    if (!csvText.trim()) return
    const { headers, rows } = parseCSV(csvText)
    if (headers.length === 0) return
    const name = sourceName || SOURCE_TYPE_LABELS[sourceType]
    const dsId = await addDataSource({ type: sourceType, name, description: `导入${rows.length}条记录`, importedAt: new Date().toISOString() })
    setCurrentSourceId(dsId)
    setDetectedFields(headers)
    const defaultMap: Record<string, string> = {}
    const defaultUnits: Record<string, { from: string; to: string }> = {}
    headers.forEach((h) => {
      const match = STANDARD_FIELDS.find((f) => h.includes(FIELD_LABELS[f] || f) || h.toLowerCase().includes(f.toLowerCase()))
      if (match) {
        defaultMap[h] = match
        if (NUMERIC_FIELDS.includes(match) && DEFAULT_UNITS[match]) {
          defaultUnits[match] = { from: DEFAULT_UNITS[match].unit, to: DEFAULT_UNITS[match].unit }
        }
      }
    })
    setFieldMap(defaultMap)
    setUnitConvs(defaultUnits)
    const recs: Omit<UnifiedRecord, 'id'>[] = rows.map((row) => {
      const vals: Record<string, string> = {}
      headers.forEach((h, i) => { vals[h] = row[i] || '' })
      const getField = (std: string) => {
        const orig = Object.entries(defaultMap).find(([, v]) => v === std)?.[0]
        return orig ? vals[orig] : ''
      }
      const temp = parseFloat(getField('temperature')) || 0
      const mileage = parseFloat(getField('mileage')) || 0
      const capacity = parseFloat(getField('vehicleCapacity')) || 0
      return {
        dataSourceId: dsId, originalFieldName: headers.join(','), standardFieldName: Object.values(defaultMap).join(','),
        originalValue: row.join(','), originalUnit: DEFAULT_UNITS.temperature?.unit || '℃',
        convertedValue: temp, targetUnit: '℃', conversionVersionId: 'V1',
        isAnomaly: false, anomalyReason: '',
        routeId: getField('routeId'), warehouseId: getField('warehouseId'),
        temperature: temp, mileage, vehicleCapacity: capacity,
      }
    })
    await addRecords(recs)
  }

  const handleSaveMapping = async () => {
    for (const [orig, std] of Object.entries(fieldMap)) {
      await addFieldMapping({ originalField: orig, standardField: std, createdAt: new Date().toISOString() })
    }
  }

  const handleSaveConversion = async () => {
    let v = unitConversions.length + 1
    for (const [field, conv] of Object.entries(unitConvs)) {
      const factors = UNIT_FACTORS[field] || {}
      const fromF = factors[conv.from] || 1
      const toF = factors[conv.to] || 1
      const factor = toF / fromF
      await addUnitConversion({ fromUnit: conv.from, toUnit: conv.to, factor, version: `V${v++}`, createdAt: new Date().toISOString() })
    }
  }

  const handleLoadDemo = () => {
    setCsvText(DEMO_CSV)
    setSourceType('lecture')
    setSourceName('课程讲义示例')
  }

  const sourceBadge = (type: DataSource['type']) => {
    const colors: Record<string, string> = { lecture: 'badge-info', business_table: 'badge-warning', screenshot: 'badge-danger', manual: 'badge-info' }
    return <span className={`${colors[type]} text-xs`}>{SOURCE_TYPE_LABELS[type]}</span>
  }

  const displayRecords = useMemo(() => records, [records])

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <h2 className="section-title flex items-center gap-2"><Upload className="w-5 h-5" /> 数据导入</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-5 space-y-4">
          <h3 className="font-semibold text-teal-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> 数据源录入</h3>
          <textarea className="input-field min-h-[120px] font-mono text-sm" placeholder="粘贴CSV数据..." value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text">来源类型</label>
              <select className="select-field" value={sourceType} onChange={(e) => setSourceType(e.target.value as DataSource['type'])}>
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label-text">来源名称</label>
              <input className="input-field" value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="可选" />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-primary flex items-center gap-1.5" onClick={handleImport}><Upload className="w-4 h-4" /> 导入</button>
            <button className="btn-secondary flex items-center gap-1.5" onClick={handleLoadDemo}><FileSpreadsheet className="w-4 h-4" /> 示例数据</button>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <h3 className="font-semibold text-teal-900 flex items-center gap-2"><MapPin className="w-4 h-4" /> 字段映射面板</h3>
          {detectedFields.length > 0 ? (
            <div className="space-y-2">
              {detectedFields.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <span className="data-cell flex-1 text-sm">{f}</span>
                  <span className="text-slate-400">→</span>
                  <select className="select-field flex-1" value={fieldMap[f] || ''} onChange={(e) => setFieldMap((m) => ({ ...m, [f]: e.target.value }))}>
                    <option value="">-- 未映射 --</option>
                    {STANDARD_FIELDS.map((sf) => <option key={sf} value={sf}>{FIELD_LABELS[sf] || sf}</option>)}
                  </select>
                </div>
              ))}
              <button className="btn-primary w-full" onClick={handleSaveMapping}>保存映射</button>
            </div>
          ) : <p className="text-sm text-slate-400">请先导入数据</p>}
          {fieldMappings.length > 0 && (
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-medium text-slate-500">已保存映射</p>
              {fieldMappings.map((m) => <p key={m.id} className="text-xs text-slate-600">{m.originalField} → {FIELD_LABELS[m.standardField] || m.standardField}</p>)}
            </div>
          )}
        </section>
      </div>

      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-teal-900 flex items-center gap-2"><Ruler className="w-4 h-4" /> 单位标注与换算</h3>
        {Object.keys(unitConvs).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(unitConvs).map(([field, conv]) => {
              const def = DEFAULT_UNITS[field]
              if (!def) return null
              return (
                <div key={field} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-teal-800">{FIELD_LABELS[field] || field}</p>
                  <div className="flex items-center gap-2">
                    <select className="select-field text-xs flex-1" value={conv.from} onChange={(e) => setUnitConvs((u) => ({ ...u, [field]: { ...u[field], from: e.target.value } }))}>
                      {[def.unit, ...def.alternatives].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <span className="text-slate-400">→</span>
                    <select className="select-field text-xs flex-1" value={conv.to} onChange={(e) => setUnitConvs((u) => ({ ...u, [field]: { ...u[field], to: e.target.value } }))}>
                      {[def.unit, ...def.alternatives].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-slate-500">系数: {((UNIT_FACTORS[field]?.[conv.to] || 1) / (UNIT_FACTORS[field]?.[conv.from] || 1)).toFixed(4)} · V{unitConversions.length + 1}</p>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-slate-400">请先导入数据</p>}
        {Object.keys(unitConvs).length > 0 && <button className="btn-primary" onClick={handleSaveConversion}>保存换算</button>}
      </section>

      <section className="card p-5 space-y-4">
        <h3 className="font-semibold text-teal-900 flex items-center gap-2"><Eye className="w-4 h-4" /> 数据预览表</h3>
        {displayRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">路线ID</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">仓库ID</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">温度</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">里程</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">容量</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">来源</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">异常</th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((r) => {
                  const ds = dataSources.find((d) => d.id === r.dataSourceId)
                  return (
                    <tr key={r.id} className={`border-b border-slate-100 ${r.isAnomaly ? 'bg-amber-50' : ''}`}>
                      <td className="py-2 px-3 data-cell">{r.routeId}</td>
                      <td className="py-2 px-3 data-cell">{r.warehouseId}</td>
                      <td className="py-2 px-3 data-cell">{r.temperature}℃</td>
                      <td className="py-2 px-3 data-cell">{r.mileage}km</td>
                      <td className="py-2 px-3 data-cell">{r.vehicleCapacity}吨</td>
                      <td className="py-2 px-3">{ds ? sourceBadge(ds.type) : '-'}</td>
                      <td className="py-2 px-3">
                        <button className={`flex items-center gap-1 text-xs ${r.isAnomaly ? 'text-amber-600' : 'text-slate-400'}`} onClick={() => useStore.getState().toggleAnomaly(r.id!, !r.isAnomaly)}>
                          <AlertTriangle className={`w-3.5 h-3.5 ${r.isAnomaly ? 'fill-amber-400' : ''}`} />
                          {r.isAnomaly ? '异常' : '正常'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-slate-400">暂无数据</p>}
      </section>
    </div>
  )
}
