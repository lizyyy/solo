import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Check, X, Pause, FileEdit } from "lucide-react"
import { useRecordStore } from "@/stores/recordStore"
import { useLevelStore } from "@/stores/levelStore"
import DeductionItem from "@/components/DeductionItem"
import DiffView from "@/components/DiffView"
import { formatDateTime, formatTime } from "@/utils"
import { cn } from "@/lib/utils"

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRecord } = useRecordStore()

  const record = id ? getRecord(id) : undefined
  const levelPack = record
    ? useLevelStore.getState().levelPacks.find((p) => p.id === record.levelPackId)
    : undefined
  const passingScore = levelPack?.passingScore ?? 70

  if (!record) {
    return (
      <div className="container py-16 text-center">
        <p className="text-slate-400 mb-4">找不到该记录</p>
        <button onClick={() => navigate("/history")} className="btn btn-primary">
          返回记录列表
        </button>
      </div>
    )
  }

  const duration = Math.round((record.endTime - record.startTime) / 1000)
  const totalDeductions = record.steps
    .filter((s) => s.deduction)
    .reduce((sum, s) => sum + (s.deduction?.points ?? 0), 0)

  return (
    <div className="container py-8 space-y-6">
      <button
        onClick={() => navigate("/history")}
        className="btn btn-outline text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        返回记录列表
      </button>

      <div className="card p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">{record.levelPackName}</h1>
              {record.source === "投影补录" && (
                <span className="tag tag-info">
                  <FileEdit className="w-3 h-3 mr-1" />
                  投影补录
                </span>
              )}
              {record.needsManualReview && (
                <span className="tag tag-warning">待人工确认</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <span>开始时间：{formatDateTime(record.startTime)}</span>
              <span>结束时间：{formatDateTime(record.endTime)}</span>
              <span>总用时：{formatTime(duration)}</span>
            </div>
            {record.pauses.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-warning">
                <Pause className="w-4 h-4" />
                <span>
                  本次训练被暂停 {record.pauses.length} 次，暂停原因已记录
                </span>
              </div>
            )}
          </div>

          <div className="text-right">
            <div
              className={cn(
                "text-5xl font-black",
                record.passed ? "text-success" : "text-danger"
              )}
            >
              {record.totalScore}
              <span className="text-2xl text-slate-600">/{record.maxScore}</span>
            </div>
            <div className="mt-2">
              <span
                className={cn(
                  "tag text-base px-3 py-1",
                  record.passed ? "tag-success" : "tag-danger"
                )}
              >
                {record.passed ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    通过
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4 mr-1" />
                    未通过
                  </>
                )}
              </span>
            </div>
            {totalDeductions > 0 && (
              <div className="text-sm text-danger mt-1">
                共扣 {totalDeductions} 分
              </div>
            )}
          </div>
        </div>
      </div>

      {record.failureDiagnosis && (
        <div
          className={`card p-6 border-2 ${
            record.failureDiagnosis.type === "规则未理解"
              ? "bg-danger/10 border-danger/30"
              : "bg-warning/10 border-warning/30"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              {record.failureDiagnosis.type === "规则未理解" ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Pause className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1">
                {record.failureDiagnosis.type === "规则未理解"
                  ? "看起来规则这块还需要再熟悉一下"
                  : "反应速度这块还可以再提一提"}
              </h3>
              <p className="text-slate-300">{record.failureDiagnosis.detail}</p>
            </div>
          </div>
        </div>
      )}

      {record.pauses.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Pause className="w-5 h-5 text-warning" />
            暂停记录
          </h3>
          <div className="space-y-2">
            {record.pauses.map((pause, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <div>
                  <span className="text-slate-200">
                    第 {pause.stepIndex + 1} 步
                  </span>
                  {pause.reason && (
                    <span className="text-slate-400 text-sm ml-2">
                      · {pause.reason}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-sm">
                  {formatDateTime(pause.timestamp)} · 暂停{" "}
                  {formatTime(pause.duration / 1000)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold mb-4">每步选择明细</h2>
        <div className="space-y-4">
          {record.steps.map((step, idx) => (
            <DeductionItem key={idx} step={step} index={idx} />
          ))}
        </div>
      </div>

      {record.supplements.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">
            补录记录与差异对比
          </h2>
          <div className="space-y-4">
            {record.supplements.map((supp, idx) => (
              <DiffView
                key={supp.id}
                supplement={supp}
                fields={
                  idx === record.supplements.length - 1 &&
                  supp.previousScore !== undefined &&
                  supp.newScore !== undefined
                    ? [
                        {
                          name: "通过状态",
                          oldValue:
                            supp.previousScore >= passingScore ? "通过" : "未通过",
                          newValue:
                            supp.newScore >= passingScore ? "通过" : "未通过",
                        },
                      ]
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="card p-6 border border-slate-700/50 bg-slate-800/30">
        <h3 className="font-bold mb-3">📌 关于这条记录</h3>
        <p className="text-sm text-slate-400 prose-like">
          这条记录的所有数据——总分、扣分明细、异常标记——在报告和明细页是完全一致的，不会出现"汇总说通过了但明细显示没过"这种两套说法的情况。
          暂停、边界分数、超时等异常情况也都完整保留，不会在汇总统计里悄悄消失。
        </p>
      </div>
    </div>
  )
}
