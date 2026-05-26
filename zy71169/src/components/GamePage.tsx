import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import GameScene from './GameScene';
import OrderQueue from './OrderQueue';
import HUD from './HUD';
import ResultReport from './ResultReport';
import { useNavigate, useParams } from 'react-router-dom';

export default function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const dropZonesRef = useRef<Map<string, HTMLElement>>(new Map());
  const dropZoneOverlaysRef = useRef<Map<string, HTMLElement>>(new Map());

  const startGame = useGameStore(state => state.startGame);
  const tick = useGameStore(state => state.tick);
  const phase = useGameStore(state => state.phase);
  const currentSessionId = useGameStore(state => state.currentSessionId);
  const isPaused = useGameStore(state => state.isPaused);
  const draggedOrderId = useGameStore(state => state.draggedMeal);
  const placeMeal = useGameStore(state => state.placeMeal);
  const setDraggedMeal = useGameStore(state => state.setDraggedMeal);

  useEffect(() => {
    if (levelId) {
      startGame(levelId);
    }
  }, [levelId, startGame]);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }

      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (!isPaused && phase === 'playing') {
        tick(deltaTime);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [tick, phase, isPaused]);

  useEffect(() => {
    if (!draggedOrderId) return;

    const updateDropZoneOverlays = () => {
      dropZonesRef.current.forEach((element, stationId) => {
        const rect = element.getBoundingClientRect();
        let overlay = dropZoneOverlaysRef.current.get(stationId);

        if (!overlay) {
          overlay = document.createElement('div');
          overlay.dataset.stationId = stationId;
          overlay.style.position = 'fixed';
          overlay.style.zIndex = '1000';
          overlay.style.border = '3px dashed #F5A623';
          overlay.style.borderRadius = '12px';
          overlay.style.backgroundColor = 'rgba(245, 166, 35, 0.2)';
          overlay.style.transition = 'all 0.2s';
          overlay.style.pointerEvents = 'auto';
          document.body.appendChild(overlay);
          dropZoneOverlaysRef.current.set(stationId, overlay);

          overlay.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            overlay.style.backgroundColor = 'rgba(245, 166, 35, 0.4)';
            overlay.style.transform = 'scale(1.05)';
          });

          overlay.addEventListener('dragleave', () => {
            overlay.style.backgroundColor = 'rgba(245, 166, 35, 0.2)';
            overlay.style.transform = 'scale(1)';
          });

          overlay.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const orderId = e.dataTransfer.getData('orderId');
            if (orderId && stationId) {
              placeMeal(orderId, stationId);
              setDraggedMeal(null);
            }
            overlay.style.backgroundColor = 'rgba(245, 166, 35, 0.2)';
            overlay.style.transform = 'scale(1)';
          });
        }

        overlay.style.left = `${rect.left - 10}px`;
        overlay.style.top = `${rect.top - 10}px`;
        overlay.style.width = `${rect.width + 20}px`;
        overlay.style.height = `${rect.height + 20}px`;
        overlay.style.display = 'block';
      });
    };

    updateDropZoneOverlays();
    const interval = setInterval(updateDropZoneOverlays, 100);

    return () => {
      clearInterval(interval);
      dropZoneOverlaysRef.current.forEach((overlay) => {
        overlay.remove();
      });
      dropZoneOverlaysRef.current.clear();
    };
  }, [draggedOrderId, placeMeal, setDraggedMeal]);

  const handleDragStart = useCallback((e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedMeal(orderId);
  }, [setDraggedMeal]);

  const handleDragEnd = useCallback(() => {
    setDraggedMeal(null);
  }, [setDraggedMeal]);

  useEffect(() => {
    const globalDragEnd = () => setDraggedMeal(null);
    window.addEventListener('dragend', globalDragEnd);
    return () => window.removeEventListener('dragend', globalDragEnd);
  }, [setDraggedMeal]);

  if (phase === 'ended' && currentSessionId) {
    return <ResultReport />;
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gray-900">
      <div className="absolute inset-0">
        <GameScene dropZonesRef={dropZonesRef} />
      </div>

      <OrderQueue
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />

      <HUD />

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex gap-2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
          <span className="text-white text-sm">🎮 拖拽订单到备餐台</span>
          <span className="text-gray-400">|</span>
          <span className="text-white text-sm">📋 待取餐点击发送/确认</span>
          <span className="text-gray-400">|</span>
          <span className="text-white text-sm">空格键暂停</span>
        </div>
      </div>

      {draggedOrderId && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse font-medium">
            🎯 正在拖拽订单 - 放到对应年级备餐台上
          </div>
        </div>
      )}
    </div>
  );
}