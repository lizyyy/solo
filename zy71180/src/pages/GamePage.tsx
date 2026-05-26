import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { RouteNode, Position } from '@/types/game';
import { RoutePlanner } from '@/engine/RoutePlanner';
import GameMap from '@/components/GameMap';
import InfoPanel from '@/components/InfoPanel';
import ControlPanel from '@/components/ControlPanel';
import EventModal from '@/components/EventModal';
import { AlertTriangle } from 'lucide-react';

export default function GamePage() {
  const {
    level,
    restaurants,
    station,
    truck,
    currentTurn,
    score,
    complaints,
    isPaused,
    isAnimating,
    currentEvent,
    plannedRoute,
    routeValidation,
    distanceMultiplier,
    addRouteNode,
    removeRouteNode,
    clearRoute,
    autoPlanRoute,
    checkEvent,
    applyEvent,
    executeTurn,
    pauseGame,
    resumeGame,
    restartGame,
    goToMenu,
    setAnimating,
  } = useGameStore();

  const [hoveredNode, setHoveredNode] = useState<RouteNode | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<ReturnType<typeof checkEvent>>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentEvent) {
      setShowEventModal(true);
    }
  }, [currentEvent]);

  useEffect(() => {
    if (isPaused || isAnimating || showEventModal) return;

    const hasCheckedEventThisTurn = useGameStore.getState().turnHistory.some(
      t => t.turn === currentTurn
    ) || pendingEvent !== null;

    if (!hasCheckedEventThisTurn) {
      const timer = setTimeout(() => {
        const event = checkEvent();
        setPendingEvent(event);
        if (event) {
          setShowEventModal(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, isPaused, isAnimating, showEventModal, checkEvent, pendingEvent]);

  const handleNodeClick = useCallback((node: { type: 'restaurant' | 'station'; id: string; position: Position; name?: string }) => {
    if (isAnimating || isPaused) return;

    const routeNode: RouteNode = {
      type: node.type,
      id: node.id,
      position: node.position,
    };

    addRouteNode(routeNode);
  }, [addRouteNode, isAnimating, isPaused]);

  const handleExecuteTurn = useCallback(async () => {
    if (isAnimating || isPaused || plannedRoute.length === 0) return;

    const validation = routeValidation;
    if (validation && !validation.valid) {
      setErrorMessage(validation.reason || '路线无效');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setAnimating(true);

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const result = executeTurn();
      
      if (!result) {
        setErrorMessage('执行回合失败');
        setTimeout(() => setErrorMessage(null), 3000);
      }
      
      setPendingEvent(null);
    } catch (error) {
      console.error('Execute turn error:', error);
      setErrorMessage(error instanceof Error ? error.message : '执行失败');
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setAnimating(false);
    }
  }, [executeTurn, isAnimating, isPaused, plannedRoute.length, routeValidation, setAnimating]);

  const handleEventConfirm = useCallback(() => {
    if (currentEvent) {
      applyEvent(currentEvent);
    }
    setShowEventModal(false);
    setPendingEvent(null);
  }, [applyEvent, currentEvent]);



  const totalDistance = plannedRoute.length > 0 && truck
    ? RoutePlanner.calculateRouteDistance(
        plannedRoute,
        truck.position,
        (distanceMultiplier - 1) * 100
      )
    : 0;

  const expectedCollection = plannedRoute.length > 0
    ? RoutePlanner.calculateExpectedCollection(plannedRoute, restaurants)
    : {};

  const totalCollection = Object.values(expectedCollection).reduce((sum, val) => sum + val, 0);

  const distanceModifierPercent = Math.round((distanceMultiplier - 1) * 100);

  if (!level || !station || !truck) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  const maxDistance = truck.maxDistancePerTurn;
  const distancePercent = (totalDistance / maxDistance) * 100;
  const isDistanceValid = totalDistance <= maxDistance;

  const capacityPercent = (totalCollection / truck.capacity) * 100;
  const isCapacityValid = totalCollection <= truck.capacity;

  const isValid = routeValidation?.valid ?? plannedRoute.length === 0;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <AnimatePresence>
        {showEventModal && currentEvent && (
          <EventModal event={currentEvent} onConfirm={handleEventConfirm} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="card px-6 py-3 border-danger-500/50 bg-danger-500/20 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
              <span className="text-danger-200 font-medium">{errorMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPaused && !showEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card p-8 text-center"
            >
              <h2 className="text-2xl font-bold mb-4">游戏暂停</h2>
              <p className="text-slate-400 mb-6">点击继续按钮恢复游戏</p>
              <button onClick={resumeGame} className="btn-primary">
                继续游戏
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1800px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-white">{level.name}</h1>
            <p className="text-slate-400 text-sm mt-1">{level.description}</p>
            {level.isBoundaryCase && (
              <p className="text-warning-400 text-xs mt-1">⚠️ 边界案例：{level.boundaryDescription}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {distanceModifierPercent !== 0 && (
              <span className={`text-sm px-3 py-1 rounded-full ${
                distanceModifierPercent > 0 ? 'bg-warning-500/20 text-warning-400' : 'bg-success-500/20 text-success-400'
              }`}>
                距离{distanceModifierPercent > 0 ? '+' : ''}{distanceModifierPercent}%
              </span>
            )}
            <button onClick={goToMenu} className="btn-secondary text-sm">
              返回菜单
            </button>
          </div>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1"
          >
            <div className="card p-4">
              <GameMap
                level={level}
                restaurants={restaurants}
                station={station}
                truck={truck}
                plannedRoute={plannedRoute}
                onNodeClick={handleNodeClick}
                gridSize={level.gridSize}
                isAnimating={isAnimating}
                hoveredNode={hoveredNode}
                onNodeHover={setHoveredNode}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full lg:w-80 space-y-4"
          >
            <InfoPanel
              level={level}
              currentTurn={currentTurn}
              score={score}
              complaints={complaints}
              truck={truck}
              restaurants={restaurants}
            />

            <div className="card p-4 space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">行驶距离</span>
                  <span className={isDistanceValid ? 'text-success-400' : 'text-danger-400'}>
                    {totalDistance} / {maxDistance}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${isDistanceValid ? 'bg-primary-500' : 'bg-danger-500'}`}
                    style={{ width: `${Math.min(distancePercent, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">预计收集</span>
                  <span className={isCapacityValid ? 'text-success-400' : 'text-danger-400'}>
                    {totalCollection} / {truck.capacity}
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${isCapacityValid ? 'bg-success-500' : 'bg-danger-500'}`}
                    style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <ControlPanel
              plannedRoute={plannedRoute}
              routeValidation={routeValidation}
              totalDistance={totalDistance}
              expectedCollection={expectedCollection}
              restaurants={restaurants}
              onRemoveNode={removeRouteNode}
              onClearRoute={clearRoute}
              onAutoPlan={autoPlanRoute}
              onExecuteTurn={handleExecuteTurn}
              onPause={pauseGame}
              onRestart={restartGame}
              onMenu={goToMenu}
              isPaused={isPaused}
              isAnimating={isAnimating}
              isValid={isValid}
              station={station}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
