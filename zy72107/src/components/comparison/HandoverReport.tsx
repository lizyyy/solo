import { useState } from "react"
import type { ExperimentRecord, ThresholdVersion, ComputationTrace } from "@/types"
import { cn } from "@/lib/utils"
import { Printer, FileDown, ChevronDown, ChevronUp } from "lucide-react"

interface HandoverReportProps {
  records: ExperimentRecord[]
  thresholdVersions: ThresholdVersion[]
  currentThresholdVersion: number
  traces: ComputationTrace[]
}

export default function HandoverReport({
  records,
  thresholdVersions,
  currentThresholdVersion,
  traces,
}: HandoverReportProps) {
  const [expanded, setExpanded] = useState(false)

  const flaggedRecords = records.filter(
    (r) => r.dataQualityFlags.length > 0 || r.conflictWithNote,
  )

  const currentThreshold =
    thresholdVersions.find((v) => v.version === currentThresholdVersion) ??
    thresholdVersions[thresholdVersions.length - 1]

  const allFlags = records.flatMap((r) =>
    r.dataQualityFlags.map((f) => ({ ...f, recordId: r.id, rawNote: r.rawNote })),
  )

  const conflictRecords = records.filter((r) => r.conflictWithNote)

  const handlePrint = () => window.print()

  const handleExport = () => {
    const lines: string[] = []
    lines.push("=== 交接报告 ===")
    lines.push(`生成时间: ${new Date().toLocaleString("zh-CN")}`)
    lines.push("")

    lines.push("【一、数据问题清单】")
    if (flaggedRecords.length === 0) {
      lines.push("  无")
    } else {
      flaggedRecords.forEach((r) => {
        lines.push(`  记录 ${r.id}:`)
        lines.push(`    原始备注: ${r.rawNote}`)
        r.dataQualityFlags.forEach((f) => {
          lines.push(`    - [${f.status}] ${f.type}: ${f.message}`)
        })
      })
    }
    lines.push("")

    lines.push("【二、阈值版本】")
    lines.push(`  当前版本: v${currentThresholdVersion}`)
    if (currentThreshold) {
      lines.push(`  当前值: ${currentThreshold.maxValue} ${currentThreshold.unit}`)
    }
    lines.push("  历史版本:")
    thresholdVersions.forEach((v) => {
      lines.push(`    v${v.version}: ${v.maxValue} ${v.unit} (${v.changedBy}, ${v.changedAt})`)
    })
    lines.push("")

    lines.push("【三、处理建议汇总】")
    if (allFlags.length === 0) {
      lines.push("  无")
    } else {
      allFlags.forEach((f) => {
        lines.push(`  [${f.status}] ${f.type} - ${f.suggestedAction}`)
      })
    }
    lines.push("")

    lines.push("【四、冲突记录】")
    if (conflictRecords.length === 0) {
      lines.push("  无冲突记录")
    } else {
      conflictRecords.forEach((r) => {
        lines.push(`  记录 ${r.id}:`)
        if (r.conflictDetail) {
          lines.push(`    备注说: ${r.conflictDetail.noteSays}`)
          lines.push(`    数据说: ${r.conflictDetail.dataSays}`)
        }
      })
    }
    lines.push("")

    lines.push("【五、计算结果摘要】")
    if (traces.length === 0) {
      lines.push("  无计算记录")
    } else {
      traces.forEach((t) => {
        lines.push(`  记录 ${t.recordId} (${t.computedAt}):`)
        lines.push(`    中心终温: ${t.result.finalCenterTemp}°C`)
        lines.push(`    表面终温: ${t.result.finalSurfaceTemp}°C`)
        lines.push(`    温度梯度: ${t.result.gradient}°C`)
        lines.push(`    超阈值: ${t.result.isExceedingThreshold ? "是" : "否"}`)
      })
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `交接报告_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="print-report">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-stone-700 font-medium mb-3 hover:text-stone-900 transition-colors print:hidden"
      >
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        交接报告（老岑）
      </button>

      {!expanded && (
        <div className="print:hidden">
          <div className="flex gap-2 mb-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-100 hover:bg-stone-200 rounded-md text-stone-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              打印报告
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-100 hover:bg-stone-200 rounded-md text-stone-700 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              导出文本
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="space-y-6 text-sm leading-relaxed">
          <div className="flex gap-2 mb-3 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-100 hover:bg-stone-200 rounded-md text-stone-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              打印报告
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-stone-100 hover:bg-stone-200 rounded-md text-stone-700 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              导出文本
            </button>
          </div>

          <section>
            <h3 className="text-base font-semibold text-stone-800 mb-2 border-b border-stone-200 pb-1">
              一、数据问题清单
            </h3>
            {flaggedRecords.length === 0 ? (
              <p className="text-stone-400">无问题记录</p>
            ) : (
              <ul className="space-y-2">
                {flaggedRecords.map((r) => (
                  <li key={r.id} className="bg-amber-50/60 rounded-md p-2.5">
                    <div className="font-medium text-stone-700">
                      记录 {r.id}
                      {r.conflictWithNote && (
                        <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                          冲突
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">原始备注: {r.rawNote}</div>
                    {r.dataQualityFlags.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 mt-1 text-xs">
                        <StatusBadge status={f.status} />
                        <span className="text-stone-600">{f.type}: {f.message}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-stone-800 mb-2 border-b border-stone-200 pb-1">
              二、阈值版本
            </h3>
            <div className="text-stone-600">
              <div>
                当前版本: <span className="font-medium">v{currentThresholdVersion}</span>
                {currentThreshold && (
                  <span className="ml-2">
                    ({currentThreshold.maxValue} {currentThreshold.unit})
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {thresholdVersions.map((v) => (
                  <div
                    key={v.version}
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      v.version === currentThresholdVersion
                        ? "bg-blue-50 text-blue-700"
                        : "text-stone-500",
                    )}
                  >
                    v{v.version}: {v.maxValue} {v.unit} — {v.changedBy} ({v.changedAt}) {v.reason && `— ${v.reason}`}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base font-semibold text-stone-800 mb-2 border-b border-stone-200 pb-1">
              三、处理建议汇总
            </h3>
            {allFlags.length === 0 ? (
              <p className="text-stone-400">无建议</p>
            ) : (
              <ul className="space-y-1">
                {allFlags.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-stone-600">
                    <StatusBadge status={f.status} />
                    <span>{f.type} — {f.suggestedAction}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-stone-800 mb-2 border-b border-stone-200 pb-1">
              四、冲突记录
            </h3>
            {conflictRecords.length === 0 ? (
              <p className="text-stone-400">无冲突记录</p>
            ) : (
              <ul className="space-y-2">
                {conflictRecords.map((r) => (
                  <li key={r.id} className="bg-red-50/60 rounded-md p-2.5">
                    <div className="font-medium text-stone-700">记录 {r.id}</div>
                    {r.conflictDetail && (
                      <div className="text-xs text-stone-600 mt-1 space-y-0.5">
                        <div>备注说: {r.conflictDetail.noteSays}</div>
                        <div>数据说: {r.conflictDetail.dataSays}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-stone-800 mb-2 border-b border-stone-200 pb-1">
              五、计算结果摘要
            </h3>
            {traces.length === 0 ? (
              <p className="text-stone-400">无计算记录</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="text-left py-1.5 px-2">记录</th>
                      <th className="text-right py-1.5 px-2">中心终温</th>
                      <th className="text-right py-1.5 px-2">表面终温</th>
                      <th className="text-right py-1.5 px-2">梯度</th>
                      <th className="text-center py-1.5 px-2">超阈值</th>
                      <th className="text-left py-1.5 px-2">计算时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map((t) => (
                      <tr key={t.id} className="border-b border-stone-100">
                        <td className="py-1.5 px-2 text-stone-700">{t.recordId}</td>
                        <td className="py-1.5 px-2 text-right">{t.result.finalCenterTemp}°C</td>
                        <td className="py-1.5 px-2 text-right">{t.result.finalSurfaceTemp}°C</td>
                        <td className="py-1.5 px-2 text-right">{t.result.gradient}°C</td>
                        <td className="py-1.5 px-2 text-center">
                          {t.result.isExceedingThreshold ? (
                            <span className="text-red-600">是</span>
                          ) : (
                            <span className="text-green-600">否</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-stone-500">{t.computedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: "pending" | "confirmed" | "dismissed" }) {
  return (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded font-medium",
        status === "pending" && "bg-amber-100 text-amber-700",
        status === "confirmed" && "bg-green-100 text-green-700",
        status === "dismissed" && "bg-stone-100 text-stone-500",
      )}
    >
      {status === "pending" ? "待处理" : status === "confirmed" ? "已确认" : "已忽略"}
    </span>
  )
}
