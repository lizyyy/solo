import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import { STANDARD_ANSWERS } from "@/data/mockData"
import { getPriceForGrade } from "@/engine/rules"
import type { ErrorImpact } from "@/types"
import { ChevronDown, ChevronUp, AlertTriangle, FileText } from "lucide-react"

function errorBadgeClass(errorType: ErrorImpact["errorType"]) {
  switch (errorType) {
    case "旧伤误判": return "error-old-damage"
    case "价格超限": return "error-price-limit"
    case "免责条款漏看": return "error-exemption"
  }
}

function severityColor(severity: ErrorImpact["severity"]) {
  switch (severity) {
    case "高": return "text-red-600"
    case "中": return "text-amber"
    case "低": return "text-jade"
  }
}

function TimelineNode({ error, index }: { error: ErrorImpact; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-amber border-2 border-amber-dark shrink-0 mt-1.5" />
        {index > 0 && <div className="w-0.5 flex-1 bg-steel-100 -mt-1" />}
      </div>
      <div className="flex-1 pb-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left card hover:shadow-md transition-shadow"
        >
          <div className="card-body flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={errorBadgeClass(error.errorType)}>{error.errorType}</span>
              <span className={`text-sm font-medium ${severityColor(error.severity)}`}>
                严重度: {error.severity}
              </span>
            </div>
            {expanded ? <ChevronUp size={18} className="text-cool" /> : <ChevronDown size={18} className="text-cool" />}
          </div>
        </button>
        {expanded && (
          <div className="mt-2 ml-2 card">
            <div className="card-body space-y-3 text-sm">
              <div>
                <span className="text-cool font-medium">影响部位：</span>
                <span>{error.affectedParts.length > 0 ? error.affectedParts.join("、") : "无"}</span>
              </div>
              <div>
                <span className="text-cool font-medium">影响金额：</span>
                <span>{error.affectedAmounts.length > 0 ? error.affectedAmounts.join("；") : "无"}</span>
              </div>
              <div>
                <span className="text-cool font-medium">关联条款：</span>
                <span>{error.affectedClauses.length > 0 ? error.affectedClauses.join("；") : "无"}</span>
              </div>
              <div>
                <span className="text-cool font-medium">原因：</span>
                <span>{error.reason}</span>
              </div>
              <div>
                <span className="text-cool font-medium">严重度：</span>
                <span className={severityColor(error.severity)}>{error.severity}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Replay() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const errorImpacts = useGameStore((s) => s.errorImpacts)
  const judgments = useGameStore((s) => s.judgments)
  const settlement = useGameStore((s) => s.settlement)

  const caseId = id || ""
  const answer = STANDARD_ANSWERS[caseId]

  const comparisonRows = answer
    ? answer.partGrades.map((pg) => {
        const playerJudgment = judgments.find((j) => j.partName === pg.partName)
        const playerGrade = playerJudgment?.repairGrade || "—"
        const playerPayout = playerJudgment?.estimatedPayout ?? 0
        const correctPayout = getPriceForGrade(caseId, pg.partName, pg.grade)
        const gradeMismatch = playerGrade !== pg.grade
        return {
          partName: pg.partName,
          playerGrade,
          correctGrade: pg.grade,
          playerPayout,
          correctPayout,
          gradeMismatch,
        }
      })
    : []

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle size={28} className="text-amber" />
        <h1 className="section-title mb-0">错误回放</h1>
      </div>

      <div className="card mb-8">
        <div className="card-header flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>错误时间线</span>
        </div>
        <div className="card-body">
          {errorImpacts.length === 0 ? (
            <p className="text-cool text-center py-4">恭喜！没有检测到错误。</p>
          ) : (
            <div className="space-y-0">
              {errorImpacts.map((error, i) => (
                <TimelineNode key={error.id} error={error} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      {answer && (
        <div className="card mb-8">
          <div className="card-header flex items-center gap-2">
            <FileText size={18} />
            <span>判定对比</span>
          </div>
          <div className="card-body overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steel-50">
                  <th className="text-left py-2 px-3 text-cool font-medium">部位</th>
                  <th className="text-center py-2 px-3 text-cool font-medium">玩家定级</th>
                  <th className="text-center py-2 px-3 text-cool font-medium">标准定级</th>
                  <th className="text-right py-2 px-3 text-cool font-medium">玩家赔付</th>
                  <th className="text-right py-2 px-3 text-cool font-medium">标准赔付</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.partName}
                    className={`border-b border-steel-50 ${row.gradeMismatch ? "bg-amber/10" : ""}`}
                  >
                    <td className="py-2 px-3 font-medium">{row.partName}</td>
                    <td className={`py-2 px-3 text-center ${row.gradeMismatch ? "text-amber-dark font-medium" : ""}`}>
                      {row.playerGrade}
                    </td>
                    <td className="py-2 px-3 text-center">{row.correctGrade}</td>
                    <td className={`py-2 px-3 text-right ${row.gradeMismatch ? "text-amber-dark font-medium" : ""}`}>
                      ¥{row.playerPayout.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">¥{row.correctPayout.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {settlement && (
        <div className="card mb-8">
          <div className="card-body flex justify-between items-center">
            <div>
              <p className="text-cool text-sm">总赔付</p>
              <p className="text-xl font-bold text-steel-500">¥{settlement.totalPayout.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-cool text-sm">标准赔付</p>
              <p className="text-xl font-bold text-jade">¥{settlement.correctPayout.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-cool text-sm">差异</p>
              <p className={`text-xl font-bold ${settlement.payoutDifference > 0 ? "text-red-600" : settlement.payoutDifference < 0 ? "text-amber-dark" : "text-jade"}`}>
                {settlement.payoutDifference > 0 ? "+" : ""}¥{settlement.payoutDifference.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={() => navigate(`/case/${caseId}/report`)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <FileText size={18} />
          查看定损报告
        </button>
      </div>
    </div>
  )
}
