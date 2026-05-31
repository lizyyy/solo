import { useState, useEffect, useRef } from "react"
import { Upload, FileUp, AlertCircle, CheckCircle2, AlertTriangle, X, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useReceiptStore } from "@/store/useReceiptStore"
import type { DailyReportRow, ImportPreview } from "@/types"

const SAMPLE_DATA = `渠道名称	交易流水号	金额	备注	报告日期
华东代理A	TXN20260528001	125000.00	5月28日华东区正常返佣	2026-05-28
华南渠道B	TXN20260528002	87500.50	金额与台账不一致	2026-05-28
华北代理C	TXN20260531001	45000.00		2026-05-31`

function parseInput(text: string): DailyReportRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []

  const rows: DailyReportRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.includes("\t") ? line.split("\t") : line.split(",")
    const [channelName, transactionNo, amountStr, remark, reportDate] = parts.map((p) => p.trim())

    const amount = parseFloat(amountStr)

    rows.push({
      channelName,
      transactionNo,
      amount: isNaN(amount) ? 0 : amount,
      remark: remark || "",
      reportDate: reportDate || new Date().toISOString().slice(0, 10),
    })
  }

  return rows
}

export default function ImportPage() {
  const init = useReceiptStore((s) => s.init)
  const importFromDailyReport = useReceiptStore((s) => s.importFromDailyReport)
  const confirmImport = useReceiptStore((s) => s.confirmImport)

  const [text, setText] = useState("")
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [activeTab, setActiveTab] = useState<"new" | "duplicate" | "error">("new")
  const [imported, setImported] = useState(false)
  const [importedCount, setImportedCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    init()
  }, [init])

  const handleParse = () => {
    const rows = parseInput(text)
    const result = importFromDailyReport(rows)
    setPreview(result)
    setImported(false)
    if (result.newRows.length > 0) setActiveTab("new")
    else if (result.duplicateRows.length > 0) setActiveTab("duplicate")
    else setActiveTab("error")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setText(content)
    }
    reader.readAsText(file)
  }

  const handleLoadSample = () => {
    setText(SAMPLE_DATA)
    setPreview(null)
    setImported(false)
  }

  const handleConfirmImport = () => {
    if (!preview) return
    confirmImport(preview)
    setImportedCount(preview.newRows.length)
    setImported(true)
    setText("")
    setPreview(null)
  }

  const tabs = [
    { key: "new" as const, label: "新增记录", count: preview?.newRows.length ?? 0, data: preview?.newRows ?? [], color: "text-emerald-600" },
    { key: "duplicate" as const, label: "重复记录", count: preview?.duplicateRows.length ?? 0, data: preview?.duplicateRows ?? [], color: "text-slate-500" },
    { key: "error" as const, label: "解析失败", count: preview?.errorRows.length ?? 0, data: preview?.errorRows ?? [], color: "text-red-600" },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-zinc-900">导入复核日报</h1>
        <button
          onClick={handleLoadSample}
          className="text-sm text-amber-600 hover:text-amber-700 font-medium"
        >
          加载示例数据
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700">复核日报输入</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="粘贴制表符分隔的文本，或上传 CSV 文件&#10;&#10;格式：&#10;渠道名称	交易流水号	金额	备注	报告日期"
            className={cn(
              "flex-1 w-full resize-none rounded-md border border-zinc-300",
              "px-3 py-2 text-sm font-mono text-zinc-800",
              "placeholder:text-zinc-400",
              "focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            )}
          />
          <div className="mt-2 p-2 bg-zinc-50 rounded-md border border-zinc-200">
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-600">格式说明：</span>渠道名称、交易流水号、金额、备注（可选）、报告日期
            </p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleParse}
              disabled={!text.trim()}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                text.trim()
                  ? "bg-zinc-800 text-white hover:bg-zinc-700"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              )}
            >
              <FileUp className="w-4 h-4 inline mr-1.5" />
              解析预览
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-md text-sm font-medium text-zinc-700 border border-zinc-300 hover:bg-zinc-50"
            >
              上传 CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700">导入预览</span>
            {preview && (
              <span className="text-xs text-zinc-500 ml-2">
                共 {preview.newRows.length + preview.duplicateRows.length + preview.errorRows.length} 条
              </span>
            )}
          </div>

          {imported ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-emerald-50 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="text-emerald-700 font-medium">导入成功</p>
              <p className="text-sm text-emerald-600 mt-1">已新增 {importedCount} 条回执记录</p>
            </div>
          ) : preview ? (
            <div className="flex-1 flex flex-col min-h-0 rounded-md border border-zinc-200">
              <div className="flex border-b border-zinc-200 bg-zinc-50">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeTab === tab.key
                        ? "border-amber-500 text-amber-600 bg-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-700"
                    )}
                  >
                    {tab.label}
                    <span className={cn("ml-1.5 text-xs", tab.color)}>({tab.count})</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 sticky top-0">
                    <tr className="text-left text-zinc-500">
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">渠道名称</th>
                      <th className="px-3 py-2 font-medium">交易流水号</th>
                      <th className="px-3 py-2 font-medium text-right">金额</th>
                      <th className="px-3 py-2 font-medium">报告日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabs.find((t) => t.key === activeTab)?.data.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-zinc-400">
                          无记录
                        </td>
                      </tr>
                    ) : (
                      tabs
                        .find((t) => t.key === activeTab)
                        ?.data.map((row, i) => (
                          <tr
                            key={i}
                            className={cn(
                              "border-t border-zinc-100",
                              activeTab === "duplicate" && "bg-zinc-50 text-zinc-400",
                              activeTab === "error" && "bg-red-50 text-red-600"
                            )}
                          >
                            <td className="px-3 py-2">
                              {activeTab === "new" && (
                                <span className="inline-flex items-center text-emerald-600">
                                  <Check className="w-3 h-3 mr-1" />
                                  新增
                                </span>
                              )}
                              {activeTab === "duplicate" && (
                                <span className="inline-flex items-center text-zinc-400">
                                  <X className="w-3 h-3 mr-1" />
                                  历史已录入
                                </span>
                              )}
                              {activeTab === "error" && (
                                <span className="inline-flex items-center text-red-600">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  字段缺失
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">{row.channelName || "—"}</td>
                            <td className="px-3 py-2 font-mono">{row.transactionNo || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.amount > 0 ? row.amount.toFixed(2) : "—"}
                            </td>
                            <td className="px-3 py-2">{row.reportDate}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 rounded-md border border-zinc-200 border-dashed">
              <AlertCircle className="w-10 h-10 text-zinc-300 mb-2" />
              <p className="text-zinc-400 text-sm">解析后显示预览</p>
            </div>
          )}

          <div className="mt-3">
            {preview && (
              <div className="text-xs text-zinc-500 mb-2 px-1">
                {preview.newRows.length > 0 && (
                  <span className="text-emerald-600 mr-3">新增 {preview.newRows.length} 条</span>
                )}
                {preview.duplicateRows.length > 0 && (
                  <span className="text-zinc-500 mr-3">重复 {preview.duplicateRows.length} 条（不覆盖）</span>
                )}
                {preview.errorRows.length > 0 && (
                  <span className="text-red-600">失败 {preview.errorRows.length} 条</span>
                )}
              </div>
            )}
            <button
              onClick={handleConfirmImport}
              disabled={!preview || preview.newRows.length === 0}
              className={cn(
                "w-full px-4 py-2.5 rounded-md text-sm font-medium transition-colors",
                preview && preview.newRows.length > 0
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              )}
            >
              {preview && preview.newRows.length === 0
                ? "无新记录可导入"
                : `确认导入（新增 ${preview?.newRows.length ?? 0} 条）`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
