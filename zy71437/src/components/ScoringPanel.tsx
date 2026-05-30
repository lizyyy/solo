import React, { useMemo, useState } from 'react'
import type { GameResult, PhaseConfig, Scenario, RiskItem } from '../../shared/types.js'
import { Car, Users, Bus, AlertTriangle, CheckCircle, Loader2, TrafficCone, Info } from 'lucide-react'

interface Props {
  gameResult: GameResult | null
  phaseConfig: PhaseConfig[]
  scenario: Scenario
  onSubmit: () => void
  submitting: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  phase_conflict: '相位冲突',
  pedestrian_wait: '行人等待过久',
  bus_priority: '公交优先漏算',
}

const LEVEL_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/50', text: 'text-red-400', label: '高风险' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-400', label: '中风险' },
  low: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/50', text: 'text-emerald-400', label: '低风险' },
}

const NO_RISK_STYLE = 'bg-slate-700/50 border-slate-600 text-slate-400'

interface ScoreRingProps {
  score: number
  color: string
  icon: React.ReactNode
  label: string
}

function ScoreRing({ score, color, icon, label }: ScoreRingProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const radius = 40
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#334155"
            strokeWidth={strokeWidth}
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon}
          <span className="text-xl font-bold" style={{ color }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      <span className="text-sm text-slate-400 mt-1">{label}</span>
      {showTooltip && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-slate-100 text-xs px-3 py-1.5 rounded-md whitespace-nowrap z-10 border border-slate-700">
          {label}评分: {Math.round(score)}/100
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
        </div>
      )}
    </div>
  )
}

interface RiskCardProps {
  category: 'phase_conflict' | 'pedestrian_wait' | 'bus_priority'
  risks: RiskItem[]
}

function RiskCard({ category, risks }: RiskCardProps) {
  const hasRisks = risks.length > 0

  const getHighestLevel = (items: RiskItem[]): 'high' | 'medium' | 'low' => {
    if (items.some(r => r.level === 'high')) return 'high'
    if (items.some(r => r.level === 'medium')) return 'medium'
    return 'low'
  }

  const highestLevel = hasRisks ? getHighestLevel(risks) : null
  const levelStyle = highestLevel ? LEVEL_STYLES[highestLevel] : null

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasRisks && levelStyle
          ? `${levelStyle.bg} ${levelStyle.border}`
          : NO_RISK_STYLE
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${hasRisks && levelStyle ? levelStyle.text : 'text-slate-500'}`} />
          <span className={`font-medium ${hasRisks && levelStyle ? levelStyle.text : 'text-slate-400'}`}>
            {CATEGORY_LABELS[category]}
          </span>
        </div>
        {hasRisks && levelStyle && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${levelStyle.bg} ${levelStyle.text} border ${levelStyle.border}`}>
            {levelStyle.label}
          </span>
        )}
      </div>
      {hasRisks ? (
        <div className="space-y-3">
          {risks.map((risk, index) => (
            <div key={index} className="space-y-1">
              <div className="text-sm text-slate-200 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                <span>{risk.description}</span>
              </div>
              <div className="text-xs text-slate-500 pl-6">
                {risk.businessExplanation}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">未检测到风险</span>
        </div>
      )}
    </div>
  )
}

export default function ScoringPanel({ gameResult, phaseConfig, scenario, onSubmit, submitting }: Props) {
  const estimatedScores = useMemo(() => {
    if (gameResult) {
      return {
        vehicle: gameResult.vehicleScore,
        pedestrian: gameResult.pedestrianScore,
        bus: gameResult.busScore,
        total: gameResult.totalScore,
      }
    }

    const phaseConflicts = phaseConfig.filter(phase => {
      const movements = phase.movements
      for (let i = 0; i < movements.length; i++) {
        for (let j = i + 1; j < movements.length; j++) {
          const m1 = movements[i]
          const m2 = movements[j]
          if (m1.approachId !== m2.approachId) {
            const dirs = [m1.approachId, m2.approachId].sort()
            const isOpposite = (dirs[0].includes('north') && dirs[1].includes('south')) ||
                              (dirs[0].includes('east') && dirs[1].includes('west'))
            if (!isOpposite && !m1.pedestrianCrossingId && !m2.pedestrianCrossingId) {
              return true
            }
          }
        }
      }
      return false
    }).length

    const totalCycleLength = phaseConfig.reduce(
      (sum, phase) => sum + phase.greenSeconds + phase.yellowSeconds + phase.redClearanceSeconds,
      0
    )

    const pedestrianWaits = scenario.pedestrianCrossings.map(crossing => {
      let maxGreen = 0
      for (const phase of phaseConfig) {
        const hasPedestrianMovement = phase.movements.some(
          m => m.pedestrianCrossingId === crossing.id
        )
        const hasStraightMovement = phase.movements.some(
          m =>
            m.approachId === crossing.approachId &&
            (m.laneType === 'straight' || m.laneType === 'bus')
        )
        if ((hasPedestrianMovement || hasStraightMovement) && phase.greenSeconds > maxGreen) {
          maxGreen = phase.greenSeconds
        }
      }
      return maxGreen > 0 ? totalCycleLength - maxGreen : totalCycleLength
    })
    const maxPedWait = Math.max(...pedestrianWaits, 0)
    const pedestrianOverTime = Math.max(0, maxPedWait - 90)

    const uncompensatedBusRoutes = scenario.busRoutes.filter(route => {
      const busGreenTime = phaseConfig.reduce((sum, phase) => {
        const hasBus = phase.movements.some(
          m => m.approachId === route.approachId && m.laneType === 'bus'
        )
        return hasBus ? sum + phase.greenSeconds : sum
      }, 0)
      return busGreenTime < 20
    }).length

    const vehicleScore = Math.max(0, 100 - phaseConflicts * 15)
    const pedestrianScore = Math.max(0, 100 - Math.floor(pedestrianOverTime / 10) * 10)
    const busScore = Math.max(0, 100 - uncompensatedBusRoutes * 20)

    return {
      vehicle: vehicleScore,
      pedestrian: pedestrianScore,
      bus: busScore,
      total: vehicleScore + pedestrianScore + busScore,
    }
  }, [gameResult, phaseConfig, scenario])

  const risks = gameResult?.risks || []
  const phaseConflictRisks = risks.filter(r => r.category === 'phase_conflict')
  const pedestrianWaitRisks = risks.filter(r => r.category === 'pedestrian_wait')
  const busPriorityRisks = risks.filter(r => r.category === 'bus_priority')

  const passThreshold = scenario.passThreshold
  const isPassed = estimatedScores.total >= passThreshold

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex justify-around mb-6">
        <ScoreRing
          score={estimatedScores.vehicle}
          color="#22C55E"
          icon={<Car className="w-5 h-5 text-green-500" />}
          label="车流"
        />
        <ScoreRing
          score={estimatedScores.pedestrian}
          color="#F97316"
          icon={<Users className="w-5 h-5 text-orange-500" />}
          label="行人"
        />
        <ScoreRing
          score={estimatedScores.bus}
          color="#3B82F6"
          icon={<Bus className="w-5 h-5 text-blue-500" />}
          label="公交"
        />
      </div>

      <div className="text-center mb-6">
        <div className="text-sm text-slate-400 mb-1">总分</div>
        <div className="text-5xl font-bold text-slate-100 mb-2">
          {Math.round(estimatedScores.total)}
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-slate-400">
            及格线: {passThreshold}/300
          </span>
          {isPassed ? (
            <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              已达标
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              未达标
            </span>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          风险分项说明
        </h3>
        <div className="space-y-3">
          <RiskCard category="phase_conflict" risks={phaseConflictRisks} />
          <RiskCard category="pedestrian_wait" risks={pedestrianWaitRisks} />
          <RiskCard category="bus_priority" risks={busPriorityRisks} />
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            提交中...
          </>
        ) : (
          <>
            <TrafficCone className="w-5 h-5" />
            提交方案
          </>
        )}
      </button>
    </div>
  )
}
