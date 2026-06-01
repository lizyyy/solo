import { useParams, useNavigate } from "react-router-dom"
import {
  Trophy, RotateCcw, History, Check, X } from "lucide-react"
import { useRecordStore } from "@/stores/recordStore"
import { useLevelStore } from "@/stores/levelStore"
import DeductionItem from "@/components/DeductionItem"
import FailureDiagnosis from "@/components/FailureDiagnosis"
import { formatTime } from "@/utils"
import { cn } from "@/lib/utils"

export default function Result() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getRecord } = useRecordStore()
  const { getSelectedLevelPack } = useLevelStore()

  const record = id ? getRecord(id) : undefined
  const levelPack = record
    ? useLevelStore.getState().levelPacks.find((p) => p.id === record.levelPackId)
    : undefined

  if (!record || !levelPack) {
    return (
      <div className="container py-16 text-center">
        <p className="text-slate-400 mb-4">找不到该记录</p>
        <button onClick={() => navigate("/")} className="btn btn-primary">
          返回首页
        </button>
      </div>
    )
  }

  const duration = Math.round((record.endTime - record.startTime) / 1000)
  const totalDeductions = record.steps
    .filter((s) => s.deduction)
    .reduce((sum, s) => sum + (s.deduction?.points ?? 0), 0)

  const isPerfect = totalDeductions === 0
  const isPassed = record.passed

  return (
    <div className="container py-8 space-y-6">
      <div className="text-center py-6 animate-fade-in">
        <div
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6",
            isPassed ? "bg-success/20" : "bg-danger/20"
          )}
        >
          {isPassed ? (
            <Trophy className="w-12 h-12 text-success" />
          ) : (
            <X className="w-12 h-12 text-danger" />
          )}
        </div>

        <h1 className="text-3xl font-black mb-2">
          {isPassed
            ? isPerfect
              ? "完美通关！"
              : "顺利通过！"
            : "差一点点，再来一局？"}
        </h1>
        <p className="text-slate-400">
          {record.levelPackName} · 用时 {formatTime(duration)}
        </p>
      </div>

      <div className="card p-8 text-center animate-slide-up">
        <div className="text-6xl font-black mb-2">
          <span className={isPassed ? "text-success" : "text-danger"}>
            {record.totalScore}
          </span>
          <span className="text-3xl text-slate-600">
            /{record.maxScore}
          </span>
        </div>
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div
              className={cn(
              "tag",
              isPassed ? "tag-success" : "tag-danger"
            )}
            >
              {isPassed ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  通过
                </>
              ) : (
                <>
                  <X className="w-3 h-3 mr-1" />
                  未通过
                </>
              )}
            </div>
          </div>
          <div className="text-slate-400">
            及格线 {levelPack.passingScore} 分
          </div>
          {totalDeductions > 0 && (
            <div className="text-danger">共扣 {totalDeductions} 分</div>
          )}
        </div>
      </div>

      {record.failureDiagnosis && (
        <FailureDiagnosis
          type={record.failureDiagnosis.type}
          detail={record.failureDiagnosis.detail}
        />
      )}

      <div>
        <h2 className="text-xl font-bold mb-4">
          选择回顾
          <span className="text-sm font-normal text-slate-400 ml-2">
            共 {record.steps.length} 题
          </span>
        </h2>
        <div className="space-y-4">
          {record.steps.map((step, idx) => (
            <DeductionItem key={idx} step={step} index={idx} />
          ))}
        </div>
      </div>

      {record.pauses.length > 0 && (
        <div className="card p-6 border-warning/30">
          <h3 className="font-bold mb-3 text-warning">
            ⏸️ 暂停记录 ({record.pauses.length} 次
          </h3>
          <div className="space-y-2">
            {record.pauses.map((pause, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <span className="text-slate-300">
                第 {pause.stepIndex + 1} 步
                {pause.reason && ` · ${pause.reason}`}
              </span>
              <span className="text-slate-400">
                暂停 {formatTime(pause.duration / 1000)}
              </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.supplements.length > 0 && (
        <div className="card p-6 border-brand-400/30 bg-brand-400/5">
        <h3 className="font-bold mb-3 text-brand-300">
          📝 补录备注
        </h3>
        <div className="space-y-3">
          {record.supplements.map((supp) => (
          <div key={supp.id} className="p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <span className="tag tag-info">{supp.source}</span>
              <span className="text-xs text-slate-400">
                {new Date(supp.timestamp).toLocaleString("zh-CN")}
              </span>
            </div>
            <p className="text-sm text-slate-300">{supp.content}</p>
            {supp.previousScore !== undefined && supp.newScore !== undefined && (
              <p className="text-sm text-warning mt-2">
              分数调整：{supp.previousScore} → {supp.newScore}
            </p>
            )}
          </div>
        ))}
        </div>
      </div>
      )}

      <div className="flex flex-wrap gap-3 justify-center pt-4">
        <button
          onClick={() => navigate("/training")}
          className="btn btn-primary"
        >
          <RotateCcw className="w-4 h-4" />
          再来一局
        </button>
        <button
          onClick={() => navigate("/history")}
          className="btn btn-secondary"
        >
          <History className="w-4 h-4" />
          查看所有记录
        </button>
        <button onClick={() => navigate("/")} className="btn btn-outline">
          返回首页
        </button>
      </div>
    </div>
  )
}
