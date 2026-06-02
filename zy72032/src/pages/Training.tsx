import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Pause, Play, Home, AlertTriangle } from "lucide-react"
import { useTrainingStore } from "@/stores/trainingStore"
import { useLevelStore } from "@/stores/levelStore"
import ScenarioCard from "@/components/ScenarioCard"
import OptionButton from "@/components/OptionButton"

export default function Training() {
  const navigate = useNavigate()
  const {
    status,
    currentStepIndex,
    stepStartTime,
    completedRecordId,
    startTraining,
    selectOption,
    togglePause,
    resetTraining,
    getCurrentScenario,
  } = useTrainingStore()
  const { getSelectedLevelPack } = useLevelStore()

  const [timeRemaining, setTimeRemaining] = useState(0)
  const navigatedRef = useRef(false)

  const levelPack = getSelectedLevelPack()
  const scenario = getCurrentScenario()
  const totalSteps = levelPack?.scenarios.length ?? 0

  useEffect(() => {
    if (status === "idle") {
      startTraining()
    }
  }, [status, startTraining])

  useEffect(() => {
    if (
      status === "completed" &&
      completedRecordId &&
      !navigatedRef.current
    ) {
      navigatedRef.current = true
      navigate(`/result/${completedRecordId}`)
    }
  }, [status, completedRecordId, navigate])

  useEffect(() => {
    navigatedRef.current = false
  }, [status])

  useEffect(() => {
    if (status !== "active" || !scenario) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - stepStartTime) / 1000
      const remaining = Math.max(0, scenario.timeLimit - elapsed)
      setTimeRemaining(remaining)

      if (remaining <= 0) {
        const correctOption = scenario.options.find(
          (o) => o.id === scenario.correctOptionId
        )
        if (correctOption) {
          selectOption(
            {
              ...correctOption,
              deduction: {
                points: 5,
                reason: "超时未选择，自动判为超时扣分。下次再快一点哦~",
                type: "操作超时",
              },
            },
            scenario.timeLimit,
            true
          )
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [status, scenario, stepStartTime, selectOption])

  const handleOptionClick = useCallback(
    (option: typeof scenario["options"][0]) => {
      if (status !== "active" || !scenario) return
      const timeTaken = (Date.now() - stepStartTime) / 1000
      selectOption(option, timeTaken, false)
    },
    [status, scenario, stepStartTime, selectOption]
  )

  if (!levelPack || !scenario) {
    return (
      <div className="container py-16 text-center">
        <p className="text-slate-400 mb-4">请先选择一个关卡包</p>
        <button onClick={() => navigate("/")} className="btn btn-primary">
          <Home className="w-4 h-4" />
          返回首页
        </button>
      </div>
    )
  }

  const progress = ((currentStepIndex + 1) / totalSteps) * 100

  return (
    <div className="container py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              resetTraining()
              navigate("/")
            }}
            className="btn btn-outline text-sm"
          >
            <Home className="w-4 h-4" />
            退出训练
          </button>

          {status === "active" && (
            <button
              onClick={() => togglePause("老师暂停讲解")}
              className="btn btn-secondary text-sm"
            >
              <Pause className="w-4 h-4" />
              暂停
            </button>
          )}

          {status === "paused" && (
            <button
              onClick={() => togglePause()}
              className="btn btn-success text-sm"
            >
              <Play className="w-4 h-4" />
              继续训练
            </button>
          )}
        </div>

        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        <ScenarioCard
          scenario={scenario}
          timeRemaining={timeRemaining}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
        />

        {status === "paused" && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="card p-8 text-center max-w-md animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                <Pause className="w-8 h-8 text-warning" />
              </div>
              <h3 className="text-2xl font-bold mb-2">训练已暂停</h3>
              <p className="text-slate-400 mb-6">
                暂停期间计时器停止，继续后从当前进度恢复。
              </p>
              <button
                onClick={() => togglePause()}
                className="btn btn-primary text-lg"
              >
                <Play className="w-5 h-5" />
                继续训练
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span>选择后立即生效，无法更改，请谨慎选择</span>
          </div>
          {scenario.options.map((option, idx) => (
            <OptionButton
              key={option.id}
              option={option}
              disabled={status !== "active"}
              onClick={() => handleOptionClick(option)}
              index={idx}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
