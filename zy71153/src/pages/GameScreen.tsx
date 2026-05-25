import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';
import { TopBar } from '../components/game/TopBar';
import { GameMap } from '../components/game/GameMap';
import { SupplyPanel } from '../components/game/SupplyPanel';
import { VehiclePanel } from '../components/game/VehiclePanel';
import { EventLog } from '../components/game/EventLog';
import { ShelterPanel } from '../components/game/ShelterPanel';

export const GameScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    phase,
    initializeGame,
    startGame,
    gameTick,
    isPaused,
    saveToHistory,
  } = useGameStore();
  
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const levelId = searchParams.get('level');
    if (levelId) {
      initializeGame(levelId);
      hasStartedRef.current = false;
    } else {
      navigate('/');
    }
  }, [searchParams, initializeGame, navigate]);

  useEffect(() => {
    if (phase === 'planning' && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setTimeout(() => startGame(), 500);
    }
  }, [phase, startGame]);

  useEffect(() => {
    if (phase === 'finished') {
      saveToHistory();
      navigate('/result');
    }
  }, [phase, saveToHistory, navigate]);

  useEffect(() => {
    if (phase !== 'executing' || isPaused) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const gameLoop = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      
      const deltaTime = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;

      gameTick(deltaTime);
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [phase, isPaused, gameTick]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <TopBar />
      
      <div className="flex-1 p-4 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-4">
          <div className="col-span-3 flex flex-col gap-4">
            <SupplyPanel />
            <ShelterPanel />
          </div>
          
          <div className="col-span-6 flex flex-col">
            <GameMap width={800} height={500} />
          </div>
          
          <div className="col-span-3 flex flex-col gap-4">
            <VehiclePanel />
            <EventLog />
          </div>
        </div>
      </div>
    </div>
  );
};
