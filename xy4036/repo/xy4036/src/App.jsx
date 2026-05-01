import React, { useState, useEffect, useRef, useCallback } from 'react'
import levelsData from './data/levels'
import { Simulator } from './engine/Simulator'
import { RulesEngine } from './engine/RulesEngine'
import { SaveManager } from './utils/SaveManager'
import { ScoreResult, GradeRating } from './utils/ScoreCalculator'
import { ConflictType, ConflictSeverity } from './engine/RulesEngine'
import { Level } from './models/Level'
import MapCanvas from './components/MapCanvas'
import ControlPanel from './components/ControlPanel'
import ShipPanel from './components/ShipPanel'
import ResourcePanel from './components/ResourcePanel'
import EventLog from './components/EventLog'
import ScorePanel from './components/ScorePanel'
import LevelSelect from './components/LevelSelect'
import './App.css'

const DEFAULT_SCORING_RULES = {
  onTimeBonus: 100,
  delayPenalty: 50,
  conflictPenalty: 200,
  tugUtilizationBonus: 50,
  safetyViolationPenalty: 500
}

function App() {
  const [simulator, setSimulator] = useState(null)
  const [rulesEngine, setRulesEngine] = useState(null)
  const [saveManager, setSaveManager] = useState(new SaveManager())
  
  const [currentLevelId, setCurrentLevelId] = useState(null)
  const levels = levelsData
  
  const [gameTime, setGameTime] = useState(0)
  const [isPaused, setIsPaused] = useState(true)
  const [simulationSpeed, setSimulationSpeed] = useState(1)
  
  const [ships, setShips] = useState([])
  const [tugs, setTugs] = useState([])
  const [berths, setBerths] = useState([])
  const [waitingZones, setWaitingZones] = useState([])
  const [channels, setChannels] = useState([])
  const [currentWeather, setCurrentWeather] = useState(null)
  
  const [events, setEvents] = useState([])
  const [conflicts, setConflicts] = useState([])
  
  const [selectedShipId, setSelectedShipId] = useState(null)
  const [hoveredElement, setHoveredElement] = useState(null)
  
  const [showLevelSelect, setShowLevelSelect] = useState(false)
  const [showScorePanel, setShowScorePanel] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)
  const [gameOver, setGameOver] = useState(false)
  
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  
  const animationRef = useRef(null)
  const lastUpdateRef = useRef(Date.now())
  
  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '--:--'
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const addEvent = useCallback((type, message, time = null) => {
    const newEvent = {
      id: `event_${Date.now()}_${Math.random()}`,
      type,
      message,
      time: time ?? gameTime,
      timestamp: Date.now()
    }
    setEvents(prev => [...prev, newEvent])
  }, [gameTime])

  const initializeLevel = useCallback((levelId) => {
    const levelData = levels.find(l => l.id === levelId)
    if (!levelData) {
      console.error('Level not found:', levelId)
      return
    }
    
    const levelInstance = Level.fromJSON(levelData)
    const newSimulator = new Simulator()
    const newRulesEngine = new RulesEngine(newSimulator)
    
    newSimulator.loadLevel(levelInstance, newRulesEngine)
    newRulesEngine.setSimulator(newSimulator)
    
    setSimulator(newSimulator)
    setRulesEngine(newRulesEngine)
    
    setCurrentLevelId(levelId)
    setGameTime(0)
    setIsPaused(true)
    setSimulationSpeed(1)
    
    const initialEvent = {
      id: `event_${Date.now()}_init`,
      type: 'info',
      message: `开始训练：${levelData.name}`,
      time: 0,
      timestamp: Date.now()
    }
    setEvents([initialEvent])
    setConflicts([])
    setSelectedShipId(null)
    setGameOver(false)
    setScoreResult(null)
    
    saveManager.resetHistory()
    setCanUndo(false)
    setCanRedo(false)
    
    setShips([...newSimulator.ships])
    setTugs([...newSimulator.tugs])
    setBerths([...newSimulator.berths])
    setWaitingZones([...newSimulator.waitingZones])
    setChannels([...newSimulator.channels])
    setCurrentWeather(newSimulator.currentWeather ? { ...newSimulator.currentWeather } : null)
  }, [saveManager])

  const updateStateFromSimulator = useCallback((sim) => {
    if (!sim) return
    
    setGameTime(sim.currentTime)
    setShips([...sim.ships])
    setTugs([...sim.tugs])
    setBerths([...sim.berths])
    setWaitingZones([...sim.waitingZones])
    setChannels([...sim.channels])
    setCurrentWeather(sim.currentWeather ? { ...sim.currentWeather } : null)
  }, [])

  const checkForConflicts = useCallback(() => {
    if (!rulesEngine || !simulator) return []
    
    const newConflicts = rulesEngine.checkAll()
    setConflicts(newConflicts)
    
    return newConflicts
  }, [rulesEngine, simulator])

  const calculateScore = useCallback((sim, conflictList, gameTimeVal) => {
    if (!sim) return null
    
    const allShips = sim.ships || []
    const completedShips = allShips.filter(s => s.status === 'completed')
    
    const onTimeShips = completedShips.filter(s => {
      if (s.isEntry && s.actualArrivalTime && s.deadlineTime) {
        return s.actualArrivalTime <= s.deadlineTime
      }
      if (s.isDeparture && s.actualDepartureTime && s.deadlineTime) {
        return s.actualDepartureTime <= s.deadlineTime
      }
      return true
    })

    const onTimeRate = completedShips.length > 0 ? onTimeShips.length / completedShips.length : 0
    
    const waitingShips = allShips.filter(s => s.waitTime > 0)
    const totalWaitTime = waitingShips.reduce((sum, ship) => sum + (ship.waitTime || 0), 0)
    const averageWaitTime = waitingShips.length > 0 ? totalWaitTime / waitingShips.length : 0
    
    const conflictCount = conflictList.length
    const criticalConflictCount = conflictList.filter(c => c.severity === ConflictSeverity.CRITICAL).length
    
    const tugs = sim.tugs || []
    const usedTugs = tugs.filter(t => t.status !== 'available' || t.assignedShipId)
    const tugUtilizationRate = tugs.length > 0 ? usedTugs.length / tugs.length : 0

    const keyMistakes = []
    const overdueShips = allShips.filter(s => s.deadlineTime && (s.actualArrivalTime > s.deadlineTime || s.actualDepartureTime > s.deadlineTime))
    overdueShips.forEach(ship => {
      keyMistakes.push({
        type: 'overdue',
        severity: 'high',
        message: `船舶 ${ship.name} 已超时`,
        details: { shipId: ship.id }
      })
    })

    let score = 500
    const scoringRules = sim.level?.scoringRules || DEFAULT_SCORING_RULES
    
    const scoreBreakdown = {
      onTime: 0,
      tugUtilization: 0,
      conflictPenalty: 0,
      waitTimePenalty: 0,
      safetyPenalty: 0
    }

    scoreBreakdown.onTime = Math.round(onTimeRate * scoringRules.onTimeBonus * completedShips.length)
    score += scoreBreakdown.onTime

    scoreBreakdown.tugUtilization = Math.round(tugUtilizationRate * scoringRules.tugUtilizationBonus * tugs.length)
    score += scoreBreakdown.tugUtilization

    scoreBreakdown.conflictPenalty = conflictCount * scoringRules.conflictPenalty
    score -= scoreBreakdown.conflictPenalty

    scoreBreakdown.waitTimePenalty = Math.round(averageWaitTime * 0.1)
    score -= scoreBreakdown.waitTimePenalty

    scoreBreakdown.safetyPenalty = criticalConflictCount * scoringRules.safetyViolationPenalty
    score -= scoreBreakdown.safetyPenalty

    score = Math.max(0, Math.min(1000, score))

    let grade = GradeRating.F
    if (criticalConflictCount === 0) {
      if (onTimeRate === 1 && score >= 900) grade = GradeRating.S
      else if (onTimeRate >= 0.8 && score >= 750) grade = GradeRating.A
      else if (onTimeRate >= 0.6 && score >= 600) grade = GradeRating.B
      else if (onTimeRate >= 0.4 && score >= 400) grade = GradeRating.C
      else if (score >= 200) grade = GradeRating.D
    } else if (criticalConflictCount === 1) {
      if (score >= 400) grade = GradeRating.C
      else if (score >= 200) grade = GradeRating.D
    } else if (criticalConflictCount === 2) {
      grade = GradeRating.D
    } else {
      grade = GradeRating.F
    }

    return new ScoreResult({
      totalScore: score,
      maxScore: 1000,
      onTimeRate,
      conflictCount,
      criticalConflictCount,
      tugUtilizationRate,
      averageWaitTime,
      keyMistakes,
      scoreBreakdown,
      grade
    })
  }, [])

  const endGame = useCallback(() => {
    setIsPaused(true)
    setGameOver(true)
    
    if (!simulator) return
    
    const score = calculateScore(simulator, conflicts, gameTime)
    
    setScoreResult(score)
    setShowScorePanel(true)
    
    if (score) {
      addEvent('info', `训练结束！得分：${score.totalScore}，等级：${score.grade}`)
    }
  }, [simulator, calculateScore, conflicts, gameTime, addEvent])

  const gameLoop = useCallback(() => {
    if (!simulator || isPaused || gameOver) {
      animationRef.current = requestAnimationFrame(gameLoop)
      return
    }
    
    const now = Date.now()
    const deltaMs = now - lastUpdateRef.current
    
    if (deltaMs >= 50) {
      const timeStep = simulationSpeed * (deltaMs / 1000) * 2
      
      const previousState = {
        ships: simulator.ships.map(s => ({ ...s })),
        tugs: simulator.tugs.map(t => ({ ...t })),
        currentTime: simulator.currentTime
      }
      
      simulator.tick(timeStep)
      
      const newConflicts = checkForConflicts()
      
      newConflicts.forEach(conflict => {
        if (conflict.severity === ConflictSeverity.CRITICAL) {
          addEvent('error', conflict.message, simulator.currentTime)
        } else if (conflict.severity === ConflictSeverity.WARNING) {
          addEvent('warning', conflict.message, simulator.currentTime)
        }
      })
      
      simulator.ships.forEach(ship => {
        const prevShip = previousState.ships.find(s => s.id === ship.id)
        if (prevShip && prevShip.status !== ship.status) {
          if (ship.status === 'completed') {
            addEvent('success', `${ship.name} 完成作业`, simulator.currentTime)
          } else if (ship.status === 'berthed') {
            addEvent('info', `${ship.name} 已靠泊`, simulator.currentTime)
          }
        }
      })
      
      updateStateFromSimulator(simulator)
      
      const allCompleted = simulator.ships.every(ship => ship.status === 'completed')
      if (allCompleted || simulator.currentTime >= simulator.level.durationMinutes) {
        endGame()
      }
      
      lastUpdateRef.current = now
    }
    
    animationRef.current = requestAnimationFrame(gameLoop)
  }, [simulator, isPaused, gameOver, simulationSpeed, checkForConflicts, addEvent, updateStateFromSimulator, endGame])

  const initializedRef = useRef(false)
  useEffect(() => {
    if (!initializedRef.current && levels.length > 0) {
      initializedRef.current = true
      initializeLevel(levels[0].id)
    }
  }, [initializeLevel])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameLoop])

  useEffect(() => {
    if (saveManager) {
      setCanUndo(saveManager.canUndo())
      setCanRedo(saveManager.canRedo())
    }
  }, [saveManager, events])

  const handleTogglePause = () => {
    setIsPaused(prev => !prev)
  }

  const handleSpeedChange = (speed) => {
    setSimulationSpeed(speed)
  }

  const handleUndo = () => {
    if (!saveManager || !simulator) return
    
    const savedState = saveManager.undo()
    if (savedState && savedState.snapshot) {
      simulator.restoreFromSnapshot(savedState.snapshot)
      updateStateFromSimulator(simulator)
      addEvent('info', '已撤销上一步操作')
    }
  }

  const handleRedo = () => {
    if (!saveManager || !simulator) return
    
    const savedState = saveManager.redo()
    if (savedState && savedState.snapshot) {
      simulator.restoreFromSnapshot(savedState.snapshot)
      updateStateFromSimulator(simulator)
      addEvent('info', '已重做操作')
    }
  }

  const handleSave = () => {
    if (!saveManager || !simulator) return
    
    const saveId = saveManager.saveGameState(simulator, currentLevelId)
    addEvent('success', `游戏已保存，存档ID：${saveId}`)
  }

  const handleLoad = () => {
    if (!saveManager) return
    
    const savedGames = saveManager.getSavedGames()
    if (savedGames.length === 0) {
      addEvent('warning', '没有找到保存的游戏')
      return
    }
    
    const latestSave = savedGames[0]
    if (latestSave.levelId) {
      initializeLevel(latestSave.levelId)
      addEvent('success', `已加载存档：${latestSave.name}`)
    } else {
      addEvent('error', '加载失败：无法读取存档信息')
    }
  }

  const handleRestart = () => {
    if (currentLevelId) {
      initializeLevel(currentLevelId)
      addEvent('info', '游戏已重新开始')
    }
  }

  const handleShowScore = () => {
    if (!simulator) return
    
    const score = calculateScore(simulator, conflicts, gameTime)
    
    setScoreResult(score)
    setShowScorePanel(true)
  }

  const handleExportScoreJSON = () => {
    if (!scoreResult) return
    
    const currentLevel = levels.find(l => l.id === currentLevelId)
    const exportData = {
      timestamp: Date.now(),
      levelId: currentLevelId,
      levelName: currentLevel?.name || 'Unknown',
      difficulty: currentLevel?.difficulty || 'medium',
      score: scoreResult.toJSON(),
      statistics: {
        totalShips: simulator?.ships?.length || 0,
        completedShips: simulator?.ships?.filter(s => s.status === 'completed').length || 0,
        totalTugs: simulator?.tugs?.length || 0
      }
    }
    
    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `score_${currentLevelId || 'unknown'}_${Date.now()}.json`
    a.click()
    
    URL.revokeObjectURL(url)
    addEvent('success', '成绩已导出为JSON')
  }

  const handleSelectLevel = (levelId) => {
    setShowLevelSelect(false)
    initializeLevel(levelId)
  }

  const handleShipSelect = (shipId) => {
    setSelectedShipId(shipId)
  }

  const handleAssignBerth = (shipId, berthId) => {
    if (!simulator || !rulesEngine) return
    
    const ship = simulator.ships.find(s => s.id === shipId)
    const berth = simulator.berths.find(b => b.id === berthId)
    
    if (!ship || !berth) return
    
    const snapshot = simulator.createSnapshot()
    saveManager.recordAction('assign-berth', snapshot, { shipId, berthId })
    
    ship.targetBerthId = berthId
    addEvent('info', `已为 ${ship.name} 分配泊位 ${berth.name}`)
  }

  const handleAssignTugs = (shipId, tugCount) => {
    if (!simulator) return
    
    const ship = simulator.ships.find(s => s.id === shipId)
    if (!ship) return
    
    const availableTugs = simulator.tugs.filter(t => t.status === 'available')
    const tugsToAssign = availableTugs.slice(0, Math.min(tugCount, availableTugs.length))
    
    if (tugsToAssign.length < tugCount) {
      addEvent('warning', `拖轮不足，仅分配 ${tugsToAssign.length} 艘`)
    }
    
    const snapshot = simulator.createSnapshot()
    saveManager.recordAction('assign-tugs', snapshot, { shipId, tugCount })
    
    tugsToAssign.forEach(tug => {
      tug.status = 'assigned'
      tug.assignedShipId = shipId
      if (!ship.assignedTugIds) ship.assignedTugIds = []
      ship.assignedTugIds.push(tug.id)
    })
    
    addEvent('info', `已为 ${ship.name} 分配 ${tugsToAssign.length} 艘拖轮`)
    updateStateFromSimulator(simulator)
  }

  const handleStartShip = (shipId) => {
    if (!simulator || !rulesEngine) return
    
    const ship = simulator.ships.find(s => s.id === shipId)
    if (!ship) return
    
    if (ship.direction === 'inbound' && !ship.targetBerthId) {
      addEvent('warning', `请先为 ${ship.name} 分配泊位`)
      return
    }
    
    const requiredTugs = ship.tugsRequired || 0
    const assignedTugs = ship.assignedTugIds?.length || 0
    if (assignedTugs < requiredTugs) {
      addEvent('warning', `${ship.name} 需要 ${requiredTugs} 艘拖轮，当前仅分配 ${assignedTugs} 艘`)
      return
    }
    
    const snapshot = simulator.createSnapshot()
    saveManager.recordAction('start-ship', snapshot, { shipId })
    
    ship.status = 'moving'
    addEvent('info', `${ship.name} 开始移动`)
  }

  const currentLevel = levels.find(l => l.id === currentLevelId)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">🚢 夜航调度练习台</h1>
          {currentLevel && (
            <div className="level-info">
              <span className="level-name">{currentLevel.name}</span>
              <span className="level-difficulty">{currentLevel.difficulty === 'easy' ? '入门' : currentLevel.difficulty === 'medium' ? '中级' : '困难'}</span>
            </div>
          )}
        </div>
        <div className="header-right">
          <div className="game-time">
            <span className="time-label">模拟时间</span>
            <span className="time-value">{formatTime(gameTime)}</span>
          </div>
          <button 
            className="level-select-btn"
            onClick={() => setShowLevelSelect(true)}
          >
            📂 选择关卡
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="main-left">
          <div className="map-container">
            {simulator && (
              <MapCanvas
                simulator={simulator}
                conflicts={conflicts}
                selectedShipId={selectedShipId}
                onShipSelect={handleShipSelect}
                onHover={setHoveredElement}
                width={800}
                height={600}
              />
            )}
          </div>
          
          <div className="bottom-panel">
            <EventLog 
              events={events} 
              conflicts={conflicts}
            />
          </div>
        </div>

        <div className="main-right">
          <ControlPanel
            isPaused={isPaused}
            simulationSpeed={simulationSpeed}
            gameTime={gameTime}
            canUndo={canUndo}
            canRedo={canRedo}
            onTogglePause={handleTogglePause}
            onSpeedChange={handleSpeedChange}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSave={handleSave}
            onLoad={handleLoad}
            onRestart={handleRestart}
            onShowScore={handleShowScore}
          />
          
          <ShipPanel
            level={simulator?.level}
            currentTime={gameTime}
            selectedShipId={selectedShipId}
            onShipSelect={handleShipSelect}
            onAssignBerth={handleAssignBerth}
            onAssignTugs={handleAssignTugs}
          />
          
          <ResourcePanel
            tugs={tugs}
            berths={berths}
            waitingZones={waitingZones}
            currentWeather={currentWeather}
          />
        </div>
      </main>

      {showLevelSelect && (
        <LevelSelect
          currentLevelId={currentLevelId}
          onSelectLevel={handleSelectLevel}
          onClose={() => setShowLevelSelect(false)}
        />
      )}

      {showScorePanel && (
        <ScorePanel
          scoreResult={scoreResult}
          onClose={() => setShowScorePanel(false)}
          onExportJSON={handleExportScoreJSON}
          onRestart={handleRestart}
          onLoadLevel={() => {
            setShowScorePanel(false)
            setShowLevelSelect(true)
          }}
        />
      )}
    </div>
  )
}

export default App
