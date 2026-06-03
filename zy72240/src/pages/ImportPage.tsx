import { useState } from "react"
import { useEvidenceStore } from "@/store/useEvidenceStore"
import StatusBadge from "@/components/StatusBadge"
import {
  Upload,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
} from "lucide-react"

const mockImportData = [
  {
    securityCode: "00004.HK",
    securityName: "长实集团",
    amountHKD: 350000,
    amountCNY: null,
    exDividendDate: "2026-05-25",
    custodianConfirmRef: "CUST-2026-0525-004",
  },
  {
    securityCode: "00005.HK",
    securityName: "恒基兆业",
    amountHKD: 280000,
    amountCNY: 250000,
    exDividendDate: "2026-05-26",
    custodianConfirmRef: "CUST-2026-0526-005",
  },
]

export default function ImportPage() {
  const { records, importRecords, reviewRecord } = useEvidenceStore()
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")
  const [importedIds, setImportedIds] = useState<string[]>([])

  const pendingRecords = records.filter((r) => r.status === "pending_review")

  function handleSimulateImport() {
    const newIds: string[] = []
    const store = useEvidenceStore.getState()
    mockImportData.forEach((d) => {
      importRecords([d])
    })
    const latestRecords = useEvidenceStore.getState().records
    const newestIds = latestRecords
      .filter((r) => !store.records.find((old) => old.id === r.id))
      .map((r) => r.id)
    setImportedIds(newestIds)
    setStep("preview")
  }

  function handleConfirmImport() {
    setStep("done")
  }

  function handleReview(id: string) {
    reviewRecord(id)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-pine-800">
          托管确认导入
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          从托管确认页导入支付拒付记录，系统自动识别币种异常
        </p>
      </div>

      {step === "upload" && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 shadow-sm">
          <div
            className="border-2 border-dashed border-pine-300 rounded-xl p-12 text-center hover:border-pine-500 hover:bg-pine-50/30 transition-all duration-300 cursor-pointer"
            onClick={handleSimulateImport}
          >
            <Upload className="w-12 h-12 text-pine-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-pine-700 mb-2">
              点击模拟导入托管确认页
            </h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              模拟导入两条记录：一条正常单币种（长实集团 HKD 350,000），一条港币/人民币同列（恒基兆业 HKD 280,000 + CNY 250,000）
            </p>
            <p className="text-xs text-gray-300 mt-4">
              演示环境：点击即可模拟文件上传
            </p>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Eye className="w-5 h-5 text-pine-600" />
              <h2 className="font-semibold text-pine-800">导入预览</h2>
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
                  {useEvidenceStore.getState().records
                    .filter((r) => importedIds.includes(r.id))
                    .map((record) => (
                      <tr
                        key={record.id}
                        className={`border-b border-gray-50 ${
                          record.currencyType === "MIXED" ? "bg-red-50/50" : ""
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs">{record.securityCode}</td>
                        <td className="py-3 px-4 font-medium text-pine-800">{record.securityName}</td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {record.amountHKD?.toLocaleString() ?? "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {record.amountCNY ? (
                            <span className="font-semibold text-red-600">
                              {record.amountCNY.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{record.exDividendDate}</td>
                        <td className="py-3 px-4">
                          {record.currencyType === "MIXED" ? (
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
                    ))}
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
                      模拟托管对接人复核
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setStep("upload")}
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
