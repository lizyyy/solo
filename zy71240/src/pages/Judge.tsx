import { useState, useMemo } from "react"
import { useGameStore } from "@/store/gameStore"
import { useParams, useNavigate } from "react-router-dom"
import { getPriceForGrade } from "@/engine/rules"
import type { RepairGrade, RiskLevel, PartCard } from "@/types"
import { ClipboardCheck, AlertCircle, DollarSign, Shield, ChevronRight } from "lucide-react"

const REPAIR_GRADES: RepairGrade[] = ["轻微", "中度", "重度", "报废"]
const RISK_LEVELS: { level: RiskLevel; label: string; colorClass: string }[] = [
  { level: "低", label: "低风险", colorClass: "btn-jade" },
  { level: "中", label: "中风险", colorClass: "btn-amber" },
  { level: "高", label: "高风险", colorClass: "bg-red-600 text-white px-5 py-2.5 rounded-md font-medium hover:bg-red-700 transition-colors" },
]

const CLUE_TYPE_ICONS: Record<string, React.ReactNode> = {
  "部位卡": <ClipboardCheck size={16} />,
  "维修价目": <DollarSign size={16} />,
  "保单条款": <Shield size={16} />,
  "客户情绪": <AlertCircle size={16} />,
}

const CLUE_TYPE_ORDER = ["部位卡", "维修价目", "保单条款", "客户情绪"]

export default function Judge() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const selectedClues = useGameStore((s) => s.selectedClues)
  const judgments = useGameStore((s) => s.judgments)
  const riskLevel = useGameStore((s) => s.riskLevel)
  const setJudgment = useGameStore((s) => s.setJudgment)
  const setRiskLevel = useGameStore((s) => s.setRiskLevel)
  const runSettlementPhase = useGameStore((s) => s.runSettlementPhase)

  const [submitting, setSubmitting] = useState(false)

  const cluesByType = useMemo(() => {
    const groups: Record<string, typeof selectedClues> = {}
    for (const clue of selectedClues) {
      if (!groups[clue.type]) groups[clue.type] = []
      groups[clue.type].push(clue)
    }
    return groups
  }, [selectedClues])

  const partClues = useMemo(
    () => selectedClues.filter((c) => c.type === "部位卡"),
    [selectedClues]
  )

  const totalPayout = useMemo(
    () => judgments.reduce((sum, j) => sum + j.estimatedPayout, 0),
    [judgments]
  )

  const canSubmit = judgments.length >= 1 && riskLevel !== null

  const handleGradeSelect = (partName: string, grade: RepairGrade) => {
    setJudgment(partName, grade)
  }

  const handleSubmit = () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    runSettlementPhase()
    navigate(`/case/${id}/settle`)
  }

  const getJudgmentForPart = (partName: string) =>
    judgments.find((j) => j.partName === partName)

  const getEstimatedPayout = (partName: string, grade: RepairGrade) => {
    if (!id) return 0
    return getPriceForGrade(id, partName, grade)
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-6">
      <h1 className="section-title flex items-center gap-2 mb-6">
        <ClipboardCheck size={24} />
        判定阶段
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <ClipboardCheck size={16} />
              已选线索
            </div>
            <div className="card-body space-y-4">
              {selectedClues.length === 0 && (
                <p className="text-cool text-sm">暂无已选线索</p>
              )}
              {CLUE_TYPE_ORDER.filter((t) => cluesByType[t]?.length).map((type) => (
                <div key={type}>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-steel-500 mb-2">
                    {CLUE_TYPE_ICONS[type]}
                    {type}
                  </div>
                  <div className="space-y-2">
                    {cluesByType[type].map((clue) => (
                      <div
                        key={clue.id}
                        className="bg-steel-50 rounded-md p-3 text-sm"
                      >
                        <div className="font-medium text-steel-500">
                          {clue.title}
                        </div>
                        <div className="text-cool mt-1 text-xs leading-relaxed">
                          {clue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <AlertCircle size={16} />
              部位判定
            </div>
            <div className="card-body">
              {partClues.length === 0 && (
                <p className="text-cool text-sm">未选择任何部位卡线索</p>
              )}
              <div className="space-y-4">
                {partClues.map((clue) => {
                  const partData = clue.data as PartCard
                  const currentJudgment = getJudgmentForPart(partData.partName)
                  return (
                    <div
                      key={clue.id}
                      className="border border-steel-50 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-semibold text-steel-500">
                            {partData.partName}
                          </span>
                          {partData.hasOldDamage && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber/10 text-amber-dark">
                              含旧伤
                            </span>
                          )}
                        </div>
                        {currentJudgment && (
                          <span className="text-sm font-semibold text-jade">
                            ¥{currentJudgment.estimatedPayout.toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-cool text-sm mb-3">
                        {partData.damageDescription}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {REPAIR_GRADES.map((grade) => {
                          const isSelected =
                            currentJudgment?.repairGrade === grade
                          const payout = getEstimatedPayout(partData.partName, grade)
                          return (
                            <label
                              key={grade}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer transition-all text-sm ${
                                isSelected
                                  ? "border-jade bg-jade/10 text-jade font-medium"
                                  : "border-steel-100 text-cool hover:border-steel-300"
                              } ${payout === 0 ? "opacity-50" : ""}`}
                            >
                              <input
                                type="radio"
                                name={`grade-${partData.partName}`}
                                value={grade}
                                checked={isSelected}
                                onChange={() => handleGradeSelect(partData.partName, grade)}
                                className="sr-only"
                              />
                              {grade}
                              {payout > 0 && (
                                <span className="text-xs ml-1">
                                  ¥{payout.toLocaleString()}
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Shield size={16} />
              风险判定
            </div>
            <div className="card-body space-y-3">
              <div className="flex gap-2">
                {RISK_LEVELS.map(({ level, label, colorClass }) => (
                  <button
                    key={level}
                    onClick={() => setRiskLevel(level)}
                    className={`${colorClass} flex-1 text-sm ${
                      riskLevel === level ? "ring-2 ring-offset-2 ring-steel-400" : ""
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center gap-2">
              <DollarSign size={16} />
              赔付汇总
            </div>
            <div className="card-body space-y-3">
              <div className="text-center py-3">
                <div className="text-cool text-sm mb-1">预估总赔付</div>
                <div className="text-3xl font-bold text-steel-500">
                  ¥{totalPayout.toLocaleString()}
                </div>
              </div>

              <div className="border-t border-steel-50 pt-3 space-y-2">
                <div className="text-sm font-semibold text-steel-500 mb-1">
                  判定摘要
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cool">已判定部位</span>
                  <span className="font-medium">
                    {judgments.length} / {partClues.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cool">风险等级</span>
                  <span className="font-medium">
                    {riskLevel ?? "未选择"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`btn-primary flex items-center gap-2 text-lg px-8 py-3 ${
            !canSubmit || submitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          提交判定，进入结算
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
