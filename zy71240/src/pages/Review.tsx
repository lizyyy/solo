import { useState, useMemo } from "react"
import { useGameStore } from "@/store/gameStore"
import { useNavigate } from "react-router-dom"
import { CASES, STANDARD_ANSWERS, POLICY_RULES } from "@/data/mockData"
import type { AmendmentRecord } from "@/types"
import {
  BarChart3,
  FileText,
  ArrowLeft,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  AlertTriangle,
} from "lucide-react"

const MOCK_ERROR_RATES: Record<string, number> = {
  "case-001": 42,
  "case-002": 55,
  "case-003": 28,
}

const MOCK_ERROR_DISTRIBUTION = [
  { type: "旧伤误判", count: 5, color: "bg-amber" },
  { type: "价格超限", count: 3, color: "bg-red-500" },
  { type: "免责条款漏看", count: 7, color: "bg-purple-500" },
]

function getErrorTypesForCase(caseId: string): string[] {
  const answer = STANDARD_ANSWERS[caseId]
  if (!answer) return []
  const rules = POLICY_RULES[caseId] || []
  const types: string[] = []
  const hasOldDamage = rules.some(
    (r) => r.isExemption && r.relatedParts.length > 0
  )
  if (hasOldDamage) types.push("旧伤误判")
  const hasPriceLimit = rules.some((r) => r.coverageLimit > 0)
  if (hasPriceLimit) types.push("价格超限")
  if (answer.exemptionClauses.length > 0) types.push("免责条款漏看")
  return types
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function AmendmentRow({ record }: { record: AmendmentRecord }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-steel-50 last:border-b-0">
      <div
        className="grid grid-cols-[140px_100px_1fr_1fr_80px] items-center gap-2 px-4 py-3 cursor-pointer hover:bg-cream/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm text-cool flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {formatTimestamp(record.amendedAt)}
        </span>
        <span className="text-sm font-medium flex items-center gap-1">
          <Edit className="w-3.5 h-3.5 text-amber" />
          {record.fieldName}
        </span>
        <span className="amendment-old truncate">{record.oldValue}</span>
        <span className="amendment-new truncate">{record.newValue}</span>
        <span className="text-sm text-cool flex items-center justify-end gap-1">
          {record.amendedBy}
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </div>
      {expanded && (
        <div className="px-4 pb-3 pl-[244px]">
          <div className="text-sm">
            <span className="text-cool">修改理由：</span>
            <span>{record.reason}</span>
          </div>
          <div className="mt-1">
            <span className="text-cool text-xs">旧值：</span>
            <span className="amendment-old">{record.oldValue}</span>
            <span className="mx-2 text-cool text-xs">→</span>
            <span className="text-xs">新值：</span>
            <span className="amendment-new">{record.newValue}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Review() {
  const navigate = useNavigate()
  const amendments = useGameStore((s) => s.amendments)

  const amendmentsByCase = useMemo(() => {
    const grouped: Record<string, AmendmentRecord[]> = {}
    for (const a of amendments) {
      const key = a.caseId || "unknown"
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(a)
    }
    return grouped
  }, [amendments])

  const caseStats = useMemo(
    () =>
      CASES.map((c) => ({
        ...c,
        errorRate: MOCK_ERROR_RATES[c.id] ?? 0,
        errorTypes: getErrorTypesForCase(c.id),
        amendmentCount: (amendmentsByCase[c.id] || []).length,
      })),
    [amendmentsByCase]
  )

  const maxErrorCount = Math.max(
    ...MOCK_ERROR_DISTRIBUTION.map((d) => d.count),
    1
  )

  const reviewData = useMemo(
    () => ({
      generatedAt: Date.now(),
      caseStatistics: caseStats.map((c) => ({
        caseId: c.id,
        caseNumber: c.caseNumber,
        carModel: c.carModel,
        errorRate: c.errorRate,
        errorTypes: c.errorTypes,
      })),
      errorDistribution: MOCK_ERROR_DISTRIBUTION,
      amendments,
    }),
    [caseStats, amendments]
  )

  function handleExport() {
    const blob = new Blob([JSON.stringify(reviewData, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `review-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-steel-500 text-white px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 hover:text-amber-light transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">返回</span>
        </button>
        <h1 className="font-serif text-xl font-bold">月底复盘</h1>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <section>
          <h2 className="section-title flex items-center gap-2">
            <FileText className="w-5 h-5" />
            案件统计
          </h2>
          <div className="space-y-4">
            {caseStats.map((c) => (
              <div key={c.id} className="card">
                <div className="card-header flex items-center justify-between">
                  <span>
                    案件 {c.caseNumber} — {c.carModel}
                  </span>
                  <AlertTriangle className="w-4 h-4 text-amber-light" />
                </div>
                <div className="card-body space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">误判率</span>
                      <span className="text-sm font-bold text-amber">
                        {c.errorRate}%
                      </span>
                    </div>
                    <div className="w-full bg-steel-50 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-amber h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.errorRate}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium">常见错因：</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.errorTypes.map((t) => {
                        const cls =
                          t === "旧伤误判"
                            ? "error-old-damage"
                            : t === "价格超限"
                              ? "error-price-limit"
                              : "error-exemption"
                        return (
                          <span key={t} className={cls}>
                            {t}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  {c.amendmentCount > 0 && (
                    <div className="flex items-center gap-2 pt-1 border-t border-steel-50">
                      <Edit className="w-3.5 h-3.5 text-amber" />
                      <span className="text-sm">
                        累计修正 <span className="font-bold text-amber">{c.amendmentCount}</span> 条
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            错误类型分布
          </h2>
          <div className="card">
            <div className="card-body space-y-4">
              {MOCK_ERROR_DISTRIBUTION.map((d) => (
                <div key={d.type} className="flex items-center gap-3">
                  <span className="w-28 text-sm font-medium text-right shrink-0">
                    {d.type}
                  </span>
                  <div className="flex-1 bg-steel-50 rounded-full h-6 overflow-hidden">
                    <div
                      className={`${d.color} h-full rounded-full flex items-center justify-end px-2 transition-all duration-500`}
                      style={{
                        width: `${Math.max((d.count / maxErrorCount) * 100, 20)}%`,
                      }}
                    >
                      <span className="text-white text-xs font-bold">
                        {d.count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title flex items-center gap-2">
            <Edit className="w-5 h-5" />
            修正追溯
          </h2>
          {amendments.length === 0 ? (
            <div className="card">
              <div className="card-body text-center text-cool py-8">
                暂无修正记录
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {CASES.map((c) => {
                const caseAmendments = amendmentsByCase[c.id]
                if (!caseAmendments || caseAmendments.length === 0) return null
                return (
                  <div key={c.id} className="card">
                    <div className="card-header flex items-center justify-between">
                      <span>{c.caseNumber} — {c.carModel}</span>
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                        {caseAmendments.length} 条修正
                      </span>
                    </div>
                    <div>
                      <div className="grid grid-cols-[140px_100px_1fr_1fr_80px] gap-2 px-4 py-2 bg-steel-50 text-xs font-medium text-cool">
                        <span>修正时间</span>
                        <span>字段</span>
                        <span>旧值</span>
                        <span>新值</span>
                        <span className="text-right">修改人</span>
                      </div>
                      {caseAmendments.map((a) => (
                        <AmendmentRow key={a.id} record={a} />
                      ))}
                    </div>
                  </div>
                )
              })}
              {amendmentsByCase["unknown"] && amendmentsByCase["unknown"].length > 0 && (
                <div className="card">
                  <div className="card-header">其他修正记录</div>
                  <div>
                    <div className="grid grid-cols-[140px_100px_1fr_1fr_80px] gap-2 px-4 py-2 bg-steel-50 text-xs font-medium text-cool">
                      <span>修正时间</span>
                      <span>字段</span>
                      <span>旧值</span>
                      <span>新值</span>
                      <span className="text-right">修改人</span>
                    </div>
                    {amendmentsByCase["unknown"].map((a) => (
                      <AmendmentRow key={a.id} record={a} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex justify-center pb-8">
          <button onClick={handleExport} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出复盘报告
          </button>
        </div>
      </main>
    </div>
  )
}
