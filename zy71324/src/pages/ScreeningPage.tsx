import { useMemo } from 'react'
import { useMaterialStore } from '@/store/materialStore'
import { useScreeningStore } from '@/store/screeningStore'
import { calculateScore, checkBudgetOverrun } from '@/utils/scoring'
import { validateAllMaterials } from '@/utils/validation'
import { calculateBudgetPerSqm } from '@/utils/budget'
import { FREQUENCY_BANDS, LOW_FREQ_BANDS, MID_FREQ_BANDS, HIGH_FREQ_BANDS } from '@/types'
import AnomalyBanner from '@/components/AnomalyBanner'
import WeightSliders from '@/components/WeightSliders'
import RoomConfigPanel from '@/components/RoomConfigPanel'
import ScoreRanking from '@/components/ScoreRanking'
import CombinationBuilder from '@/components/CombinationBuilder'

export default function ScreeningPage() {
  const { materials } = useMaterialStore()
  const { weightConfig, roomConfig, selectedBreakdown, setSelectedBreakdown } = useScreeningStore()

  const scores = useMemo(
    () => materials.map((m) => calculateScore(m, weightConfig)),
    [materials, weightConfig],
  )

  const issues = useMemo(() => validateAllMaterials(materials), [materials])
  const budgetPerSqm = calculateBudgetPerSqm(roomConfig)
  const budgetIssues = useMemo(
    () => checkBudgetOverrun(materials, issues, budgetPerSqm),
    [materials, issues, budgetPerSqm],
  )
  const allIssues = [...issues, ...budgetIssues]

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#0f1f1a' }}>
      <AnomalyBanner
        issues={allIssues}
        budgetOverrunCount={budgetIssues.length}
      />
      <div className="flex gap-4 mt-4 h-[calc(100vh-6rem)]">
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto">
          <WeightSliders />
          <RoomConfigPanel />
        </div>
        <div className="w-1/3">
          <ScoreRanking
            scores={scores}
            materials={materials}
            issues={allIssues}
            onSelect={setSelectedBreakdown}
          />
        </div>
        <div className="w-1/3">
          {selectedBreakdown ? (
            <div className="rounded-xl p-4 h-full overflow-y-auto" style={{ backgroundColor: '#1a2f2a' }}>
              <h3 className="text-amber-400 text-sm font-semibold mb-3">评分详情 - {selectedBreakdown.materialName}</h3>
              <div className="text-2xl font-bold text-amber-300 mb-3">{selectedBreakdown.totalScore.toFixed(3)}</div>
              <div className="space-y-1.5">
                {FREQUENCY_BANDS.map((freq) => {
                  const band = LOW_FREQ_BANDS.includes(freq) ? '低频' : MID_FREQ_BANDS.includes(freq) ? '中频' : '高频'
                  const raw = selectedBreakdown.rawCoefficients[freq]
                  const w = selectedBreakdown.weightApplied[freq]
                  const v = selectedBreakdown.weightedValues[freq]
                  return (
                    <div key={freq} className="flex items-center gap-2 text-xs">
                      <span className="w-12 text-gray-400">{freq}</span>
                      <span className="w-8 text-gray-500">{band}</span>
                      <span className={`w-10 ${raw === null ? 'text-red-400' : (raw !== null && (raw < 0 || raw > 1)) ? 'text-red-400' : 'text-white'}`}>
                        {raw === null ? '—' : raw.toFixed(2)}
                      </span>
                      <span className="text-gray-600">×</span>
                      <span className="w-10 text-amber-500">{w.toFixed(3)}</span>
                      <span className="text-gray-600">=</span>
                      <span className="text-amber-300">{v.toFixed(4)}</span>
                    </div>
                  )
                })}
              </div>
              {selectedBreakdown.issues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-1">
                  {selectedBreakdown.issues.map((issue, i) => (
                    <div key={i} className={`text-xs ${issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                      {issue.detail}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="mt-4 text-xs text-gray-400 hover:text-amber-400"
              >
                ← 返回组合构建
              </button>
            </div>
          ) : (
            <CombinationBuilder />
          )}
        </div>
      </div>
    </div>
  )
}
