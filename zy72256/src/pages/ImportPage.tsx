import { useState, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { Upload, FileUp, CheckCircle2, AlertCircle } from 'lucide-react'
import TypeBadge from '@/components/TypeBadge'
import StatusBadge from '@/components/StatusBadge'
import type { ImportResponse } from '@shared/types'

export default function ImportPage() {
  const importFile = useStore((s) => s.importFile)
  const loading = useStore((s) => s.loading)
  const error = useStore((s) => s.error)
  const role = useStore((s) => s.role)
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      return
    }
    const res = await importFile(file, role === 'instructor' ? '老梁' : role)
    if (res) {
      setResult(res)
    }
  }, [importFile, role])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">数据导入</h2>
        <p className="text-gray-500 mt-1">上传 CSV 格式的坐标原点说明文件，系统将自动检测坐标类型</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-[#e8943a] bg-orange-50'
            : 'border-gray-300 hover:border-[#2a5a6a] hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="hidden"
        />
        <Upload size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700">
          拖拽 CSV 文件到此处，或点击选择文件
        </p>
        <p className="text-sm text-gray-400 mt-2">支持 .csv 格式</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#1a3a4a] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-600">正在导入并检测...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 fade-in">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{result.total_rows}</p>
              <p className="text-sm text-gray-500">总行数</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{result.normal_count}</p>
              <p className="text-sm text-gray-500">正常数</p>
            </div>
            <div className="bg-white rounded-lg border border-orange-200 p-4 text-center bg-orange-50/30">
              <p className="text-2xl font-bold text-[#e8943a]">{result.mixed_count}</p>
              <p className="text-sm text-gray-500">混合数</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">原始行号</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">建筑名称</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">坐标原点说明</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">坐标类型</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {result.records.map((r) => (
                    <tr
                      key={r.id}
                      className={`${
                        r.coordinate_type === 'mixed'
                          ? 'border-l-3 border-l-[#e8943a] bg-orange-50/40'
                          : ''
                      } hover:bg-gray-50 transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                        {r.original_line_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {r.building_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {r.coordinate_origin_description}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={r.coordinate_type} blink={r.coordinate_type === 'mixed'} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
