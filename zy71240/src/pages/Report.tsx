import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import { CASES, STANDARD_ANSWERS } from "@/data/mockData"
import { applyAmendmentValue } from "@/engine/rules"
import type { AmendmentRecord, ErrorImpact, Judgment } from "@/types"
import {
  FileText,
  AlertTriangle,
  Download,
  Home,
  Edit3,
  Plus,
  Clock,
} from "lucide-react"

function errorBadgeClass(errorType: ErrorImpact["errorType"]) {
  switch (errorType) {
    case "旧伤误判": return "error-old-damage"
    case "价格超限": return "error-price-limit"
    case "免责条款漏看": return "error-exemption"
  }
}

function AmendedCell({
  currentValue,
  amendments,
  fieldName,
}: {
  currentValue: string
  amendments: AmendmentRecord[]
  fieldName: string
}) {
  const { displayValue, hasAmendment, latestAmendment } = applyAmendmentValue(
    currentValue,
    amendments,
    fieldName
  )
  if (!hasAmendment) return <span>{currentValue}</span>
  return (
    <span>
      <span className="amendment-old">{currentValue}</span>{" "}
      <span className="amendment-new">{displayValue}</span>
      {latestAmendment && (
        <span className="amendment-reason">({latestAmendment.reason})</span>
      )}
    </span>
  )
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function Report() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const caseId = id || ""

  const judgments = useGameStore((s) => s.judgments)
  const settlement = useGameStore((s) => s.settlement)
  const errorImpacts = useGameStore((s) => s.errorImpacts)
  const amendments = useGameStore((s) => s.amendments)
  const addAmendment = useGameStore((s) => s.addAmendment)
  const session = useGameStore((s) => s.session)
  const report = useGameStore((s) => s.report)

  const [showAmendmentForm, setShowAmendmentForm] = useState(false)
  const [fieldName, setFieldName] = useState("")
  const [oldValue, setOldValue] = useState("")
  const [newValue, setNewValue] = useState("")
  const [reason, setReason] = useState("")

  const caseData = CASES.find((c) => c.id === caseId)
  const answer = STANDARD_ANSWERS[caseId]

  const totalPayoutStr = settlement ? String(settlement.totalPayout) : "0"
  const correctPayoutStr = settlement ? String(settlement.correctPayout) : "0"
  const diffStr = settlement ? String(settlement.payoutDifference) : "0"
  const riskStr = settlement?.riskLevel || "—"

  const totalDisplay = applyAmendmentValue(totalPayoutStr, amendments, "totalPayout")
  const correctDisplay = applyAmendmentValue(correctPayoutStr, amendments, "correctPayout")
  const diffDisplay = applyAmendmentValue(diffStr, amendments, "payoutDifference")
  const riskDisplay = applyAmendmentValue(riskStr, amendments, "riskLevel")

  function getCurrentFieldValue(fname: string): string {
    const judgmentMatch = fname.match(/^(.+)-(grade|payout)$/)
    if (judgmentMatch) {
      const [, partName, field] = judgmentMatch
      const j = judgments.find((jg) => jg.partName === partName)
      if (!j) return ""
      if (field === "grade") return j.repairGrade
      return `¥${j.estimatedPayout.toLocaleString()}`
    }
    if (fname === "totalPayout") return totalPayoutStr
    if (fname === "correctPayout") return correctPayoutStr
    if (fname === "payoutDifference") return diffStr
    if (fname === "riskLevel") return riskStr
    return ""
  }

  function handleFieldChange(f: string) {
    setFieldName(f)
    const current = getCurrentFieldValue(f)
    setOldValue(current)
  }

  function handleSubmitAmendment() {
    if (!fieldName || !newValue || !reason) return
    const effectiveOldValue = oldValue || getCurrentFieldValue(fieldName)
    addAmendment(fieldName, effectiveOldValue, newValue, reason)
    setFieldName("")
    setOldValue("")
    setNewValue("")
    setReason("")
  }

  function handleExportJSON() {
    const reportData = {
      caseInfo: caseData,
      judgments,
      settlement,
      errorImpacts,
      amendments,
      standardAnswer: answer,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `damage-report-${caseId}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const fieldOptions = [
    ...judgments.map((j) => `${j.partName}-grade`),
    ...judgments.map((j) => `${j.partName}-payout`),
    "totalPayout",
    "correctPayout",
    "payoutDifference",
    "riskLevel",
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={28} className="text-steel-500" />
        <h1 className="section-title mb-0">定损报告</h1>
      </div>

      <div className="card mb-6">
        <div className="card-header flex items-center justify-between">
          <span>报告基本信息</span>
          {report && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              report.status === "已修正" ? "bg-amber-light/20 text-amber-light" :
              report.status === "已提交" ? "bg-jade/20 text-jade" :
              "bg-steel-200 text-steel-600"
            }`}>
              {report.status}
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-cool">案件编号：</span>
              <span className="font-medium">{caseData?.caseNumber || "—"}</span>
            </div>
            <div>
              <span className="text-cool">车型：</span>
              <span className="font-medium">{caseData?.carModel || "—"}</span>
            </div>
            <div>
              <span className="text-cool">事故日期：</span>
              <span className="font-medium">{caseData?.accidentDate || "—"}</span>
            </div>
            <div>
              <span className="text-cool">险种：</span>
              <span className="font-medium">{caseData?.insuranceType || "—"}</span>
            </div>
            <div>
              <span className="text-cool">定损员：</span>
              <span className="font-medium">{session?.playerName || "—"}</span>
            </div>
            <div>
              <span className="text-cool">报告日期：</span>
              <span className="font-medium">{new Date().toLocaleDateString("zh-CN")}</span>
            </div>
          </div>
          {caseData?.description && (
            <p className="mt-3 text-sm text-cool border-t border-steel-50 pt-3">
              {caseData.description}
            </p>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">判定明细</div>
        <div className="card-body overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-steel-50">
                <th className="text-left py-2 px-3 text-cool font-medium">部位</th>
                <th className="text-center py-2 px-3 text-cool font-medium">定级</th>
                <th className="text-right py-2 px-3 text-cool font-medium">赔付金额</th>
              </tr>
            </thead>
            <tbody>
              {judgments.map((j: Judgment) => (
                <tr key={j.id} className="border-b border-steel-50">
                  <td className="py-2 px-3 font-medium">{j.partName}</td>
                  <td className="py-2 px-3 text-center">
                    <AmendedCell
                      currentValue={j.repairGrade}
                      amendments={amendments}
                      fieldName={`${j.partName}-grade`}
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <AmendedCell
                      currentValue={`¥${j.estimatedPayout.toLocaleString()}`}
                      amendments={amendments}
                      fieldName={`${j.partName}-payout`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">结案汇总</div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-cool text-sm mb-1">总赔付</p>
              <p className="text-xl font-bold text-steel-500">
                {totalDisplay.hasAmendment ? (
                  <>
                    <span className="amendment-old">¥{parseInt(totalPayoutStr).toLocaleString()}</span>{" "}
                    <span className="amendment-new">¥{parseInt(totalDisplay.displayValue).toLocaleString()}</span>
                    {totalDisplay.latestAmendment && (
                      <span className="amendment-reason">({totalDisplay.latestAmendment.reason})</span>
                    )}
                  </>
                ) : (
                  `¥${parseInt(totalPayoutStr).toLocaleString()}`
                )}
              </p>
            </div>
            <div>
              <p className="text-cool text-sm mb-1">标准赔付</p>
              <p className="text-xl font-bold text-jade">
                {correctDisplay.hasAmendment ? (
                  <>
                    <span className="amendment-old">¥{parseInt(correctPayoutStr).toLocaleString()}</span>{" "}
                    <span className="amendment-new">¥{parseInt(correctDisplay.displayValue).toLocaleString()}</span>
                    {correctDisplay.latestAmendment && (
                      <span className="amendment-reason">({correctDisplay.latestAmendment.reason})</span>
                    )}
                  </>
                ) : (
                  `¥${parseInt(correctPayoutStr).toLocaleString()}`
                )}
              </p>
            </div>
            <div>
              <p className="text-cool text-sm mb-1">差异</p>
              <p className={`text-xl font-bold ${parseInt(diffStr) > 0 ? "text-red-600" : parseInt(diffStr) < 0 ? "text-amber-dark" : "text-jade"}`}>
                {diffDisplay.hasAmendment ? (
                  <>
                    <span className="amendment-old">¥{parseInt(diffStr).toLocaleString()}</span>{" "}
                    <span className="amendment-new">¥{parseInt(diffDisplay.displayValue).toLocaleString()}</span>
                    {diffDisplay.latestAmendment && (
                      <span className="amendment-reason">({diffDisplay.latestAmendment.reason})</span>
                    )}
                  </>
                ) : (
                  `¥${parseInt(diffStr).toLocaleString()}`
                )}
              </p>
            </div>
            <div>
              <p className="text-cool text-sm mb-1">风险等级</p>
              <p className="text-xl font-bold text-steel-500">
                {riskDisplay.hasAmendment ? (
                  <>
                    <span className="amendment-old">{riskStr}</span>{" "}
                    <span className="amendment-new">{riskDisplay.displayValue}</span>
                    {riskDisplay.latestAmendment && (
                      <span className="amendment-reason">({riskDisplay.latestAmendment.reason})</span>
                    )}
                  </>
                ) : (
                  riskStr
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {errorImpacts.length > 0 && (
        <div className="card mb-6">
          <div className="card-header flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>错误影响</span>
          </div>
          <div className="card-body space-y-4">
            {errorImpacts.map((error) => (
              <div key={error.id} className="border border-steel-50 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={errorBadgeClass(error.errorType)}>{error.errorType}</span>
                  <span className="text-cool text-xs">严重度: {error.severity}</span>
                </div>
                <p className="text-sm mb-1">{error.reason}</p>
                {error.affectedParts.length > 0 && (
                  <p className="text-xs text-cool">影响部位: {error.affectedParts.join("、")}</p>
                )}
                {error.affectedAmounts.length > 0 && (
                  <p className="text-xs text-cool">影响金额: {error.affectedAmounts.join("；")}</p>
                )}
                {error.affectedClauses.length > 0 && (
                  <p className="text-xs text-cool">关联条款: {error.affectedClauses.join("；")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 size={18} />
            <span>讲师修正模式</span>
          </div>
          <button
            onClick={() => setShowAmendmentForm(!showAmendmentForm)}
            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
          >
            {showAmendmentForm ? "收起" : "展开"}
          </button>
        </div>
        {showAmendmentForm && (
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm text-cool mb-1">修正字段</label>
                <select
                  value={fieldName}
                  onChange={(e) => handleFieldChange(e.target.value)}
                  className="w-full border border-steel-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/50"
                >
                  <option value="">请选择字段</option>
                  {fieldOptions.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-cool mb-1">原值（自动填充）</label>
                  <input
                    type="text"
                    value={oldValue}
                    onChange={(e) => setOldValue(e.target.value)}
                    className="w-full border border-steel-100 rounded-md px-3 py-2 text-sm bg-steel-50 focus:outline-none focus:ring-2 focus:ring-amber/50"
                    placeholder="选择字段后自动填充"
                  />
                </div>
                <div>
                  <label className="block text-sm text-cool mb-1">新值</label>
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full border border-steel-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/50"
                    placeholder="输入新值"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-cool mb-1">修正原因</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full border border-steel-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber/50 resize-none"
                  placeholder="输入修正原因"
                />
              </div>
              <button
                onClick={handleSubmitAmendment}
                disabled={!fieldName || !newValue || !reason}
                className="btn-amber inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                提交修正
              </button>
            </div>

            {amendments.length > 0 && (
              <div className="mt-4 border-t border-steel-50 pt-4">
                <h3 className="text-sm font-medium text-steel-500 mb-3">修正记录</h3>
                <div className="space-y-2">
                  {amendments.map((a) => (
                    <div key={a.id} className="bg-cream rounded-md px-3 py-2 text-sm">
                      <span className="font-medium">{a.fieldName}</span>:{" "}
                      <span className="amendment-old">{a.oldValue}</span>{" → "}
                      <span className="amendment-new">{a.newValue}</span>
                      <span className="amendment-reason">({a.reason})</span>
                      <span className="text-cool text-xs ml-2">
                        <Clock size={12} className="inline" /> {formatTime(a.amendedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {amendments.length > 0 && (
        <div className="card mb-6">
          <div className="card-header flex items-center gap-2">
            <Clock size={18} />
            <span>修正历史</span>
          </div>
          <div className="card-body overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-steel-50">
                  <th className="text-left py-2 px-3 text-cool font-medium">字段</th>
                  <th className="text-center py-2 px-3 text-cool font-medium">原值</th>
                  <th className="text-center py-2 px-3 text-cool font-medium">新值</th>
                  <th className="text-left py-2 px-3 text-cool font-medium">原因</th>
                  <th className="text-center py-2 px-3 text-cool font-medium">时间</th>
                  <th className="text-center py-2 px-3 text-cool font-medium">编辑人</th>
                </tr>
              </thead>
              <tbody>
                {amendments.map((a) => (
                  <tr key={a.id} className="border-b border-steel-50">
                    <td className="py-2 px-3 font-medium">{a.fieldName}</td>
                    <td className="py-2 px-3 text-center amendment-old">{a.oldValue}</td>
                    <td className="py-2 px-3 text-center amendment-new">{a.newValue}</td>
                    <td className="py-2 px-3">{a.reason}</td>
                    <td className="py-2 px-3 text-center text-cool text-xs">{formatTime(a.amendedAt)}</td>
                    <td className="py-2 px-3 text-center">{a.amendedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4">
        <button onClick={handleExportJSON} className="btn-amber inline-flex items-center gap-2">
          <Download size={18} />
          导出JSON
        </button>
        <button onClick={() => navigate("/")} className="btn-outline inline-flex items-center gap-2">
          <Home size={18} />
          返回首页
        </button>
      </div>
    </div>
  )
}
