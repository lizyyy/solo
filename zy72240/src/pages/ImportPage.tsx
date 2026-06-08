import { useState, useRef } from "react"
import { useEvidenceStore } from "@/store/useEvidenceStore"
import StatusBadge from "@/components/StatusBadge"
import { parseCsv } from "@/utils/fileParsers"
import type { CustodianConfirmRow } from "@/utils/fileParsers"
import {
  Upload,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Download,
} from "lucide-react"

const sampleFiles = [
  {
    label: "正常材料（单币种）",
    desc: "汇丰控股 HKD 150,000",
    url: "/samples/custodian_confirm_normal.csv",
  },
  {
    label: "错口径材料（港币+人民币同列）",
    desc: "汇贤产业信托 HKD 200,000 + CNY 180,000",
    url: "/samples/custodian_confirm_mixed.csv",
  },
  {
    label: "补录材料（旧口径除权日）",
    desc: "香港交易所 HKD 120,000 除权日 2026-05-15",
    url: "/samples/custodian_confirm_old_caliber.csv",
  },
]

export default function ImportPage() {
  const { records, importRecords, reviewRecord } = useEvidenceStore()
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")
  const [parsedRows, setParsedRows] = useState<CustodianConfirmRow[]>([])
  const [importedIds, setImportedIds] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pendingRecords = records.filter((r) => r.status === "pending_review")

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCsv(text)
      if (rows.length === 0) {
        alert("CSV 解析失败：文件为空或格式不正确")
        return
      }
      setParsedRows(rows)
      setStep("preview")
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  function handleConfirmImport() {
    const store = useEvidenceStore.getState()
    importRecords(parsedRows)
    const latestRecords = useEvidenceStore.getState().records
    const newestIds = latestRecords
      .filter((r) => !store.records.find((old) => old.id === r.id))
      .map((r) => r.id)
    setImportedIds(newestIds)
    setStep("done")
  }

  function handleReview(id: string) {
    reviewRecord(id)
  }

  function getCurrencyTypeForRow(row: CustodianConfirmRow) {
    return row.amountHKD && row.amountCNY ? "MIXED" : row.amountCNY ? "CNY" : "HKD"
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-pine-800">
          托管确认导入
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          从托管确认页 CSV 文件导入支付拒付记录，系统自动识别币种异常
        </p>
      </div>

      {step === "upload" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              className="border-2 border-dashed border-pine-300 rounded-xl p-12 text-center hover:border-pine-500 hover:bg-pine-50/30 transition-all duration-300 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-pine-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-pine-700 mb-2">
                上传托管确认页 CSV
              </h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                选择 CSV 文件上传，系统将自动解析并识别币种异常
              </p>
              <p className="text-xs text-gray-300 mt-4">
                CSV 格式：securityCode, securityName, amountHKD, amountCNY, exDividendDate, custodianConfirmRef
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-pine-800 mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-gold-500" />
              样例材料下载
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              下载对应场景的 CSV 样例，然后重新上传。检查方可用三种样例分别跑一遍，核对结果。
            </p>
            <div className="grid grid-cols-3 gap-4">
              {sampleFiles.map((sf) => (
                <a
                  key={sf.url}
                  href={sf.url}
                  download
                  className="block border border-gray-200 rounded-lg p-4 hover:border-pine-300 hover:shadow-md transition-all duration-200"
                >
                  <p className="font-medium text-sm text-pine-800 mb-1">{sf.label}</p>
                  <p className="text-xs text-gray-400">{sf.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-pine-600" />
                <h2 className="font-semibold text-pine-800">导入预览</h2>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                  {fileName}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">证券代码</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">证券名称</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">港币金额</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">人民币金额</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">除权日</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">识别结果</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => {
                    const curType = getCurrencyTypeForRow(row)
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-gray-50 ${
                          curType === "MIXED" ? "bg-red-50/50" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs">{row.securityCode}</td>
                        <td className="py-3 px-4 font-medium text-pine-800">{row.securityName}</td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {row.amountHKD?.toLocaleString() ?? "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {row.amountCNY ? (
                            <span className="font-semibold text-red-600">
                              {row.amountCNY.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{row.exDividendDate}</td>
                        <td className="py-3 px-4">
                          {curType === "MIXED" ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              港币+人民币同列 → 待复核
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              单币种 → 顺利归档
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleConfirmImport}
                className="px-6 py-2.5 bg-pine-800 text-white rounded-lg text-sm font-medium hover:bg-pine-700 hover:shadow-lg transition-all duration-200"
              >
                确认导入
              </button>
              <button
                onClick={() => setStep("upload")}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:border-pine-300 hover:text-pine-700 transition-all duration-200"
              >
                返回
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">导入完成</p>
              <p className="text-sm text-emerald-600 mt-0.5">
                正常记录已自动归档，港币/人民币同列记录已标记"待复核"，等待托管对接人复核
              </p>
            </div>
          </div>

          {pendingRecords.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="font-semibold text-red-800">待复核记录</h2>
                <span className="text-xs text-red-400 bg-red-50 px-2 py-0.5 rounded-full">
                  港币/人民币同列，需托管对接人复核
                </span>
              </div>
              <div className="space-y-3">
                {pendingRecords.map((record) => (
                  <div
                    key={record.id}
                    className="border border-red-100 rounded-lg p-4 bg-red-50/30 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-pine-800">{record.securityName}</span>
                        <span className="text-xs text-gray-400 font-mono">{record.securityCode}</span>
                        <StatusBadge status={record.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        HKD {record.amountHKD?.toLocaleString()} + CNY {record.amountCNY?.toLocaleString()}
                        {" · "}
                        除权日 {record.exDividendDate}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReview(record.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-500 hover:shadow-md transition-all duration-200 flex items-center gap-1.5"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      托管对接人复核通过
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setStep("upload")
              setParsedRows([])
              setFileName("")
            }}
            className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:border-pine-300 hover:text-pine-700 transition-all duration-200"
          >
            继续导入
          </button>
        </div>
      )}

      {records.filter((r) => r.status === "reviewed").length > 0 && step !== "done" && (
        <div className="mt-8 bg-white rounded-xl border border-blue-100 p-6 shadow-sm">
          <h2 className="font-semibold text-blue-800 mb-3">已复核记录</h2>
          <div className="space-y-2">
            {records
              .filter((r) => r.status === "reviewed")
              .map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-pine-800">{record.securityName}</span>
                    <span className="text-xs text-gray-400">{record.securityCode}</span>
                    <StatusBadge status={record.status} />
                  </div>
                  <span className="text-xs text-gray-400">
                    托管对接人李姐已复核
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
