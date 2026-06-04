import { useState, useRef } from 'react'
import { Upload, AlertTriangle, Check, Image, FileText, Hash } from 'lucide-react'
import { useAssessmentStore } from '@/stores/assessmentStore'
import StatusBadge from '@/components/StatusBadge'
import { Link } from 'react-router-dom'

const mockPhotos = [
  { fileName: '工况照片001.jpg', fileHash: 'photo-hash-001', lineNumber: 1, rawConclusion: '制动距离：2.3m', rawDirection: '正方向' },
  { fileName: '工况照片002.jpg', fileHash: 'photo-hash-002', lineNumber: 2, rawConclusion: '制动距离：5.8m 异常', rawDirection: '向左' },
  { fileName: '工况照片003.jpg', fileHash: 'photo-hash-003', lineNumber: 3, rawConclusion: '制动距离：1.9m', rawDirection: '正方向' },
  { fileName: '工况照片004.jpg', fileHash: 'photo-hash-004', lineNumber: 4, rawConclusion: '制动距离：3.2m', rawDirection: '向右' },
  { fileName: '工况照片005.jpg', fileHash: 'photo-hash-005', lineNumber: 5, rawConclusion: '制动距离：6.1m 明显异常', rawDirection: '负方向' },
]

export default function ImportPage() {
  const { importPhotos, importResult, clearImportResult, loading, fetchBoundaryRules, boundaryRules } = useAssessmentStore()
  const [files, setFiles] = useState<typeof mockPhotos>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = () => {
    const selected = [...mockPhotos].slice(0, Math.floor(Math.random() * 3) + 3)
    setFiles(selected)
    clearImportResult()
  }

  const handleImport = async () => {
    fetchBoundaryRules()
    await importPhotos(files)
  }

  const handleImportAll = async () => {
    fetchBoundaryRules()
    await importPhotos(mockPhotos)
  }

  const triggerBoundary = (direction: string) => {
    return boundaryRules.some(r => direction.includes(r.pattern))
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">工况照片导入</h1>
        <p className="text-sm text-zinc-500 mt-1">第 1 / 3 步：批量导入工况照片，系统自动去重并提取行号与结论</p>
      </div>

      <div
        onClick={handleFileSelect}
        className="border-2 border-dashed border-zinc-300 rounded-lg p-12 text-center hover:border-[#1B3A4B] hover:bg-zinc-50 transition-colors cursor-pointer mb-6"
      >
        <Upload className="mx-auto mb-3 text-zinc-400" size={40} />
        <p className="text-zinc-600 font-medium mb-1">点击或拖拽工况照片到此处</p>
        <p className="text-xs text-zinc-400">支持批量上传，系统将自动按文件哈希+行号去重</p>
        <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" />
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">待导入 ({files.length} 条)</span>
            <div className="flex gap-2">
              <button
                onClick={handleImportAll}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-zinc-100 text-zinc-600 rounded hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                导入全部5条测试数据
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-[#1B3A4B] text-white rounded hover:bg-[#152d3a] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check size={14} />
                确认导入
              </button>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="text-left px-5 py-2.5 font-normal">文件名</th>
                <th className="text-left px-5 py-2.5 font-normal">原始行号</th>
                <th className="text-left px-5 py-2.5 font-normal">提取结论</th>
                <th className="text-left px-5 py-2.5 font-normal">方向</th>
                <th className="text-left px-5 py-2.5 font-normal">状态</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => {
                const hasBoundary = triggerBoundary(f.rawDirection || '')
                return (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Image size={16} className="text-zinc-400" />
                        <span className="text-zinc-700">{f.fileName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Hash size={14} className="text-zinc-400" />
                        <span className="text-zinc-700 font-mono">{f.lineNumber}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <FileText size={14} className="text-zinc-400" />
                        <span className="text-zinc-700">{f.rawConclusion}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={hasBoundary ? 'text-amber-600 font-medium' : 'text-zinc-700'}>
                        {hasBoundary && '⚠ '}
                        {f.rawDirection}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status="待补看" boundaryFlag={hasBoundary ? 1 : 0} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {files.some(f => triggerBoundary(f.rawDirection || '')) && (
            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">边界值检测：</span>
                  检测到非标方向表述（如"向左"），导入后将自动标记为"待实验老师复核"，不会直接归正常。
                  <Link to="/boundary-rules" className="underline ml-1">查看边界规则</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {importResult && (
        <div className="mt-6 p-5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-800 mb-3">
            <Check size={20} />
            <span className="font-bold">导入完成</span>
          </div>
          <p className="text-sm text-emerald-700 mb-2">成功导入 <strong>{importResult.imported}</strong> 条工况数据</p>
          {importResult.duplicates.length > 0 && (
            <div className="text-sm text-amber-700">
              <AlertTriangle size={14} className="inline mr-1" />
              跳过 <strong>{importResult.duplicates.length}</strong> 条重复数据（按文件哈希+行号去重）：
              <ul className="mt-1 ml-6 list-disc">
                {importResult.duplicates.map((d, i) => (
                  <li key={i}>{d.fileName} - 行号 {d.lineNumber}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-3">
            <Link to="/review" className="px-4 py-2 text-sm bg-[#1B3A4B] text-white rounded hover:bg-[#152d3a] transition-colors">
              前往第 2 步：补看巡检备注 →
            </Link>
            <button onClick={clearImportResult} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-800">
              继续导入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
