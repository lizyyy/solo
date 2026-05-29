import { useCallback, useState } from "react"
import { useExperimentStore } from "@/store/useExperimentStore"
import { importCSV, importJSON } from "@/utils/importExport"
import { Upload, FileText, FileJson } from "lucide-react"
import type { ExperimentRecord } from "@/types"

type ImportFormat = "csv" | "json"

export default function DataImport() {
  const importRecords = useExperimentStore((s) => s.importRecords)
  const [format, setFormat] = useState<ImportFormat>("csv")
  const [dragOver, setDragOver] = useState(false)

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        let records: ExperimentRecord[] = []

        if (format === "csv") {
          records = importCSV(text)
        } else {
          records = importJSON(text)
        }

        if (records.length > 0) {
          importRecords(records)
        }
      }
      reader.readAsText(file)
    },
    [format, importRecords]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      e.target.value = ""
    },
    [processFile]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-[#00E5CC]" />
        <h3 className="text-[#00E5CC] font-semibold text-sm tracking-wider uppercase">批量导入</h3>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFormat("csv")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all
            ${format === "csv" ? "bg-[#00E5CC]/20 text-[#00E5CC] border border-[#00E5CC]/40" : "bg-[#0A1628] text-[#8899AA] border border-[#1A3A5C] hover:border-[#00E5CC]/30"}`}
        >
          <FileText size={12} />
          CSV
        </button>
        <button
          onClick={() => setFormat("json")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all
            ${format === "json" ? "bg-[#00E5CC]/20 text-[#00E5CC] border border-[#00E5CC]/40" : "bg-[#0A1628] text-[#8899AA] border border-[#1A3A5C] hover:border-[#00E5CC]/30"}`}
        >
          <FileJson size={12} />
          JSON
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${dragOver ? "border-[#00E5CC] bg-[#00E5CC]/5" : "border-[#1A3A5C] hover:border-[#00E5CC]/50"}`}
      >
        <input
          type="file"
          accept={format === "csv" ? ".csv" : ".json"}
          onChange={handleChange}
          className="hidden"
          id="file-import"
        />
        <label htmlFor="file-import" className="cursor-pointer">
          <Upload size={24} className="mx-auto mb-2 text-[#556677]" />
          <p className="text-xs text-[#8899AA]">
            拖拽文件到此处，或<span className="text-[#00E5CC]">点击上传</span>
          </p>
          <p className="text-[10px] text-[#445566] mt-1">
            导入后保留原始字段口径与手工备注
          </p>
        </label>
      </div>
    </div>
  )
}
