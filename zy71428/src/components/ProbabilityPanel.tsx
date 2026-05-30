import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { InferenceStep, Suspect } from '../types'

interface ProbabilityPanelProps {
  inferenceHistory: InferenceStep[]
  suspects: Suspect[]
  isOpen: boolean
  onToggle: () => void
}

export default function ProbabilityPanel({
  inferenceHistory,
  suspects,
  isOpen,
  onToggle,
}: ProbabilityPanelProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-purple-800/90 text-purple-200 px-2 py-4 rounded-l-lg border border-r-0 border-card-border hover:bg-purple-700 transition-colors writing-vertical text-sm font-semibold"
        style={{ writingMode: 'vertical-rl' }}
      >
        📊 概率详情
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-[480px] z-50 bg-surface/95 backdrop-blur-md border-l border-card-border overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-lg font-bold text-gold">📊 概率详情面板</h2>
                <button
                  onClick={onToggle}
                  className="text-purple-400 hover:text-purple-200 transition-colors text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6 p-4 rounded-lg bg-purple-900/50 border border-card-border">
                <h3 className="font-display font-bold text-purple-100 mb-3">当前嫌疑分布</h3>
                {suspects
                  .slice()
                  .sort((a, b) => b.currentProbability - a.currentProbability)
                  .map((s) => {
                    const pct = Math.round(s.currentProbability * 100)
                    return (
                      <div key={s.id} className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{s.avatar}</span>
                        <span className="text-purple-200 text-xs w-24 truncate">{s.name}</span>
                        <div className="flex-1 h-3 bg-purple-900/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full probability-bar ${
                              pct > 50 ? 'bg-suspect-high' : pct > 25 ? 'bg-suspect-mid' : 'bg-suspect-low'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-purple-100 w-12 text-right">{pct}%</span>
                      </div>
                    )
                  })}
              </div>

              <h3 className="font-display font-bold text-purple-100 mb-3">推理历史</h3>
              {inferenceHistory.length === 0 && (
                <p className="text-purple-400 text-sm">尚未翻开任何线索牌</p>
              )}

              <div className="space-y-3">
                {inferenceHistory.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-card-border overflow-hidden">
                    <button
                      onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
                      className="w-full text-left px-4 py-3 bg-card-bg hover:bg-surface-light transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gold font-mono font-bold text-sm">
                          #{step.stepNumber}
                        </span>
                        <span className="text-purple-100 text-sm font-display">
                          {step.clue.title}
                        </span>
                        {step.isDuplicateEvidence && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-800/50 text-yellow-300">
                            重复
                          </span>
                        )}
                        {step.isReversedConditional && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-800/50 text-blue-300">
                            反用
                          </span>
                        )}
                      </div>
                      <span className="text-purple-400 text-xs">
                        {expandedStep === idx ? '▲' : '▼'}
                      </span>
                    </button>

                    <AnimatePresence>
                      {expandedStep === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 py-3 bg-surface/50 space-y-3">
                            <p className="text-purple-300 text-xs">{step.clue.description}</p>

                            <div className="space-y-2">
                              {step.calculationDetails.map((calc) => (
                                <div key={calc.suspectId} className="text-xs">
                                  <div className="flex items-center justify-between text-purple-200 mb-1">
                                    <span>{calc.suspectName}</span>
                                    <span>
                                      {(calc.prior * 100).toFixed(1)}% → {(calc.posterior * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="text-purple-400 font-mono text-[10px] leading-relaxed bg-purple-900/40 p-2 rounded">
                                    {calc.formula}
                                    {calc.isPriorSupplement && (
                                      <div className="mt-1 text-yellow-400/80">
                                        ⚠️ {calc.priorSupplementNote}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {step.isDuplicateEvidence && step.duplicateNote && (
                              <div className="p-2 rounded bg-yellow-900/30 border border-yellow-800/40 text-yellow-300 text-xs">
                                {step.duplicateNote}
                              </div>
                            )}

                            {step.isReversedConditional && step.reversedConditionalNote && (
                              <div className="p-2 rounded bg-blue-900/30 border border-blue-800/40 text-blue-300 text-xs">
                                {step.reversedConditionalNote}
                              </div>
                            )}

                            <div className="p-2 rounded bg-purple-900/30 border border-purple-700/30 text-purple-200 text-xs whitespace-pre-line leading-relaxed">
                              {step.explanation}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
