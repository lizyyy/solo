import { useState, useRef } from "react"
import { useEvidenceStore } from "@/store/useEvidenceStore"
import StatusBadge from "@/components/StatusBadge"
import { parseExDividendJson, exportToCsv } from "@/utils/fileParsers"
import type { ExDividendScreenshot } from "@/utils/fileParsers"
import {
  FileSearch,
  Upload,
  Pencil,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Download,
} from "lucide-react"

export default function SupplementPage() {
  const { records, auditEntries, operationLogs, supplementRecord, manualCorrect, rerun } = useEvidenceStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [correctedDate, setCorrectedDate] = useState("")
  const [note, setNote] = useState("")
  const [step, setStep] = useState<"select" | "upload" | "correct" | "rerun" | "done">("select")
  const [screenshotData, setScreenshotData] = useState<ExDividendScreenshot | null>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)

  const supplementableRecords = records.filter(
    (r) => r.status !== "pending_review" && !r.correctedExDividendDate
  )

  const selectedRecord = records.find((r) => r.id === selectedId)

  function handleSelectRecord(id: string) {
    setSelectedId(id)
    setStep("upload")
    setCorrectedDate("")
    setNote("")
    setScreenshotData(null)
  }

  function handleScreenshotFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const data = parseExDividendJson(text)
      if (!data) {
        alert("JSON 解析失败：文件格式不正确，需包含 securityCode 和 correctedExDividendDate")
        return
      }
      setScreenshotData(data)
      setCorrectedDate(data.correctedExDividendDate)
      setNote(data.note || "")
      setStep("correct")
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  function handleManualCorrect() {
    if (!selectedRecord || !correctedDate) return
    supplementRecord(selectedRecord.id, correctedDate, note)
    manualCorrect(
      selectedRecord.id,
      "除权日",
      selectedRecord.exDividendDate,
      correctedDate
    )
    setStep("rerun")
  }

  function handleRerun() {
    if (!selectedRecord) return
    rerun(selectedRecord.id)
    setStep("done")
  }

  function handleExportAudit() {
    const relevantEntries = auditEntries.filter((a) => a.recordId === selectedId)
    const headers = ["审计ID", "记录ID", "字段", "旧值", "新值", "变更类型", "操作人", "时间"]
    const rows = relevantEntries.map((e) => [
      e.id, e.recordId, e.fieldName, e.oldValue, e.newValue, e.changeType, e.operator, e.timestamp,
    ])
    exportToCsv(headers, rows, `审计明细_${selectedRecord?.securityCode || selectedId}.csv`)
  }

  function handleExportHistory() {
    const relevantLogs = operationLogs.filter((l) => l.recordId === selectedId)
    const headers = ["日志ID", "记录ID", "操作", "操作人", "详情", "时间"]
    const rows = relevantLogs.map((l) => [
      l.id, l.recordId, l.action, l.operator, `"${l.detail}"`, l.timestamp,
    ])
    exportToCsv(headers, rows, `历史记录_${selectedRecord?.securityCode || selectedId}.csv`)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-pine-800">
          除权日截图补录
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          对旧口径记录，从除权日截图 JSON 文件补录正确的除权日信息
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[
          { key: "select", label: "选择记录" },
          { key: "upload", label: "上传截图" },
          { key: "correct", label: "人工修正" },
          { key: "rerun", label: "重跑" },
          { key: "done", label: "完成" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.key
                  ? "bg-pine-800 text-white"
                  : i < ["select", "upload", "correct", "rerun", "done"].indexOf(step)
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs font-medium ${
                step === s.key ? "text-pine-800" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {i < 4 && <ChevronRight className="w-3 h-3 text-gray-300" />}
          </div>
        ))}
      </div>

      {step === "select" && (
        <div className="space-y-3">
          {supplementableRecords.length > 0 ? (
            supplementableRecords.map((record) => (
              <div
                key={record.id}
                onClick={() => handleSelectRecord(record.id)}
                className="bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-lg hover:border-pine-200 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gold-50 flex items-center justify-center text-gold-500 font-bold text-xs">
                      {record.id.replace("REC-", "#")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-pine-800">{record.securityName}</span>
                        <span className="text-xs text-gray-400 font-mono">{record.securityCode}</span>
                        <StatusBadge status={record.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        当前除权日：{record.exDividendDate}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 text-gray-400">
              <FileSearch className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">没有需要补录的记录</p>
              <p className="text-xs mt-1">所有记录的除权日已确认，或请先在托管确认导入页导入记录</p>
            </div>
          )}

          {records.filter((r) => r.correctedExDividendDate).length > 0 && (
            <div className="mt-6 bg-white rounded-xl border border-amber-100 p-5">
              <h3 className="font-semibold text-amber-800 text-sm mb-3">已补录记录</h3>
              <div className="space-y-2">
                {records
                  .filter((r) => r.correctedExDividendDate)
                  .map((record) => (
                    <div key={record.id} className="flex items-center gap-2 text-sm p-2 bg-amber-50/50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-pine-800">{record.securityName}</span>
                      <span className="text-xs text-gray-400">
                        {record.exDividendDate} → {record.correctedExDividendDate}
                      </span>
                      <StatusBadge status={record.status} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "upload" && selectedRecord && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gold-50 flex items-center justify-center text-gold-500 font-bold text-xs">
              {selectedRecord.id.replace("REC-", "#")}
            </div>
            <div>
              <h2 className="font-semibold text-pine-800">{selectedRecord.securityName}</h2>
              <p className="text-xs text-gray-400">
                当前除权日：{selectedRecord.exDividendDate} · {selectedRecord.custodianConfirmRef}
              </p>
            </div>
          </div>

          <input
            ref={screenshotInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleScreenshotFileChange}
          />

          <div
            className="border-2 border-dashed border-gold-300 rounded-xl p-10 text-center hover:border-gold-400 hover:bg-gold-50/30 transition-all duration-300 cursor-pointer"
            onClick={() => screenshotInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-gold-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gold-600 mb-1">上传除权日截图 JSON</h3>
            <p className="text-sm text-gray-400">
              选择 JSON 文件上传，系统将自动识别正确除权日
            </p>
            <p className="text-xs text-gray-300 mt-2">
              JSON 格式：securityCode, correctedExDividendDate, note
            </p>
          </div>

          <div className="mt-4 bg-gray-50 rounded-lg p-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
              <Download className="w-3 h-3 text-gold-500" />
              除权日截图样例下载
            </h4>
            <a
              href="/samples/exdividend_screenshot_supplement.json"
              download
              className="text-xs text-pine-700 hover:text-pine-800 underline"
            >
              exdividend_screenshot_supplement.json（香港交易所 除权日 2026-05-18）
            </a>
          </div>

          <button
            onClick={() => setStep("select")}
            className="mt-5 px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:border-pine-300 hover:text-pine-700 transition-all"
          >
            返回选择
          </button>
        </div>
      )}

      {step === "correct" && selectedRecord && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Pencil className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-pine-800">人工修正</h2>
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              除权日截图已识别
            </span>
            {screenshotData && (
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                来源：{screenshotData.source}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                原口径除权日
              </label>
              <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 line-through">
                {selectedRecord.exDividendDate}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                修正后除权日
              </label>
              <input
                type="date"
                value={correctedDate}
                onChange={(e) => setCorrectedDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-pine-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pine-500 focus:border-pine-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              修正说明
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pine-500 focus:border-pine-500 resize-none"
              rows={3}
              placeholder="说明修正原因（如：从除权日截图确认正确日期为...）"
            />
          </div>

          <button
            onClick={handleManualCorrect}
            disabled={!correctedDate}
            className="px-6 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认修正
          </button>
        </div>
      )}

      {step === "rerun" && selectedRecord && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <RefreshCw className="w-5 h-5 text-pine-600" />
            <h2 className="font-semibold text-pine-800">重跑确认</h2>
          </div>

          <div className="bg-pine-50 rounded-lg p-5 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">证券</p>
                <p className="font-semibold text-pine-800">{selectedRecord.securityName} ({selectedRecord.securityCode})</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">除权日变更</p>
                <p>
                  <span className="line-through text-red-400">{selectedRecord.exDividendDate}</span>
                  {" → "}
                  <span className="font-semibold text-emerald-600">{correctedDate}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            系统将按修正后的除权日重新计算，审计明细将同步更新。确认执行重跑？
          </p>

          <button
            onClick={handleRerun}
            className="px-6 py-2.5 bg-pine-800 text-white rounded-lg text-sm font-medium hover:bg-pine-700 hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            执行重跑
          </button>
        </div>
      )}

      {step === "done" && selectedRecord && (
        <div className="space-y-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">补录完成</p>
              <p className="text-sm text-emerald-600 mt-0.5">
                除权日已从 {selectedRecord.exDividendDate} 修正为 {correctedDate}，审计明细已更新
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-pine-800 mb-4">处理结果</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">记录编号</p>
                <p className="font-semibold text-pine-800">{selectedRecord.id}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">修正除权日</p>
                <p className="font-semibold text-emerald-600">{correctedDate}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">状态</p>
                <StatusBadge status="supplemented" size="md" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-pine-800 mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-gold-500" />
              导出核对
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              导出本条记录的审计明细和历史记录 CSV，用于核对处理链路是否完整
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleExportAudit}
                className="px-5 py-2.5 bg-pine-800 text-white rounded-lg text-sm font-medium hover:bg-pine-700 transition-all duration-200 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                导出审计明细
              </button>
              <button
                onClick={handleExportHistory}
                className="px-5 py-2.5 border border-pine-300 text-pine-700 rounded-lg text-sm font-medium hover:bg-pine-50 transition-all duration-200 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                导出历史记录
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              setStep("select")
              setSelectedId(null)
              setCorrectedDate("")
              setNote("")
              setScreenshotData(null)
            }}
            className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:border-pine-300 hover:text-pine-700 transition-all"
          >
            继续补录
          </button>
        </div>
      )}
    </div>
  )
}
