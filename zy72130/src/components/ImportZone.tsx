import { useCallback } from 'react'
import { Upload, FileWarning } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { ImportResult } from '@/types'

export default function ImportZone() {
  const { importFiles, importResult, clearImportResult } = useStore()

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer.files.length > 0) {
        importFiles(e.dataTransfer.files)
      }
    },
    [importFiles],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        importFiles(e.target.files)
        e.target.value = ''
      }
    },
    [importFiles],
  )

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className="border-2 border-dashed border-neon/40 rounded-xl p-8 text-center
                   hover:border-neon hover:bg-neon-glow transition-all duration-300
                   cursor-pointer group"
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload className="mx-auto h-8 w-8 text-neon/60 group-hover:text-neon transition-colors mb-3" />
        <p className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
          拖拽文件到此处，或点击上传
        </p>
        <p className="text-xs text-muted mt-1">
          支持 Excel / 音频 / 图片 / 文本 — 坏文件不会拖垮整批
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.mp3,.wav,.flac,.png,.jpg,.jpeg,.pdf,.txt"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {importResult && <ImportSummary result={importResult} onClose={clearImportResult} />}
    </div>
  )
}

function ImportSummary({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return (
    <div className="card animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-neon" />
          <span className="text-sm font-medium text-white">导入结果</span>
        </div>
        <button onClick={onClose} className="text-xs text-muted hover:text-white transition-colors">
          关闭
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="text-center">
          <div className="text-xl font-mono font-bold text-white">{result.totalFiles}</div>
          <div className="text-xs text-muted">总文件</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-mono font-bold text-neon">{result.successCount}</div>
          <div className="text-xs text-muted">成功</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-mono font-bold text-danger">{result.failCount}</div>
          <div className="text-xs text-muted">失败</div>
        </div>
      </div>

      {result.failedFiles.length > 0 && (
        <div className="border-t border-surface-border pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <FileWarning className="h-3.5 w-3.5 text-danger" />
            <span className="text-xs font-medium text-danger">失败文件明细</span>
          </div>
          <div className="space-y-1">
            {result.failedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 truncate max-w-[200px]">{f.fileName}</span>
                <span className="text-danger shrink-0">— {f.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.importedRecords.length > 0 && (
        <div className="border-t border-surface-border pt-3 mt-3">
          <span className="text-xs text-muted">
            已导入 {result.importedRecords.length} 条分账记录
          </span>
        </div>
      )}
    </div>
  )
}
