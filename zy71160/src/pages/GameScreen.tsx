import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, RotateCcw, Home } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { CATEGORY_BINS } from '../data/items';
import { WasteCategory, GameItem } from '../types';
import ConveyorBelt from '../components/game/ConveyorBelt';
import WasteItemCard from '../components/game/WasteItemCard';
import TrashBin from '../components/game/TrashBin';
import StatusBar from '../components/game/StatusBar';

const GameScreen: React.FC = () => {
  const navigate = useNavigate();
  const { 
    status, 
    currentLevel, 
    items, 
    spawnedCount,
    startGame,
    pauseGame, 
    resumeGame, 
    resetGame,
    endGame,
    spawnItem,
    updateItems,
    setItemDragging,
    sortItem,
    getResult,
    setHighScore,
    getHighScore,
  } = useGameStore();

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const conveyorRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [conveyorWidth, setConveyorWidth] = useState(800);
  const [draggingItem, setDraggingItem] = useState<GameItem | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [highlightedBin, setHighlightedBin] = useState<WasteCategory | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; x: number; y: number } | null>(null);

  const CONVEYOR_OFFSET_Y = 30;
  const BIN_AREA_HEIGHT = 180;

  useEffect(() => {
    if (!currentLevel) {
      navigate('/');
      return;
    }

    const updateWidth = () => {
      if (conveyorRef.current) {
        setConveyorWidth(conveyorRef.current.offsetWidth - 40);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [currentLevel, navigate]);

  useEffect(() => {
    if (status !== 'playing' || !currentLevel) return;

    spawnTimerRef.current = setInterval(() => {
      if (spawnedCount < currentLevel.itemCount) {
        spawnItem();
      }
    }, currentLevel.spawnRate);

    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
    };
  }, [status, currentLevel, spawnedCount, spawnItem]);

  useEffect(() => {
    if (status !== 'playing') {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const gameLoop = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      updateItems(deltaTime, conveyorWidth);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = 0;
    };
  }, [status, conveyorWidth, updateItems]);

  useEffect(() => {
    if (!currentLevel) return;
    
    const totalProcessed = useGameStore.getState().correctCount + 
                          useGameStore.getState().wrongCount + 
                          useGameStore.getState().missedCount;
    
    if (spawnedCount >= currentLevel.itemCount && 
        items.filter(i => !i.isSorted).length === 0 &&
        totalProcessed >= currentLevel.itemCount) {
      endGame();
      const result = getResult();
      if (result) {
        const currentHighScore = getHighScore(currentLevel.id);
        if (result.score > currentHighScore) {
          setHighScore(currentLevel.id, result.score);
        }
      }
      navigate('/result');
    }
  }, [items, spawnedCount, currentLevel, endGame, getResult, navigate, setHighScore, getHighScore]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, item: GameItem) => {
    if (status !== 'playing') return;
    
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraggingItem(item);
    setDragOffset({
      x: clientX - rect.left - item.x,
      y: clientY - rect.top - CONVEYOR_OFFSET_Y - item.y,
    });
    setItemDragging(item.instanceId, true);
  }, [status, setItemDragging]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!draggingItem || !gameAreaRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    const newX = clientX - rect.left - dragOffset.x;
    const newY = clientY - rect.top - dragOffset.y;

    setItemDragging(draggingItem.instanceId, true, newX, newY);

    const binAreaTop = rect.height - BIN_AREA_HEIGHT;
    if (clientY - rect.top > binAreaTop) {
      const binWidth = rect.width / 4;
      const binIndex = Math.floor((clientX - rect.left) / binWidth);
      if (binIndex >= 0 && binIndex < 4) {
        setHighlightedBin(CATEGORY_BINS[binIndex].category);
      } else {
        setHighlightedBin(null);
      }
    } else {
      setHighlightedBin(null);
    }
  }, [draggingItem, dragOffset, setItemDragging]);

  const handleDragEnd = useCallback(() => {
    if (!draggingItem) return;

    if (highlightedBin) {
      const isCorrect = sortItem(draggingItem.instanceId, highlightedBin);
      setFeedback({
        type: isCorrect ? 'success' : 'error',
        x: draggingItem.x,
        y: draggingItem.y,
      });
      setTimeout(() => setFeedback(null), 500);
    } else {
      setItemDragging(draggingItem.instanceId, false, draggingItem.x, 0);
    }

    setDraggingItem(null);
    setHighlightedBin(null);
  }, [draggingItem, highlightedBin, sortItem, setItemDragging]);

  useEffect(() => {
    if (draggingItem) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [draggingItem, handleDragMove, handleDragEnd]);

  const handlePauseResume = () => {
    if (status === 'playing') {
      pauseGame();
    } else if (status === 'paused') {
      resumeGame();
    }
  };

  const handleRestart = () => {
    if (currentLevel) {
      startGame(currentLevel);
    }
  };

  const handleExit = () => {
    resetGame();
    navigate('/');
  };

  if (!currentLevel) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <StatusBar />
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="text-white">
            <span className="text-2xl font-bold">{currentLevel.name}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePauseResume}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              {status === 'playing' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {status === 'playing' ? '暂停' : '继续'}
            </button>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              重开
            </button>
            <button
              onClick={handleExit}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
              退出
            </button>
          </div>
        </div>

        <div 
          ref={gameAreaRef}
          className="relative bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl shadow-2xl overflow-hidden"
          style={{ height: '500px' }}
        >
          {status === 'paused' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="text-6xl mb-4">⏸️</div>
                <div className="text-4xl font-bold text-white mb-4">游戏暂停</div>
                <button
                  onClick={handlePauseResume}
                  className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl"
                >
                  继续游戏
                </button>
              </div>
            </div>
          )}

          <div ref={conveyorRef} className="p-8 pt-12">
            <ConveyorBelt width={conveyorWidth}>
              {items.map((item) => (
                <WasteItemCard
                  key={item.instanceId}
                  item={item}
                  onDragStart={handleDragStart}
                  conveyorOffsetY={CONVEYOR_OFFSET_Y}
                />
              ))}
            </ConveyorBelt>
          </div>

          {feedback && (
            <div
              className={`absolute text-4xl font-bold pointer-events-none animate-ping z-50 ${
                feedback.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}
              style={{ left: feedback.x + 20, top: feedback.y + 60 }}
            >
              {feedback.type === 'success' ? '✓' : '✗'}
            </div>
          )}

          <div 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent"
            style={{ height: `${BIN_AREA_HEIGHT}px` }}
          >
            <div className="flex justify-around items-end h-full pb-6 px-8">
              {CATEGORY_BINS.map((bin) => (
                <TrashBin
                  key={bin.category}
                  category={bin.category}
                  isHighlighted={highlightedBin === bin.category}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-red-500 rounded-full"></span>
            <span>危险品 - 漏拦重罚</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-yellow-500 rounded-full"></span>
            <span>污染物 - 注意辨别</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🔥</span>
            <span>连击加成更多分数</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
