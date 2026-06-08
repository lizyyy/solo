import { useState } from "react"
import { useEvidenceStore } from "@/store/useEvidenceStore"
import StatusBadge from "@/components/StatusBadge"
import { exportToCsv } from "@/utils/fileParsers"
import { ClipboardCheck, ChevronDown, ChevronUp, ArrowRight, Download } from "lucide-react"

export default function AuditPage() {
  const { records, auditEntries, getAuditEntriesByRecordId } = useEvidenceStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id)
  }

  function handleExportAllAudit() {
    const headers = ["审计ID", "记录ID", "字段", "旧值", "新值", "变更类型", "操作人", "时间"]
    const rows = auditEntries.map((e) => [
      e.id, e.recordId, e.fieldName, e.oldValue, e.newValue, e.changeType, e.operator, e.timestamp,
    ])
    exportToCsv(headers, rows, "审计明细_全量.csv")
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-pine-800">
            审计明细
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            汇总所有处理结果，展示每条记录的完整处理链路
          </p>
        </div>
        <button
          onClick={handleExportAllAudit}
          disabled={auditEntries.length === 0}
          className="px-5 py-2.5 bg-pine-800 text-white rounded-lg text-sm font-medium hover:bg-pine-700 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          导出全量审计明细
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-pine-800 text-white">
                <th className="text-left py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">编号</th>
                <th className="text-left py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">证券</th>
                <th className="text-left py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">币种</th>
                <th className="text-right py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">港币金额</th>
                <th className="text-right py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">人民币金额</th>
                <th className="text-left py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">除权日</th>
                <th className="text-left py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">状态</th>
                <th className="text-center py-3.5 px-5 text-xs font-semibold uppercase tracking-wider">明细</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const entryCount = getAuditEntriesByRecordId(record.id).length
                const isExpanded = expandedId === record.id
                const entries = getAuditEntriesByRecordId(record.id)

                return (
                  <>
                    <tr
                      key={record.id}
                      className={`border-b border-gray-50 hover:bg-pine-50/30 cursor-pointer transition-colors ${
                        record.currencyType === "MIXED" ? "bg-red-50/30" : ""
                      }`}
                      onClick={() => toggleExpand(record.id)}
                    >
                      <td className="py-3.5 px-5 font-mono text-xs text-gray-500">{record.id}</td>
                      <td className="py-3.5 px-5">
                        <div>
                          <span className="font-semibold text-pine-800">{record.securityName}</span>
                          <span className="text-xs text-gray-400 ml-2">{record.securityCode}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        {record.currencyType === "MIXED" ? (
                          <span className="inline-flex items-center text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            港币+人民币
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {record.currencyType}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right font-semibold">
                        {record.amountHKD?.toLocaleString() ?? (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {record.amountCNY ? (
                          <span className="font-semibold text-red-600">{record.amountCNY.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <div>
                          <span className={record.correctedExDividendDate ? "line-through text-red-400" : "text-gray-700"}>
                            {record.exDividendDate}
                          </span>
                          {record.correctedExDividendDate && (
                            <>
                              <ArrowRight className="w-3 h-3 inline mx-1 text-emerald-500" />
                              <span className="text-emerald-600 font-semibold">{record.correctedExDividendDate}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs text-gray-400">{entryCount} 条</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-pine-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${record.id}-detail`} className="bg-gray-50/50">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="ml-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ClipboardCheck className="w-4 h-4 text-pine-600" />
                              <h4 className="text-xs font-semibold text-pine-700 uppercase tracking-wider">
                                处理链路
                              </h4>
                            </div>
                            <div className="space-y-2">
                              {entries.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex items-start gap-3 text-sm bg-white rounded-lg border border-gray-100 p-3"
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                      entry.changeType === "flag_review"
                                        ? "bg-red-500"
                                        : entry.changeType === "manual_correction"
                                        ? "bg-amber-500"
                                        : entry.changeType === "rerun"
                                        ? "bg-blue-500"
                                        : "bg-emerald-500"
                                    }`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-pine-800">{entry.fieldName}</span>
                                      <span className="text-xs text-gray-400">
                                        {new Date(entry.timestamp).toLocaleString("zh-CN")}
                                      </span>
                                      <span className="text-xs text-gray-300">·</span>
                                      <span className="text-xs text-gray-400">{entry.operator}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <span className="text-xs text-red-400 line-through">{entry.oldValue}</span>
                                      <ArrowRight className="w-3 h-3 text-gray-300" />
                                      <span className="text-xs text-emerald-600 font-medium">{entry.newValue}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <h3 className="font-semibold text-pine-800 mb-4">差异对比</h3>
        <div className="space-y-4">
          {records
            .filter((r) => r.correctedExDividendDate)
            .map((record) => (
              <div key={record.id} className="grid grid-cols-2 gap-4">
                <div className="border border-red-100 rounded-lg p-4 bg-red-50/30">
                  <p className="text-xs font-medium text-red-600 mb-2">原始数据</p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-500">证券：</span>
                      <span className="font-medium text-pine-800">{record.securityName}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">除权日：</span>
                      <span className="font-medium text-red-600 line-through">{record.exDividendDate}</span>
                    </p>
                  </div>
                </div>
                <div className="border border-emerald-100 rounded-lg p-4 bg-emerald-50/30">
                  <p className="text-xs font-medium text-emerald-600 mb-2">修正后数据</p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-500">证券：</span>
                      <span className="font-medium text-pine-800">{record.securityName}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">除权日：</span>
                      <span className="font-semibold text-emerald-600">{record.correctedExDividendDate}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}

          {records.filter((r) => r.correctedExDividendDate).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">暂无差异对比数据</p>
          )}
        </div>
      </div>
    </div>
  )
}
