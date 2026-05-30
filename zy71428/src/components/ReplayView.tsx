import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { InferenceStep, Suspect } from '../types'

interface ReplayViewProps {
  inferenceHistory: InferenceStep[]
  suspects: Suspect[]
  isCorrectGuess: boolean
  guiltySuspect: Suspect | undefined
  highestSuspect: Suspect | undefined
  onClose: () => void
}

const SUSPECT_COLORS: Record<string, string> = {
  butler: '#e07c24',
  maid: '#8b5cbf',
  master: '#b33951',
  guest: '#2e7d32',
}

export default function ReplayView({
  inferenceHistory,
  suspects,
  isCorrectGuess,
  guiltySuspect,
  highestSuspect,
  onClose,
}: ReplayViewProps) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null)

  const chartData = inferenceHistory.map((step, idx) => {
    const point: Record<string, string | number> = {
      name: `线索${idx + 1}`,
      label: step.clue.title,
    }
    suspects.forEach((s) => {
      point[s.id] = Math.round(step.posteriorProbabilities[s.id] * 1000) / 10
    })
    return point
  })

  const priorData: Record<string, string | number> = { name: '先验', label: '初始概率' }
  suspects.forEach((s) => {
    priorData[s.id] = Math.round(s.priorProbability * 1000) / 10
  })
  chartData.unshift(priorData)



  return (
    <div className="fixed inset-0 z-50 bg-purple-950/98 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl font-bold text-gold">📋 复盘模式</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-800 text-purple-200 rounded-lg hover:bg-purple-700 transition-colors"
          >
            返回 ✕
          </button>
        </div>

        <div className="mb-8 p-6 rounded-xl bg-card-bg border border-card-border">
          <h3 className="font-display font-bold text-lg text-gold mb-4">🎯 结算结果</h3>
          <div className="flex items-center gap-6">
            <div className="text-5xl">{isCorrectGuess ? '🎉' : '❌'}</div>
            <div>
              <p className="text-purple-100 text-lg font-semibold">
                {isCorrectGuess
                  ? '你正确地锁定了最大嫌疑人！'
                  : '嫌疑最高的人并非真凶！'}
              </p>
              <p className="text-purple-300 mt-1">
                真凶是 <span className="text-gold font-bold">{guiltySuspect?.name}</span>
                {guiltySuspect?.avatar}，嫌疑概率 {(guiltySuspect ? guiltySuspect.currentProbability * 100 : 0).toFixed(1)}%
              </p>
              {!isCorrectGuess && (
                <p className="text-purple-400 text-sm mt-1">
                  你锁定的最高嫌疑人是 <span className="text-suspect-high">{highestSuspect?.name}</span>
                  ，嫌疑概率 {(highestSuspect ? highestSuspect.currentProbability * 100 : 0).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-8 p-6 rounded-xl bg-card-bg border border-card-border">
          <h3 className="font-display font-bold text-lg text-gold mb-4">📈 概率变化轨迹</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d2880" />
              <XAxis dataKey="name" stroke="#8b5cbf" tick={{ fontSize: 12 }} />
              <YAxis stroke="#8b5cbf" tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e1245',
                  border: '1px solid #3d2880',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#d4af37' }}
              />
              <Legend />
              {suspects.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={SUSPECT_COLORS[s.id] || '#888'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-6 rounded-xl bg-card-bg border border-card-border">
          <h3 className="font-display font-bold text-lg text-gold mb-4">🕐 推理时间线</h3>
          <div className="space-y-1">
            {inferenceHistory.map((step, idx) => (
              <div key={idx} className="timeline-connector pl-10 relative">
                <div
                  className={`absolute left-[7px] top-3 w-[18px] h-[18px] rounded-full border-2 z-10 flex items-center justify-center text-xs ${
                    selectedStep === idx
                      ? 'border-gold bg-gold/30'
                      : 'border-purple-600 bg-purple-900'
                  }`}
                >
                  <span className="text-gold font-bold" style={{ fontSize: '9px' }}>
                    {idx + 1}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedStep(selectedStep === idx ? null : idx)}
                  className="w-full text-left mb-4"
                >
                  <div className="p-4 rounded-lg border border-card-border bg-surface/50 hover:bg-surface-light/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gold font-mono font-bold text-sm">线索 #{step.stepNumber}</span>
                      <span className="font-display text-purple-100 text-sm font-semibold">
                        {step.clue.title}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        step.clue.type === 'incriminating'
                          ? 'bg-suspect-high/30 text-suspect-high'
                          : step.clue.type === 'exonerating'
                          ? 'bg-suspect-low/30 text-suspect-low'
                          : 'bg-purple-600/30 text-purple-300'
                      }`}>
                        {step.clue.type === 'incriminating' ? '有罪' : step.clue.type === 'exonerating' ? '洗白' : '中性'}
                      </span>
                      {step.isDuplicateEvidence && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-800/50 text-yellow-300">
                          证据关联(不归一)
                        </span>
                      )}
                      {step.isReversedConditional && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-800/50 text-blue-300">
                          条件概率反用
                        </span>
                      )}
                      <span className="text-purple-500 text-xs ml-auto">
                        顺序 #{step.arrivalOrder}
                      </span>
                    </div>

                    <div className="flex gap-3 mt-2 flex-wrap">
                      {suspects.map((s) => {
                        const prior = step.priorProbabilities[s.id]
                        const posterior = step.posteriorProbabilities[s.id]
                        const diff = posterior - prior
                        return (
                          <div key={s.id} className="text-xs">
                            <span className="text-purple-400">{s.avatar}</span>
                            <span className="text-purple-200 ml-1">{(prior * 100).toFixed(1)}%</span>
                            <span className="text-purple-400">→</span>
                            <span className={`font-semibold ${
                              diff > 0.01 ? 'text-suspect-high' : diff < -0.01 ? 'text-suspect-low' : 'text-purple-200'
                            }`}>
                              {(posterior * 100).toFixed(1)}%
                            </span>
                            {Math.abs(diff) > 0.01 && (
                              <span className={`ml-0.5 ${diff > 0 ? 'text-suspect-high' : 'text-suspect-low'}`}>
                                ({diff > 0 ? '+' : ''}{(diff * 100).toFixed(1)}%)
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </button>

                {selectedStep === idx && (
                  <div className="mb-4 p-4 rounded-lg bg-surface/70 border border-card-border space-y-3">
                    <p className="text-purple-200 text-sm">{step.clue.description}</p>

                    <div className="space-y-2">
                      <h4 className="text-purple-100 font-semibold text-sm">计算明细</h4>
                      {step.calculationDetails.map((calc) => (
                        <div key={calc.suspectId} className="bg-purple-900/40 p-3 rounded text-xs">
                          <div className="flex justify-between text-purple-200 mb-1">
                            <span className="font-semibold">{calc.suspectName}</span>
                            <span>
                              先验 {(calc.prior * 100).toFixed(1)}% → 后验 {(calc.posterior * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="font-mono text-purple-400 text-[11px]">{calc.formula}</div>
                          {calc.isPriorSupplement && (
                            <div className="mt-1 text-yellow-400/90 text-[11px]">
                              ⚠️ {calc.priorSupplementNote}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {step.isDuplicateEvidence && step.duplicateNote && (
                      <div className="p-3 rounded bg-yellow-900/30 border border-yellow-800/40 text-yellow-300 text-xs">
                        ⚠️ {step.duplicateNote}
                      </div>
                    )}
                    {step.isReversedConditional && step.reversedConditionalNote && (
                      <div className="p-3 rounded bg-blue-900/30 border border-blue-800/40 text-blue-300 text-xs">
                        🔄 {step.reversedConditionalNote}
                      </div>
                    )}

                    <div className="p-3 rounded bg-purple-900/30 border border-purple-700/30 text-purple-200 text-xs whitespace-pre-line leading-relaxed">
                      💡 {step.explanation}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
