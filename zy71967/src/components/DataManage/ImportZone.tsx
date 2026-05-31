import { useState, useRef, useCallback } from "react"
import { FileSpreadsheet, MessageSquare, Settings, Upload, CheckCircle2, AlertTriangle } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { SOURCE_LABELS, type DataSourceType } from "@/types"
import { cn } from "@/lib/utils"
import DuplicateReport from "./DuplicateReport"

const ZONES: { type: DataSourceType; icon: typeof FileSpreadsheet; desc: string }[] = [
  { type: "evaluation", icon: FileSpreadsheet, desc: "上传评估指标表，支持 .xlsx / .csv" },
  { type: "online_feedback", icon: MessageSquare, desc: "上传线上反馈数据，支持 .xlsx / .csv" },
  { type: "config", icon: Settings, desc: "上传实验配置文件，支持 .json / .yaml" },
]

export default function ImportZone() {
  const { selectedExperimentId, importMockData, dataSources } = useAppStore()
  const [dragOver, setDragOver] = useState<DataSourceType | null>(null)
  const [results, setResults] = useState<{ type: DataSourceType; fileName: string }[]>([])
  const [duplicates, setDuplicates] = useState<{
    open: boolean
    items: { fileName: string; importedAt: string; importedBy: string }[]
  }>({ open: false, items: [] })
  const fileInputRefs = useRef<Record<DataSourceType, HTMLInputElement | null>>({
    evaluation: null,
    online_feedback: null,
    config: null,
  })

  const handleImport = useCallback(
    (type: DataSourceType, file: File) => {
      if (!selectedExperimentId) return

      const existing = dataSources.filter(
        (ds) => ds.experimentId === selectedExperimentId && ds.type === type && !ds.rolledBack
      )
      if (existing.length > 0) {
        setDuplicates({
          open: true,
          items: existing.map((ds) => ({
            fileName: ds.fileName,
            importedAt: ds.importedAt,
            importedBy: ds.importedBy,
          })),
        })
      }

      importMockData(type, selectedExperimentId, file.name)
      setResults((prev) => [...prev, { type, fileName: file.name }])
    },
    [selectedExperimentId, importMockData, dataSources]
  )

  const handleDrop = useCallback(
    (type: DataSourceType, e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(null)
      const file = e.dataTransfer.files[0]
      if (file) handleImport(type, file)
    },
    [handleImport]
  )

  const handleFileChange = useCallback(
    (type: DataSourceType, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleImport(type, file)
      e.target.value = ""
    },
    [handleImport]
  )

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {ZONES.map(({ type, icon: Icon, desc }) => (
          <div
            key={type}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(type)
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(type, e)}
            onClick={() => fileInputRefs.current[type]?.click()}
            className={cn(
              "rounded-md border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
              dragOver === type
                ? "border-amber-500 bg-amber-500/10"
                : "border-slate-700 bg-slate-900 hover:border-slate-500"
            )}
          >
            <input
              ref={(el) => {
                fileInputRefs.current[type] = el
              }}
              type="file"
              className="hidden"
              onChange={(e) => handleFileChange(type, e)}
            />
            <Icon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-200">{SOURCE_LABELS[type]}</p>
            <p className="mt-1 text-xs text-slate-500">{desc}</p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
              <Upload className="h-3.5 w-3.5" />
              点击或拖拽上传
            </div>
          </div>
        ))}
      </div>

      {!selectedExperimentId && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          请先选择实验后再上传数据
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-4 rounded-md bg-slate-900 p-4">
          <p className="mb-2 text-xs font-medium text-slate-400">导入结果</p>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-500">{SOURCE_LABELS[r.type]}</span>
                <span>{r.fileName}</span>
                <span className="text-xs text-emerald-400">导入成功</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DuplicateReport
        open={duplicates.open}
        duplicates={duplicates.items}
        onClose={() => setDuplicates((prev) => ({ ...prev, open: false }))}
        onAction={() => setDuplicates((prev) => ({ ...prev, open: false }))}
      />
    </div>
  )
}
