import { useState } from "react"
import { useGameStore } from "@/store/gameStore"
import { useParams, useNavigate } from "react-router-dom"
import type { ErrorImpact, ErrorType } from "@/types"
import {
  Calculator,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  RotateCcw,
} from "lucide-react"

const ERROR_TYPE_CONFIG: Record<ErrorType, { label: string; badgeClass: string }> = {
  旧伤误判: { label: "旧伤误判", badgeClass: "error-old-damage" },
  价格超限: { label: "价格超限", badgeClass: "error-price-limit" },
  免责条款漏看: { label: "免责条款漏看", badgeClass: "error-exemption" },
}

const ERROR_TYPE_ORDER: ErrorType[] = ["旧伤误判", "价格超限", "免责条款漏看"]

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString("zh-CN")}`
}

function SeverityBadge({ severity }: { severity: "高" | "中" | "低" }) {
  const colorMap = {
    高: "bg-red-100 text-red-700",
    中: "bg-amber/10 text-amber-dark",
    低: "bg-jade/10 text-jade-dark",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorMap[severity]}`}>
      {severity}
    </span>
  )
}

function RiskLevelBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    高: "bg-red-100 text-red-700",
    中: "bg-amber/10 text-amber-dark",
    低: "bg-jade/10 text-jade-dark",
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${colorMap[level] || "bg-steel-100 text-steel-500"}`}>
      风险等级：{level}
    </span>
  )
}

function ErrorCard({
  errorType,
  impact,
  hasError,
}: {
  errorType: ErrorType
  impact: ErrorImpact | undefined
  hasError: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const config = ERROR_TYPE_CONFIG[errorType]

  return (
    <div className="card">
      <div
        className="card-body flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={config.badgeClass}>{config.label}</span>
          {hasError ? (
            <AlertTriangle className="w-5 h-5 text-amber" />
          ) : (
            <CheckCircle className="w-5 h-5 text-jade" />
          )}
          <span className="text-sm text-cool">
            {hasError ? "检测到错误" : "未检测到错误"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasError && impact && <SeverityBadge severity={impact.severity} />}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-cool" />
          ) : (
            <ChevronDown className="w-4 h-4 text-cool" />
          )}
        </div>
      </div>

      {hasError && impact && expanded && (
        <div className="border-t border-steel-50 px-4 py-3 space-y-2">
          {impact.affectedParts.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-steel-500">影响部位：</span>
              <span className="text-cool">{impact.affectedParts.join("、")}</span>
            </div>
          )}
          {impact.affectedAmounts.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-steel-500">影响金额：</span>
              <span className="text-cool">{impact.affectedAmounts.join("；")}</span>
            </div>
          )}
          {impact.affectedClauses.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-steel-500">相关条款：</span>
              <span className="text-cool">{impact.affectedClauses.join("；")}</span>
            </div>
          )}
          <div className="text-sm">
            <span className="font-medium text-steel-500">原因：</span>
            <span className="text-cool">{impact.reason}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const settlement = useGameStore((s) => s.settlement)
  const errorImpacts = useGameStore((s) => s.errorImpacts)

  const [showAnswer, setShowAnswer] = useState(false)

  if (!settlement) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-cool">尚未生成结算数据</p>
      </div>
    )
  }

  const diff = settlement.payoutDifference
  const diffLabel = diff > 0 ? "多赔" : diff < 0 ? "少赔" : "无差异"
  const diffColor =
    diff > 0 ? "text-red-600" : diff < 0 ? "text-blue-600" : "text-jade"

  const oldDamageImpact = errorImpacts.find((e) => e.errorType === "旧伤误判")
  const priceLimitImpact = errorImpacts.find((e) => e.errorType === "价格超限")
  const exemptionImpact = errorImpacts.find((e) => e.errorType === "免责条款漏看")

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          <span>赔付结算</span>
        </div>
        <div className="card-body space-y-4">
          <div className="text-center">
            <p className="text-sm text-cool mb-1">您的定损赔付</p>
            <p className="text-4xl font-bold font-serif text-steel-500">
              {formatCurrency(settlement.totalPayout)}
            </p>
          </div>

          {showAnswer && (
            <div className="text-center border-t border-steel-50 pt-4">
              <p className="text-sm text-cool mb-1">标准赔付金额</p>
              <p className="text-2xl font-bold font-serif text-jade">
                {formatCurrency(settlement.correctPayout)}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            <div className={`text-lg font-medium ${diffColor}`}>
              {diff !== 0 && (
                <>
                  {diffLabel} {formatCurrency(Math.abs(diff))}
                </>
              )}
              {diff === 0 && "赔付准确"}
            </div>
            <RiskLevelBadge level={settlement.riskLevel} />
          </div>

          {!showAnswer && (
            <div className="text-center">
              <button
                className="btn-outline text-sm"
                onClick={() => setShowAnswer(true)}
              >
                查看标准答案
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="section-title">错误检测结果</h2>
        <div className="space-y-3">
          <ErrorCard
            errorType="旧伤误判"
            impact={oldDamageImpact}
            hasError={settlement.hasOldDamageError}
          />
          <ErrorCard
            errorType="价格超限"
            impact={priceLimitImpact}
            hasError={settlement.hasPriceLimitError}
          />
          <ErrorCard
            errorType="免责条款漏看"
            impact={exemptionImpact}
            hasError={settlement.hasExemptionError}
          />
        </div>
      </div>

      {errorImpacts.length > 0 && (
        <div>
          <h2 className="section-title">影响汇总</h2>
          <div className="card">
            <div className="card-body">
              <div className="space-y-4">
                {ERROR_TYPE_ORDER.map((errorType) => {
                  const impact = errorImpacts.find(
                    (e) => e.errorType === errorType
                  )
                  if (!impact) return null
                  const config = ERROR_TYPE_CONFIG[errorType]
                  return (
                    <div
                      key={errorType}
                      className="border-b border-steel-50 last:border-b-0 pb-4 last:pb-0"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={config.badgeClass}>{config.label}</span>
                        <SeverityBadge severity={impact.severity} />
                      </div>
                      {impact.affectedParts.length > 0 && (
                        <p className="text-sm text-cool">
                          影响部位：{impact.affectedParts.join("、")}
                        </p>
                      )}
                      {impact.affectedAmounts.length > 0 && (
                        <p className="text-sm text-cool">
                          影响金额：{impact.affectedAmounts.join("；")}
                        </p>
                      )}
                      {impact.affectedClauses.length > 0 && (
                        <p className="text-sm text-cool">
                          相关条款：{impact.affectedClauses.join("；")}
                        </p>
                      )}
                      <p className="text-sm text-cool mt-1">
                        {impact.reason}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center pt-2">
        <button
          className="btn-amber flex items-center gap-2"
          onClick={() => navigate(`/case/${id}/replay`)}
        >
          <RotateCcw className="w-4 h-4" />
          查看错因回放
        </button>
        <button
          className="btn-jade flex items-center gap-2"
          onClick={() => navigate(`/case/${id}/report`)}
        >
          <FileText className="w-4 h-4" />
          查看定损报告
        </button>
      </div>
    </div>
  )
}
