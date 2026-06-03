import { useStore } from "@/store/useStore"
import type { ValidationResult } from "@/types"
import StatusBadge from "@/components/StatusBadge"
import { Upload, Check, CheckCircle, AlertTriangle, XCircle, Eye } from "lucide-react"

const VALIDATION_CONFIG: Record<ValidationResult["type"], { border: string; icon: typeof CheckCircle; iconColor: string; label: string }> = {
  normal: { border: "border-l-emerald-500", icon: CheckCircle, iconColor: "text-emerald-500", label: "正常" },
  missing_coordinate: { border: "border-l-amber-500", icon: AlertTriangle, iconColor: "text-amber-500", label: "坐标缺失" },
  supplement_mismatch: { border: "border-l-rose-500", icon: XCircle, iconColor: "text-rose-500", label: "补录不一致" },
}

export default function ImportPage() {
  const records = useStore((s) => s.records)
  const remarks = useStore((s) => s.remarks)
  const validationResults = useStore((s) => s.validationResults)
  const importedRecordIds = useStore((s) => s.importedRecordIds)
  const reviewedRecordIds = useStore((s) => s.reviewedRecordIds)
  const importRecords = useStore((s) => s.importRecords)
  const reviewRemark = useStore((s) => s.reviewRemark)

  const handleImportAll = () => {
    importRecords(records.map((r) => r.id))
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800">测距仪记录导入</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {importedRecordIds.length === 0 ? (
            <button
              onClick={handleImportAll}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Upload className="h-4 w-4" />
              一键导入样例数据
            </button>
          ) : (
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" />
              已导入 {importedRecordIds.length} 条记录
            </div>
          )}

          {importedRecordIds.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">编号</th>
                    <th className="pb-2 pr-4 font-medium">雪道名称</th>
                    <th className="pb-2 pr-4 font-medium">操作人</th>
                    <th className="pb-2 pr-4 font-medium">导入时间</th>
                    <th className="pb-2 pr-4 font-medium">照片数</th>
                    <th className="pb-2 pr-4 font-medium">坐标行数</th>
                    <th className="pb-2 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-mono text-gray-600">{r.id}</td>
                      <td className="py-2.5 pr-4 text-gray-800">{r.slopeName}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{r.operator}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{r.importTime}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{r.photoPoints.length}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{r.coordinateRows.length}</td>
                      <td className="py-2.5">
                        {importedRecordIds.includes(r.id) ? (
                          <StatusBadge status={r.status} />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {importedRecordIds.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">校验结果摘要</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {validationResults.map((vr) => {
              const cfg = VALIDATION_CONFIG[vr.type]
              const Icon = cfg.icon
              return (
                <div key={vr.recordId} className={`rounded-xl border border-gray-200 border-l-4 bg-white p-4 shadow-sm ${cfg.border}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                    <span className="font-mono text-sm text-gray-600">{vr.recordId}</span>
                  </div>
                  <p className="mb-1 text-sm font-medium text-gray-800">{cfg.label}</p>
                  <p className="text-xs text-gray-500">{vr.description}</p>
                  {vr.type === "missing_coordinate" && vr.missingSequenceNumbers.length > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      缺失序号：{vr.missingSequenceNumbers.join("、")}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {importedRecordIds.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">障碍物备注补录</h2>
          <div className="space-y-4">
            {remarks.map((remark) => {
              const reviewed = reviewedRecordIds.includes(remark.recordId)
              return (
                <div key={remark.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-800">{remark.source}</span>
                        <span className="mx-2">·</span>
                        {remark.recordedAt}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">{remark.remarkText}</p>
                    </div>
                    {reviewed ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                        已补看
                      </span>
                    ) : (
                      <button
                        onClick={() => reviewRemark(remark.recordId)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        许工补看
                      </button>
                    )}
                  </div>

                  {remark.entries.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-gray-500">
                          <th className="pb-1.5 pr-4 font-medium">序号</th>
                          <th className="pb-1.5 pr-4 font-medium">经度</th>
                          <th className="pb-1.5 pr-4 font-medium">纬度</th>
                          <th className="pb-1.5 font-medium">描述</th>
                        </tr>
                      </thead>
                      <tbody>
                        {remark.entries.map((e) => (
                          <tr key={e.id} className="border-b border-gray-50">
                            <td className="py-2 pr-4 text-gray-600">{e.sequenceNumber}</td>
                            <td className="py-2 pr-4 font-mono text-gray-600">{e.longitude}</td>
                            <td className="py-2 pr-4 font-mono text-gray-600">{e.latitude}</td>
                            <td className="py-2 text-gray-600">{e.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
