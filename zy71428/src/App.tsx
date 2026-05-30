import { useState } from 'react'
import './index.css'
import ControlBar from './components/ControlBar'
import SuspectCard from './components/SuspectCard'
import ClueCard from './components/ClueCard'
import ProbabilityPanel from './components/ProbabilityPanel'
import ReplayView from './components/ReplayView'
import { useGameState } from './hooks/useGameState'

function App() {
  const {
    state,
    startGame,
    pauseGame,
    resumeGame,
    drawClue,
    endGame,
    resetGame,
    toggleReplay,
    getGuiltySuspect,
    getHighestSuspect,
    isCorrectGuess,
  } = useGameState()

  const [panelOpen, setPanelOpen] = useState(false)

  const lastExplanation =
    state.inferenceHistory.length > 0
      ? state.inferenceHistory[state.inferenceHistory.length - 1].explanation
      : null

  const lastClue =
    state.drawnClues.length > 0
      ? state.drawnClues[state.drawnClues.length - 1]
      : null

  const highestSuspect = getHighestSuspect()

  if (state.isReplayMode && state.status === 'ended') {
    return (
      <ReplayView
        inferenceHistory={state.inferenceHistory}
        suspects={state.suspects}
        isCorrectGuess={isCorrectGuess()}
        guiltySuspect={getGuiltySuspect()}
        highestSuspect={highestSuspect}
        onClose={toggleReplay}
      />
    )
  }

  return (
    <div className="min-h-screen noise-bg">
      <ControlBar
        status={state.status}
        clueDeckSize={state.clueDeck.length}
        onStart={startGame}
        onPause={pauseGame}
        onResume={resumeGame}
        onEnd={endGame}
        onReset={resetGame}
        onDrawClue={drawClue}
      />

      {state.status === 'idle' && <IdleScreen />}

      {(state.status === 'playing' || state.status === 'paused') && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {state.status === 'paused' && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-900/30 border border-yellow-700/40 text-yellow-300 text-sm text-center">
              ⏸ 游戏已暂停 — 点击"继续"恢复翻牌
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="font-display text-lg font-bold text-purple-200 mb-4 flex items-center gap-2">
                🕵️ 嫌疑人
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {state.suspects.map((suspect) => (
                  <SuspectCard
                    key={suspect.id}
                    suspect={suspect}
                    isRevealed={false}
                    isHighest={highestSuspect?.id === suspect.id}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-purple-200 mb-4 flex items-center gap-2">
                🃏 线索牌
              </h2>
              <ClueCard
                clue={lastClue}
                deckSize={state.clueDeck.length}
                onDraw={drawClue}
                isPaused={state.status === 'paused'}
                lastExplanation={lastExplanation}
              />

              {state.inferenceHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-display text-sm font-bold text-purple-300 mb-3">
                    📜 已翻线索
                  </h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {state.inferenceHistory.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded bg-surface/50 border border-card-border text-xs"
                      >
                        <span className="text-gold font-bold">#{step.stepNumber}</span>
                        <span className="text-purple-200 flex-1 truncate">{step.clue.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          step.clue.type === 'incriminating'
                            ? 'bg-suspect-high/30 text-suspect-high'
                            : step.clue.type === 'exonerating'
                            ? 'bg-suspect-low/30 text-suspect-low'
                            : 'bg-purple-600/30 text-purple-300'
                        }`}>
                          {step.clue.type === 'incriminating' ? '有罪' : step.clue.type === 'exonerating' ? '洗白' : '中性'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {state.status === 'ended' && (
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{isCorrectGuess() ? '🎉' : '🔍'}</div>
            <h2 className="font-display text-3xl font-bold text-gold mb-2">案件结案</h2>
            <p className="text-purple-200 text-lg">
              {isCorrectGuess()
                ? '你准确地判断了真凶！贝叶斯推理帮助你在证据中找到了真相。'
                : '这一次贝叶斯推理没有指向真凶，但复盘可以帮助你理解推理过程。'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {state.suspects.map((suspect) => (
              <SuspectCard
                key={suspect.id}
                suspect={suspect}
                isRevealed={state.revealGuilty}
                isHighest={highestSuspect?.id === suspect.id}
              />
            ))}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={toggleReplay}
              className="px-6 py-3 bg-purple-700 text-white font-bold rounded-lg hover:bg-purple-600 transition-all duration-200 active:scale-95"
            >
              📋 查看复盘
            </button>
            <button
              onClick={resetGame}
              className="px-6 py-3 bg-gold text-purple-950 font-bold rounded-lg hover:bg-gold-light transition-all duration-200 active:scale-95"
            >
              🔄 重新开始
            </button>
          </div>
        </div>
      )}

      {state.status !== 'idle' && (
        <ProbabilityPanel
          inferenceHistory={state.inferenceHistory}
          suspects={state.suspects}
          isOpen={panelOpen}
          onToggle={() => setPanelOpen(!panelOpen)}
        />
      )}
    </div>
  )
}

function IdleScreen() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
      <div className="text-center max-w-xl px-6">
        <div className="text-7xl mb-6">🕵️</div>
        <h1 className="font-display text-4xl font-bold text-gold mb-4 tracking-wide">
          贝叶斯侦探牌
        </h1>
        <p className="text-purple-200 text-lg mb-2 leading-relaxed">
          一起密室谋杀案，四位嫌疑人，谁是真凶？
        </p>
        <p className="text-purple-300 text-sm mb-8 leading-relaxed">
          翻开线索卡牌，用贝叶斯定理更新嫌疑概率。<br />
          每条线索都会改变你对嫌疑人的判断——<br />
          观察先验如何被证据更新为后验，体验贝叶斯推理的力量。
        </p>

        <div className="grid grid-cols-2 gap-3 text-left mb-8 text-xs text-purple-300 max-w-sm mx-auto">
          <div className="p-3 rounded-lg bg-card-bg border border-card-border">
            <span className="text-suspect-high">🔴</span> 有罪线索 — 增加某人嫌疑
          </div>
          <div className="p-3 rounded-lg bg-card-bg border border-card-border">
            <span className="text-suspect-low">🟢</span> 洗白线索 — 降低某人嫌疑
          </div>
          <div className="p-3 rounded-lg bg-card-bg border border-card-border">
            <span className="text-purple-400">🟣</span> 中性线索 — 不同人不同影响
          </div>
          <div className="p-3 rounded-lg bg-card-bg border border-card-border">
            <span className="text-yellow-400">⚠️</span> 证据关联时概率不归一
          </div>
        </div>

        <p className="text-purple-400 text-xs italic">
          点击上方"🎬 开始游戏"开启你的侦探之旅
        </p>
      </div>
    </div>
  )
}

export default App
