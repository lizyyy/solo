import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@/store/useStore"
import { parseExcelFile, parseCSVText, guessColumnMapping, applyMapping, validateData, resolveConflicts } from "@/lib/validator"
import { SAMPLE_SMOOTH_CSV, SAMPLE_REWORK_CSV, SAMPLE_ALIAS_CSV } from "@/lib/sampleData"
import type { RawImportRow, ValidationResult, ConflictChoice, ColumnMapping, FieldKey } from "@/lib/types"
import { FIELD_DEFINITIONS } from "@/lib/types"
import { Upload, FileText, AlertTriangle, AlertCircle, Info, ArrowRight, CheckCircle2, ChevronRight, FileSpreadsheet } from "lucide-react"
import { cn } from "@/lib/utils"

const TYPE_BG: Record<string, string> = {
  empty: "bg-yellow-900/30",
  duplicate: "bg-orange-900/30",
  unit_mismatch: "bg-red-900/30",
  conflict: "bg-purple-900/30",
  boundary: "bg-red-900/30",
}

type Step = "upload" | "mapping" | "preview"

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
  const [step, setStep] = useState<Step>("upload")
  const [rawText, setRawText] = useState("")
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [mappedRows, setMappedRows] = useState<RawImportRow[]>([])
  const [results, setResults] = useState<ValidationResult[]>([])
  const [choices, setChoices] = useState<ConflictChoice[]>([])

  const storeSetIntersectionsAndMerge = useStore((s) => s.setIntersectionsAndMerge)
  const storeSetValidationResults = useStore((s) => s.setValidationResults)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const isExcel = /\.xlsx?$/i.test(file.name)
    if (isExcel) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer
        const { headers, rows } = parseExcelFile(buffer, file.name)
        setHeaders(headers)
        setRawRows(rows)
        setMapping(guessColumnMapping(headers))
        setStep("mapping")
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        setRawText(text)
        const { headers, rows } = parseCSVText(text, file.name)
        setHeaders(headers)
        setRawRows(rows)
        setMapping(guessColumnMapping(headers))
        setStep("mapping")
      }
      reader.readAsText(file)
    }
  }

  const handlePasteParse = () => {
    const { headers, rows } = parseCSVText(rawText, "粘贴数据")
    setHeaders(headers)
    setRawRows(rows)
    setFileName("粘贴数据")
    setMapping(guessColumnMapping(headers))
    setStep("mapping")
  }

  const loadSample = (csv: string, name: string) => {
    setRawText(csv)
    setFileName(name)
    const { headers, rows } = parseCSVText(csv, name)
    setHeaders(headers)
    setRawRows(rows)
    setMapping(guessColumnMapping(headers))
    setStep("mapping")
  }

  const updateMapping = (idx: number, fieldKey: FieldKey | "") => {
    setMapping((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], fieldKey }
      return next
    })
  }

  const handleConfirmMapping = () => {
    const rows = applyMapping(rawRows, mapping, fileName)
    setMappedRows(rows)
    const { validData, validationResults } = validateData(rows)
    setResults(validationResults)
    setChoices([])
    storeSetValidationResults(validationResults)
    setStep("preview")
  }

  const mappedFieldCount = mapping.filter((m) => m.fieldKey !== "").length
  const requiredFields: FieldKey[] = ["id", "name", "distanceFromStart", "cycle", "greenRatio", "offset", "direction"]
  const missingFields = requiredFields.filter((f) => !mapping.some((m) => m.fieldKey === f))

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
    const resolved = resolveConflicts(mappedRows, choices)
    const { validData } = validateData(resolved)
    storeSetIntersectionsAndMerge(validData)
    navigate("/calculate")
  }

  const FIELDS: (keyof RawImportRow)[] = ["id", "name", "distanceFromStart", "cycle", "greenRatio", "offset", "direction", "sourceRow", "sourceFile"]

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-gray-200 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0D7377]">绿波速度带计算</h1>
          <p className="text-gray-400 mt-1">参数导入</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(["upload", "mapping", "preview"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold", step === s ? "bg-[#0D7377] text-white" : i < ["upload", "mapping", "preview"].indexOf(step) ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400")}>
                {i + 1}
              </span>
              <span className={cn("text-sm", step === s ? "text-white" : "text-gray-500")}>
                {s === "upload" ? "上传数据" : s === "mapping" ? "列名映射" : "预览校验"}
              </span>
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-600" />}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <textarea
                className="flex-1 h-48 bg-[#16213E] border border-[#0D7377]/30 rounded-lg p-3 text-gray-200 font-mono text-sm resize-y focus:outline-none focus:border-[#0D7377] placeholder:text-gray-500"
                placeholder="粘贴 CSV / TSV 数据..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <div className="flex flex-col gap-2 w-52">
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" className="hidden" onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-3 bg-[#16213E] border border-[#0D7377]/30 rounded-lg hover:bg-[#0D7377]/20 transition text-sm">
                  <Upload className="w-4 h-4" />上传 CSV / Excel
                </button>
                <button onClick={() => loadSample(SAMPLE_SMOOTH_CSV, "顺利样例.csv")} className="flex items-center justify-center gap-2 px-3 py-2 bg-[#16213E] border border-[#D4A017]/30 rounded-lg hover:bg-[#D4A017]/10 transition text-[#D4A017] text-sm">
                  <FileText className="w-4 h-4" />加载顺利样例
                </button>
                <button onClick={() => loadSample(SAMPLE_REWORK_CSV, "返工样例.csv")} className="flex items-center justify-center gap-2 px-3 py-2 bg-[#16213E] border border-[#D4A017]/30 rounded-lg hover:bg-[#D4A017]/10 transition text-[#D4A017] text-sm">
                  <FileText className="w-4 h-4" />加载返工样例
                </button>
                <button onClick={() => loadSample(SAMPLE_ALIAS_CSV, "别名样例.csv")} className="flex items-center justify-center gap-2 px-3 py-2 bg-[#16213E] border border-[#D4A017]/30 rounded-lg hover:bg-[#D4A017]/10 transition text-[#D4A017] text-sm">
                  <FileSpreadsheet className="w-4 h-4" />加载别名样例
                </button>
              </div>
            </div>

            {rawText.trim() && (
              <button onClick={handlePasteParse} className="px-6 py-2 bg-[#0D7377] text-white rounded-lg hover:bg-[#0D7377]/80 transition font-medium">
                解析粘贴数据
              </button>
            )}

            <div className="text-sm text-gray-500 bg-[#16213E] rounded-lg p-4 border border-gray-700/30">
              <p className="font-medium text-gray-400 mb-1">支持的数据来源</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>上传 .xlsx / .xls Excel 文件</li>
                <li>上传 .csv / .tsv / .txt 文本文件</li>
                <li>直接粘贴 CSV / TSV 数据</li>
              </ul>
              <p className="font-medium text-gray-400 mt-3 mb-1">列名识别规则</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>自动识别常见中英文列名，如"交叉口编号"→路口编号、"green"→绿信比</li>
                <li>无法自动匹配的列可在映射步骤手动指定</li>
              </ul>
            </div>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="bg-[#16213E] rounded-lg p-4 border border-[#0D7377]/30">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-5 h-5 text-[#0D7377]" />
                <span className="font-medium">{fileName}</span>
                <span className="text-sm text-gray-400">({rawRows.length} 行, {headers.length} 列)</span>
              </div>
            </div>

            <div className="bg-[#16213E] rounded-lg border border-gray-700/40 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0D7377]/20 border-b border-[#0D7377]/30">
                    <th className="px-3 py-2 text-left text-[#0D7377]">文件列名</th>
                    <th className="px-3 py-2 text-left text-[#0D7377]">首行数据</th>
                    <th className="px-3 py-2 text-left text-[#0D7377]">映射到字段</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((m, idx) => (
                    <tr key={idx} className={cn("border-b border-gray-800/50", idx % 2 === 0 ? "bg-[#16213E]/50" : "bg-[#16213E]/20")}>
                      <td className="px-3 py-2 font-mono text-xs">{m.fileColumn}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-400">{rawRows[0]?.[m.fileColumn] ?? "-"}</td>
                      <td className="px-3 py-2">
                        <select
                          value={m.fieldKey}
                          onChange={(e) => updateMapping(idx, e.target.value as FieldKey | "")}
                          className={cn("bg-[#1A1A2E] border rounded px-2 py-1 text-sm focus:outline-none focus:border-[#0D7377]", m.fieldKey ? "border-[#0D7377] text-[#0D7377]" : "border-gray-600 text-gray-400")}
                        >
                          <option value="">-- 不映射 --</option>
                          {FIELD_DEFINITIONS.map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm">
                已映射 <span className="font-mono text-[#0D7377] font-bold">{mappedFieldCount}</span> / {requiredFields.length} 个必填字段
              </div>
              {missingFields.length > 0 && (
                <div className="text-sm text-orange-400">
                  缺少：{missingFields.map((f) => FIELD_DEFINITIONS.find((d) => d.key === f)?.label).join("、")}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("upload")} className="px-4 py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition">
                返回上传
              </button>
              <button onClick={handleConfirmMapping} disabled={missingFields.length > 0} className="px-6 py-2 bg-[#0D7377] text-white rounded-lg hover:bg-[#0D7377]/80 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium">
                确认映射并校验
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="bg-[#16213E] rounded-lg p-3 border border-[#0D7377]/30 mb-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">来源：<span className="text-white">{fileName}</span></span>
                <span className="text-gray-400">原始行数：<span className="font-mono text-white">{rawRows.length}</span></span>
                <span className="text-gray-400">映射后：<span className="font-mono text-white">{mappedRows.length}</span></span>
                <span className="text-green-400">有效：<span className="font-mono font-bold">{mappedRows.length - results.filter(r => r.type === "empty" || r.type === "duplicate").length}</span></span>
              </div>
            </div>

            {mappedRows.length > 0 && (
              <div className="mb-6 overflow-x-auto rounded-lg border border-gray-700/40 max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-[#0D7377]/20 border-b border-[#0D7377]/30">
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">来源行</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">路口编号</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">路口名称</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">距起点距离</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">周期</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">绿信比</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">偏移量</th>
                      <th className="px-3 py-2 text-left text-[#0D7377] font-medium whitespace-nowrap">方向</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.map((row, i) => (
                      <tr key={i} className={cn("border-b border-gray-800/50", i % 2 === 0 ? "bg-[#16213E]/50" : "bg-[#16213E]/20", rowBg(i))}>
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{row.sourceRow}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.distanceFromStart}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.cycle}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.greenRatio}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.offset}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.direction}</td>
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
                <div className="max-h-72 overflow-y-auto space-y-3">
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
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("mapping")} className="px-4 py-2 border border-gray-600 rounded-lg text-gray-400 hover:text-white transition">
                返回映射
              </button>
              <button onClick={handleConfirm} disabled={!allConflictsResolved} className="flex items-center gap-2 px-6 py-2 bg-[#D4A017] text-[#1A1A2E] rounded-lg font-semibold hover:bg-[#D4A017]/80 disabled:opacity-40 disabled:cursor-not-allowed transition">
                确认并进入计算<ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
