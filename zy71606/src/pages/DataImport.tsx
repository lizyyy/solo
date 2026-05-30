import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { FileType, ImportRecord } from '@/lib/api'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react'

const TABS: { value: FileType; label: string }[] = [
  { value: 'position', label: '持仓' },
  { value: 'market', label: '行情' },
  { value: 'deposit', label: '入金' },
  { value: 'notification', label: '通知记录' },
]

export default function DataImport() {
  const { batches, currentBatch, currentRecords, mergeResult, activeTab, loading } = useAppStore(s => s.imports)
  const uploadFiles = useAppStore(s => s.uploadFiles)
  const fetchImportStatus = useAppStore(s => s.fetchImportStatus)
  const confirmImport = useAppStore(s => s.confirmImport)
  const cancelImport = useAppStore(s => s.cancelImport)
  const setImportTab = useAppStore(s => s.setImportTab)
  const showConfirmModal = useAppStore(s => s.showConfirmModal)

  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const formData = new FormData()
    Array.from(files).forEach(f => formData.append('files', f))
    formData.append('file_type', activeTab)
    await uploadFiles(formData)
    if (batches.length > 0) {
      const latest = useAppStore.getState().imports.batches
      if (latest.length > 0) {
        await fetchImportStatus(latest[latest.length - 1].id)
      }
    }
  }, [activeTab, uploadFiles, fetchImportStatus, batches.length])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleConfirm = () => {
    if (!currentBatch) return
    showConfirmModal(
      '确认导入',
      `确认导入 ${currentBatch.success_rows} 条数据？增量合并不会覆盖已有数据。`,
      async () => {
        await confirmImport(currentBatch.id)
      }
    )
  }

  const handleCancel = async () => {
    if (!currentBatch) return
    await cancelImport(currentBatch.id)
  }

  const successCount = currentRecords.filter(r => r.status === 'success').length
  const errorCount = currentRecords.filter(r => r.status === 'error').length

  return (
    <div className="space-y-6">
      <div className="bg-bg-card border border-border rounded-lg">
        <div className="flex border-b border-border">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setImportTab(tab.value)}
              className={`flex items-center gap-2 px-5 py-3 text-sm transition-colors border-b-2 ${
                activeTab === tab.value
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <FileSpreadsheet size={16} />
              {tab.label}
            </button>
          ))}
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`p-8 border-2 border-dashed rounded-b-lg transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border'
          }`}
        >
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-3 text-text-secondary" />
            <p className="text-sm text-text-secondary mb-2">拖拽文件到此处或点击选择</p>
            <label className="inline-block px-4 py-2 rounded-md text-sm bg-bg-secondary border border-border text-text-primary cursor-pointer hover:bg-bg-primary transition-colors">
              选择文件
              <input
                type="file"
                multiple
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={e => handleFiles(e.target.files)}
              />
            </label>
          </div>
        </div>
      </div>

      {currentRecords.length > 0 && (
        <div className="bg-bg-card border border-border rounded-lg">
          <div className="flex items-center gap-6 p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-safe" />
              <span className="text-sm text-text-secondary">成功: <span className="text-safe font-mono-num">{successCount}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-force-liq" />
              <span className="text-sm text-text-secondary">错误: <span className="text-force-liq font-mono-num">{errorCount}</span></span>
            </div>
            <div className="text-sm text-text-secondary">总计: <span className="font-mono-num">{currentRecords.length}</span></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="text-left px-4 py-3 font-medium">行号</th>
                  <th className="text-left px-4 py-3 font-medium">数据预览</th>
                  <th className="text-left px-4 py-3 font-medium">状态</th>
                  <th className="text-left px-4 py-3 font-medium">错误信息</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map(r => (
                  <tr
                    key={r.id}
                    className={`border-b border-border/50 ${
                      r.status === 'error' ? 'bg-force-liq/5' : r.status === 'success' ? 'bg-safe/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono-num text-text-secondary">{r.row_number}</td>
                    <td className="px-4 py-3 text-text-primary max-w-xs truncate">{r.raw_content}</td>
                    <td className="px-4 py-3">
                      {r.status === 'success' ? (
                        <span className="flex items-center gap-1 text-safe text-xs"><CheckCircle size={14} /> 成功</span>
                      ) : r.status === 'error' ? (
                        <span className="flex items-center gap-1 text-force-liq text-xs"><XCircle size={14} /> 错误</span>
                      ) : (
                        <span className="text-text-secondary text-xs">{r.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{r.error_message || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 p-4 border-t border-border">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
            >
              <X size={14} /> 取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={successCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} /> 确认导入
            </button>
          </div>
        </div>
      )}

      {mergeResult && (
        <div className="bg-bg-card border border-safe/30 rounded-lg p-4">
          <h3 className="font-heading font-semibold text-text-primary mb-3">导入结果</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="font-mono-num text-2xl text-safe">{mergeResult.merged}</div>
              <div className="text-xs text-text-secondary mt-1">新增记录</div>
            </div>
            <div className="text-center">
              <div className="font-mono-num text-2xl text-text-primary">{mergeResult.preserved}</div>
              <div className="text-xs text-text-secondary mt-1">旧数据保留</div>
            </div>
            <div className="text-center">
              <div className="font-mono-num text-2xl text-accent">{mergeResult.risk_updated}</div>
              <div className="text-xs text-text-secondary mt-1">风险率更新</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
