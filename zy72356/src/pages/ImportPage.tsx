import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, AlertCircle } from 'lucide-react'
import { useStore } from '@/store'
import { importRecords, fetchRecords } from '@/api'
import { StatusBadge, UnitBadge, SourceBadge } from '@/components/Badges'
import type { RecordDetail } from '@/store'

export default function ImportPage() {
  const { records, recordsTotal, recordsLoading, recordsPage, recordsFilter, setRecords, setRecordsLoading, setImportResult, importResult } = useStore()
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayValue = (r: RecordDetail) => r.correctedValue ?? r.temperatureValue
  const displayUnit = (r: RecordDetail) => r.correctedUnit ?? r.temperatureUnit

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const result = await importRecords(file)
      setImportResult({ imported: result.imported, mixed: result.mixed, normal: result.normal })
      await Promise.all([loadRecords(), useStore.getState().refreshReport()])
    } catch (e: any) {
      setError(e.message || '导入失败')
    } finally {
      setUploading(false)
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function loadRecords() {
    setRecordsLoading(true)
    try {
      const result = await fetchRecords({
        status: recordsFilter.status,
        sensorId: recordsFilter.sensorId,
        page: recordsPage,
        pageSize: 100,
      })
      setRecords(result.records as RecordDetail[], result.total)
    } catch (e: any) {
      console.error(e)
    }
  }

  const mixedCount = records.filter(r => r.status === 'mixed_unit').length
  const normalCount = records.filter(r => r.status === 'normal').length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">数据导入</h2>
        <p className="text-slate-500 text-sm mt-1">传感器编号第一次导入，保留原始行号，自动检测温度单位混用</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X size={18} />
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-slate-300 hover:border-slate-400 bg-white'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${dragOver ? 'bg-emerald-100' : 'bg-slate-100'}`}>
            <Upload className={dragOver ? 'text-emerald-600' : 'text-slate-500'} size={28} />
          </div>
          <div>
            <p className="text-slate-900 font-medium">
              {uploading ? '正在导入...' : '拖拽 CSV/Excel 文件到此处，或点击上传'}
            </p>
            <p className="text-slate-500 text-sm mt-1">支持列名：sensor_id / 传感器编号 / temperature / 温度 / unit / 单位</p>
          </div>
        </div>
      </div>

      {(importResult || records.length > 0) && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <FileSpreadsheet size={16} />
              <span>已导入</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 font-mono">{recordsTotal}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <CheckCircle2 size={16} />
              <span>正常</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600 font-mono">{normalCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-amber-200 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 text-sm mb-1">
              <AlertTriangle size={16} />
              <span>混用待复核</span>
            </div>
            <p className="text-3xl font-bold text-amber-600 font-mono">{mixedCount}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <span>传感器编号</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 font-mono">
              {new Set(records.map(r => r.sensorId)).size}
            </p>
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">导入预览</h3>
            <div className="flex gap-2">
              <select
                value={recordsFilter.status || ''}
                onChange={(e) => useStore.getState().setRecordsFilter({ ...recordsFilter, status: e.target.value || undefined })}
                className="text-sm px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-emerald-500"
              >
                <option value="">全部状态</option>
                <option value="normal">正常</option>
                <option value="mixed_unit">混用待复核</option>
                <option value="confirmed">已确认</option>
                <option value="rolled_back">已回滚</option>
              </select>
              <button
                onClick={loadRecords}
                className="text-sm px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
              >
                刷新
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">行号</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">传感器编号</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-500">温度值</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">单位</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">状态</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">数据来源</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-500">导入时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className={r.status === 'mixed_unit' ? 'bg-amber-50/60' : ''}>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{r.originalLineNo}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-900">{r.sensorId}</td>
                    <td className="px-4 py-2.5 font-mono text-right text-slate-900">
                      {displayValue(r)}
                    </td>
                    <td className="px-4 py-2.5"><UnitBadge unit={displayUnit(r)} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5"><SourceBadge source={r.source} /></td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">
                      {new Date(r.createdAt).toLocaleString('zh-CN')}
                    </td>
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
