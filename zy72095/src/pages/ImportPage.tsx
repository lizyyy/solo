import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { parseRawText, validateData, resolveConflicts, convertUnit } from "@/lib/validator"
import { SAMPLE_SMOOTH_RAW, SAMPLE_REWORK_RAW } from "@/lib/sampleData"
import type { IntersectionData, ValidationResult, ConflictChoice, RawImportRow } from "@/lib/types"
import { Upload, FileText, AlertTriangle, AlertCircle, Info, ArrowRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

const TYPE_BG: Record<string, string> = {
  empty: "bg-yellow-900/30",
  duplicate: "bg-orange-900/30",
  unit_mismatch: "bg-red-900/30",
  conflict: "bg-purple-900/30",
  boundary: "bg-red-900/30",
}

const COLUMNS = ["路口编号", "路口名称", "距起点距离", "周期", "绿信比", "偏移量", "方向"] as const
const FIELDS: (keyof RawImportRow)[] = ["id", "name", "distanceFromStart", "cycle", "greenRatio", "offset", "direction"]

function TypeIcon({ type }: { type: ValidationResult["type"] }) {
  switch (type) {
    case "empty": return <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
    case "duplicate": return <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
    case "unit_mismatch": return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
    case "conflict": return <AlertCircle className="w-4 h-4 text-purple-400 shrink-0" />
    case "boundary": return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
  }
}

export default function ImportPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rawText, setRawText] = useState("")
  const [rows, setRows] = useState<RawImportRow[]>([])
  const [results, setResults] = useState<ValidationResult[]>([])
  const [choices, setChoices] = useState<ConflictChoice[]>([])
  const [parsed, setParsed] = useState(false)

  const storeSetRawText = useStore((s) => s.setRawText)
  const storeSetIntersections = useStore((s) => s.setIntersections)
  const storeSetValidationResults = useStore((s) => s.setValidationResults)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setRawText(ev.target?.result as string)
    reader.readAsText(file)
  }

  const handleParse = () => {
    const parsedRows = parseRawText(rawText)
    const { validData, validationResults } = validateData(parsedRows)
    setRows(parsedRows)
    setResults(validationResults)
    setChoices([])
    setParsed(true)
    storeSetRawText(rawText)
    storeSetValidationResults(validationResults)
  }

  const rowBg = (i: number) => {
    const rowResults = results.filter((r) => r.rowIndex === i)
    if (rowResults.length === 0) return ""
    for (const t of ["empty", "boundary", "duplicate", "unit_mismatch", "conflict"] as const) {
      if (rowResults.some((r) => r.type === t)) return TYPE_BG[t]
    }
    return ""
  }

  const toggleChoice = (vrId: string, resolution: "paramTable" | "imported") => {
    setChoices((prev) => {
      const idx = prev.findIndex((c) => c.validationResultId === vrId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { validationResultId: vrId, resolution }
        return next
      }
      return [...prev, { validationResultId: vrId, resolution }]
    })
  }

  const allConflictsResolved = results
    .filter((r) => r.type === "conflict")
    .every((r) => choices.some((c) => c.validationResultId === r.id))

  const handleConfirm = () => {
    const resolved = resolveConflicts(rows, choices)
    const { validData } = validateData(resolved)
    storeSetIntersections(validData)
    navigate("/calculate")
  }

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0D7377]">绿波速度带计算</h1>
          <p className="text-gray-400 mt-1">参数导入</p>
        </div>

        <div className="flex gap-4 mb-4">
          <textarea
            className="flex-1 h-48 bg-[#16213E] border border-[#0D7377]/30 rounded-lg p-3 text-gray-200 font-mono text-sm resize-y focus:outline-none focus:border-[#0D7377] placeholder:text-gray-500"
            placeholder="粘贴 CSV / TSV 数据..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <div className="flex flex-col gap-2 w-44">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 bg-[#16213E] border border-[#0D7377]/30 rounded-lg hover:bg-[#0D7377]/20 transition text-sm">
              <Upload className="w-4 h-4" />上传文件
            </button>
            <button onClick={() => setRawText(SAMPLE_SMOOTH_RAW)} className="flex items-center justify-center gap-2 px-3 py-2 bg-[#16213E] border border-[#D4A017]/30 rounded-lg hover:bg-[#D4A017]/10 transition text-[#D4A017] text-sm">
              <FileText className="w-4 h-4" />加载顺利样例
            </button>
            <button onClick={() => setRawText(SAMPLE_REWORK_RAW)} className="flex items-center justify-center gap-2 px-3 py-2 bg-[#16213E] border border-[#D4A017]/30 rounded-lg hover:bg-[#D4A017]/10 transition text-[#D4A017] text-sm">
              <FileText className="w-4 h-4" />加载返工样例
            </button>
          </div>
        </div>

        <button onClick={handleParse} disabled={!rawText.trim()} className="mb-6 px-6 py-2 bg-[#0D7377] text-white rounded-lg hover:bg-[#0D7377]/80 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium">
          解析并校验
        </button>

        {parsed && (
          <>
            {rows.length > 0 && (
              <div className="mb-6 overflow-x-auto rounded-lg border border-gray-700/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0D7377]/20 border-b border-[#0D7377]/30">
                      {COLUMNS.map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className={cn("border-b border-gray-800/50", i % 2 === 0 ? "bg-[#16213E]/50" : "bg-[#16213E]/20", rowBg(i))}>
                        {FIELDS.map((f) => (
                          <td key={f} className="px-3 py-2 font-mono text-xs whitespace-nowrap">{row[f]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {results.length === 0 && (
              <div className="flex items-center gap-2 text-green-400 mb-6">
                <CheckCircle2 className="w-5 h-5" />
                <span>数据校验通过，无异常</span>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-3 mb-6">
                <h2 className="text-lg font-semibold text-[#D4A017]">校验结果（{results.length}）</h2>
                {results.map((r) => (
                  <div key={r.id} className="bg-[#16213E] border border-gray-700/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <TypeIcon type={r.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{r.message}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Info className="w-3 h-3 shrink-0" />{r.suggestion}
                        </p>
                        {r.type === "conflict" && (
                          <div className="mt-3 flex gap-4">
                            <div className={cn("flex-1 rounded-lg p-3 border", choices.find((c) => c.validationResultId === r.id)?.resolution === "paramTable" ? "border-[#0D7377] bg-[#0D7377]/10" : "border-gray-700/50 bg-[#1A1A2E]/50")}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name={r.id} checked={choices.find((c) => c.validationResultId === r.id)?.resolution === "paramTable"} onChange={() => toggleChoice(r.id, "paramTable")} className="accent-[#0D7377]" />
                                <span className="text-xs text-gray-400">参数表值</span>
                              </label>
                              <p className="mt-1 ml-6 font-mono text-sm text-[#0D7377]">{r.paramTableValue}</p>
                            </div>
                            <div className={cn("flex-1 rounded-lg p-3 border", choices.find((c) => c.validationResultId === r.id)?.resolution === "imported" ? "border-[#D4A017] bg-[#D4A017]/10" : "border-gray-700/50 bg-[#1A1A2E]/50")}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name={r.id} checked={choices.find((c) => c.validationResultId === r.id)?.resolution === "imported"} onChange={() => toggleChoice(r.id, "imported")} className="accent-[#D4A017]" />
                                <span className="text-xs text-gray-400">导入值</span>
                              </label>
                              <p className="mt-1 ml-6 font-mono text-sm text-[#D4A017]">{r.importedValue}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleConfirm} disabled={!allConflictsResolved} className="flex items-center gap-2 px-6 py-2 bg-[#D4A017] text-[#1A1A2E] rounded-lg font-semibold hover:bg-[#D4A017]/80 disabled:opacity-40 disabled:cursor-not-allowed transition">
              确认并进入计算<ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
