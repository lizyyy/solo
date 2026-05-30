import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Clue } from '../types'

interface ClueCardProps {
  clue: Clue | null
  deckSize: number
  onDraw: () => void
  isPaused: boolean
  lastExplanation: string | null
}

export default function ClueCard({ clue, deckSize, onDraw, isPaused, lastExplanation }: ClueCardProps) {
  const [isFlipping, setIsFlipping] = useState(false)
  const [showExplanation, setShowExplanation] = useState(false)

  const handleDraw = () => {
    if (isPaused || deckSize === 0 || isFlipping) return
    setIsFlipping(true)
    setShowExplanation(false)
    onDraw()
    setTimeout(() => setIsFlipping(false), 600)
  }

  const typeBadge: Record<string, { label: string; color: string }> = {
    incriminating: { label: '有罪线索', color: 'bg-suspect-high/80 text-white' },
    exonerating: { label: '洗白线索', color: 'bg-suspect-low/80 text-white' },
    neutral: { label: '中性线索', color: 'bg-purple-600/80 text-white' },
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        <div className="flip-card w-52 h-72 cursor-pointer" onClick={handleDraw}>
          <div className={`flip-card-inner w-full h-full relative ${clue ? 'flipped' : ''}`}>
            <div className="flip-card-front absolute inset-0 rounded-xl border-2 border-gold/30 bg-gradient-to-br from-purple-800 to-purple-950 flex flex-col items-center justify-center gap-4 shadow-lg shadow-purple-900/50">
              <span className="text-5xl">🃏</span>
              <span className="text-purple-200 font-display font-bold text-lg">线索牌</span>
              <span className="text-purple-400 text-sm">点击翻牌</span>
              <span className="text-purple-500 text-xs">剩余 {deckSize} 张</span>
            </div>

            <div className="flip-card-back absolute inset-0 rounded-xl border-2 border-gold/50 bg-gradient-to-br from-card-bg to-purple-900 p-4 flex flex-col shadow-lg shadow-purple-900/50">
              {clue && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeBadge[clue.type]?.color}`}>
                      {typeBadge[clue.type]?.label}
                    </span>
                    <span className="text-gold text-xs">第 {deckSize > 0 ? '+' : '0'} 张</span>
                  </div>
                  <h4 className="font-display font-bold text-gold text-base mb-2">
                    {clue.title}
                  </h4>
                  <p className="text-purple-200 text-xs leading-relaxed flex-1 overflow-y-auto">
                    {clue.description}
                  </p>
                  {clue.consistencyNote && (
                    <div className="mt-2 p-2 rounded bg-purple-900/50 border border-purple-700/50">
                      <span className="text-purple-300 text-xs">📌 {clue.consistencyNote}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {deckSize > 0 && !clue && (
          <div className="relative">
            {[2, 1].map((offset) => (
              <div
                key={offset}
                className="w-52 h-72 rounded-xl border-2 border-gold/10 bg-gradient-to-br from-purple-800/60 to-purple-950/60 absolute"
                style={{
                  top: offset * 4,
                  left: offset * 4,
                  zIndex: -offset,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {!isPaused && deckSize > 0 && (
        <button
          onClick={handleDraw}
          disabled={isFlipping}
          className="px-6 py-2.5 bg-gold text-purple-950 font-bold rounded-lg hover:bg-gold-light transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          🃏 翻开线索
        </button>
      )}

      <AnimatePresence>
        {lastExplanation && clue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-lg"
          >
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="w-full text-left px-4 py-2 bg-surface-light/80 rounded-lg border border-card-border text-sm text-purple-200 hover:bg-surface-light transition-colors"
            >
              💡 概率更新解释 {showExplanation ? '▲' : '▼'}
            </button>
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 p-4 bg-surface/90 rounded-lg border border-card-border text-xs text-purple-200 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto"
                >
                  {lastExplanation}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
