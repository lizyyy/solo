import { useState, useCallback } from 'react'
import { X, Upload, FileJson, FileText, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { validateDirection } from '@/utils/calibration'
import { clsx } from 'clsx'

interface PreviewRecord {
  startTemp: number
  endTemp: number
  tempDiff: number
  directionMark: string
  sensorId?: string
  validation: ReturnType<typeof validateDirection>
}

export function ImportModal() {
  const { setShowImportModal, importRecords, addToast } = useAppStore()
  const [dragActive, setDragActive] = useState(false)
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([])
  const [importMethod, setImportMethod] = useState<'file' | 'demo'>('demo')

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const parseFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        const records = Array.isArray(data) ? data : [data]

        const preview: PreviewRecord[] = records.map((r: any) => {
          const tempDiff = r.endTemp - r.startTemp
          return {
            startTemp: r.startTemp || 0,
            endTemp: r.endTemp || 0,
            tempDiff: r.tempDiff || tempDiff,
            directionMark: r.directionMark || '',
            sensorId: r.sensorId,
            validation: validateDirection(r.directionMark || '')
          }
        })

        setPreviewRecords(preview)
      } catch {
        addToast('error', '文件解析失败，请检查格式')
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      parseFile(files[0])
    }
  }, [addToast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      parseFile(files[0])
    }
  }

  const loadDemoData = () => {
    const demoRecords: PreviewRecord[] = [
      {
        startTemp: 22.0,
        endTemp: 36.5,
        tempDiff: 14.5,
        directionMark: '负方向',
        sensorId: 'SNS-BR-001',
        validation: validateDirection('负方向')
      },
      {
        startTemp: 20.5,
        endTemp: 35.2,
        tempDiff: 14.7,
        directionMark: '向左',
        sensorId: 'SNS-BR-002',
        validation: validateDirection('向左')
      },
      {
        startTemp: 24.0,
        endTemp: 38.8,
        tempDiff: 14.8,
        directionMark: '负方向',
        validation: validateDirection('负方向')
      }
    ]
    setPreviewRecords(demoRecords)
  }

  const handleImport = () => {
    importRecords(previewRecords)
    setShowImportModal(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-industrial-800 rounded-xl w-full max-w-2xl card-shadow">
        <div className="p-4 border-b border-industrial-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-industrial-100 font-serif">
            导入温度校准记录
          </h2>
          <button
            onClick={() => setShowImportModal(false)}
            className="p-2 hover:bg-industrial-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-industrial-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setImportMethod('demo')}
              className={clsx(
                'flex-1 px-4 py-2 rounded-lg transition-colors',
                importMethod === 'demo'
                  ? 'bg-supplement-600 text-white'
                  : 'bg-industrial-700 text-industrial-300 hover:bg-industrial-600'
              )}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              加载演示数据
            </button>
            <button
              onClick={() => setImportMethod('file')}
              className={clsx(
                'flex-1 px-4 py-2 rounded-lg transition-colors',
                importMethod === 'file'
                  ? 'bg-supplement-600 text-white'
                  : 'bg-industrial-700 text-industrial-300 hover:bg-industrial-600'
              )}
            >
              <FileJson className="w-4 h-4 inline mr-2" />
              上传 JSON 文件
            </button>
          </div>

          {importMethod === 'demo' ? (
            <button
              onClick={loadDemoData}
              className="w-full p-8 border-2 border-dashed border-industrial-600 rounded-lg hover:border-supplement-500 transition-colors bg-industrial-900/30"
            >
              <Upload className="w-12 h-12 mx-auto mb-3 text-supplement-500" />
              <p className="text-industrial-300">点击加载演示数据</p>
              <p className="text-industrial-500 text-sm mt-1">包含 3 条样例记录</p>
            </button>
          ) : (
            <div
              className={clsx(
                'p-8 border-2 border-dashed rounded-lg transition-colors bg-industrial-900/30',
                dragActive
                  ? 'border-supplement-500 bg-supplement-500/10'
                  : 'border-industrial-600 hover:border-industrial-500'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer block text-center"
              >
                <Upload className="w-12 h-12 mx-auto mb-3 text-industrial-500" />
                <p className="text-industrial-300">
                  拖拽文件到此处或点击上传
                </p>
                <p className="text-industrial-500 text-sm mt-1">支持 JSON 格式</p>
              </label>
            </div>
          )}

          {previewRecords.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-industrial-200 mb-3">
                预览 ({previewRecords.length} 条记录)
              </h3>
              <div className="max-h-60 overflow-y-auto scrollbar-thin space-y-2">
                {previewRecords.map((r, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'p-3 rounded-lg flex items-center justify-between',
                      r.validation.needsReview
                        ? 'bg-warning-500/10 border border-warning-500/30'
                        : 'bg-industrial-700/50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-industrial-400 font-mono text-sm">
                        #{i + 1}
                      </span>
                      <span className="text-industrial-200">
                        {r.startTemp}℃ → {r.endTemp}℃
                      </span>
                      <span
                        className={clsx(
                          'text-sm',
                          r.validation.needsReview
                            ? 'text-warning-400'
                            : 'text-industrial-400'
                        )}
                      >
                        {r.directionMark}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.validation.needsReview && (
                        <div className="flex items-center gap-1 text-warning-500 text-xs">
                          <AlertCircle className="w-4 h-4" />
                          待复核
                        </div>
                      )}
                      {r.sensorId && (
                        <span className="text-xs text-industrial-500">
                          {r.sensorId}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-industrial-700 flex justify-end gap-3">
          <button
            onClick={() => setShowImportModal(false)}
            className="px-4 py-2 bg-industrial-700 hover:bg-industrial-600 text-industrial-300 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={previewRecords.length === 0}
            className={clsx(
              'px-6 py-2 rounded-lg transition-colors',
              previewRecords.length > 0
                ? 'bg-supplement-600 hover:bg-supplement-500 text-white'
                : 'bg-industrial-600 text-industrial-400 cursor-not-allowed'
            )}
          >
            导入 {previewRecords.length} 条记录
          </button>
        </div>
      </div>
    </div>
  )
}
