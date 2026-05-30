import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore.js'
import IntersectionVisualization from '../components/IntersectionVisualization.js'
import PhaseEditor from '../components/PhaseEditor.js'
import FlowPanel from '../components/FlowPanel.js'
import ScoringPanel from '../components/ScoringPanel.js'
import { ArrowLeft, Play, Pause, Loader2 } from 'lucide-react'

export default function Game() {
  const { scenarioId } = useParams<{ scenarioId: string }>()
  const navigate = useNavigate()
  
  const {
    playerName,
    loading,
    error,
    currentScenario,
    currentGameId,
    phaseConfig,
    gameResult,
    submitting,
    fetchScenario,
    startGame,
    updatePhases,
    submitGame,
  } = useGameStore()

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (scenarioId) {
      fetchScenario(scenarioId)
    }
  }, [scenarioId, fetchScenario])

  useEffect(() => {
    if (currentScenario && !currentGameId && scenarioId) {
      startGame(scenarioId)
    }
  }, [currentScenario, currentGameId, scenarioId, startGame])

  useEffect(() => {
    if (gameResult && currentGameId) {
      navigate(`/result/${currentGameId}`, { replace: true })
    }
  }, [gameResult, currentGameId, navigate])

  useEffect(() => {
    if (phaseConfig.length > 0 && !isPaused) {
      intervalRef.current = setInterval(() => {
        setCurrentPhaseIndex((prev) => (prev + 1) % phaseConfig.length)
      }, 3000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [phaseConfig.length, isPaused])

  const handlePhaseSelect = useCallback((index: number) => {
    setCurrentPhaseIndex(index)
    setIsPaused(true)
    
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current)
    }
    
    resumeTimeoutRef.current = setTimeout(() => {
      setIsPaused(false)
    }, 5000)
  }, [])

  const handlePhaseChange = useCallback((newPhases: any[]) => {
    updatePhases(newPhases)
  }, [updatePhases])

  const handleSubmit = useCallback(async () => {
    await submitGame()
  }, [submitGame])

  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current)
      }
    }
  }, [])

  if (!playerName.trim()) {
    return <Navigate to="/" replace />
  }

  if (loading && !currentScenario) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (error || !currentScenario) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 text-white">
        <div className="text-xl text-red-400">{error || '场景未找到'}</div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </button>
      </div>
    )
  }

  const currentPhase = phaseConfig[currentPhaseIndex]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{currentScenario.name}</span>
          </button>
          
          <div className="text-slate-200 font-medium">{playerName}</div>
          
          <button
            onClick={handleSubmit}
            disabled={submitting || loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            提交
          </button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-[40%]">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <IntersectionVisualization
                scenario={currentScenario}
                currentPhaseIndex={currentPhaseIndex}
                phaseConfig={phaseConfig}
              />
              <div className="mt-4 flex items-center justify-center gap-3">
                {isPaused ? (
                  <Pause className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Play className="w-5 h-5 text-emerald-500" />
                )}
                <span className="text-lg font-semibold text-slate-200">
                  {currentPhase?.name || '加载中...'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:w-[35%]">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-full">
              <PhaseEditor
                scenario={currentScenario}
                phaseConfig={phaseConfig}
                onChange={handlePhaseChange}
                currentPhaseIndex={currentPhaseIndex}
                onPhaseSelect={handlePhaseSelect}
              />
            </div>
          </div>

          <div className="lg:w-[25%] flex flex-col gap-4">
            <div>
              <FlowPanel
                scenario={currentScenario}
                phaseConfig={phaseConfig}
              />
            </div>
            <div>
              <ScoringPanel
                gameResult={gameResult}
                phaseConfig={phaseConfig}
                scenario={currentScenario}
                onSubmit={handleSubmit}
                submitting={submitting || loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
