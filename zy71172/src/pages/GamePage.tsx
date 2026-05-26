
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/useGameStore';
import { GameScene } from '@/scenes/GameScene';
import { TrashCard } from '@/components/game/TrashCard';
import { DropZone } from '@/components/game/DropZone';
import { GameHUD } from '@/components/game/GameHUD';
import { TargetType, TrashItem } from '@/types';
import { useState } from 'react';

export function GamePage() {
  const { levelId } = useParams<{ levelId: string }>();
  const navigate = useNavigate();
  const {
    initGame,
    startGame,
    dropTrash,
    status,
    trashQueue,
    currentTrashIndex,
    levelConfig,
    setHighlightedBin,
    saveGameRecord,
  } = useGameStore();

  const [activeTrash, setActiveTrash] = useState<TrashItem | null>(null);

  useEffect(() => {
    const id = parseInt(levelId || '1', 10);
    initGame(id);

    return () => {
    };
  }, [levelId, initGame]);

  useEffect(() => {
    if (status === 'idle' && levelConfig) {
      const timer = setTimeout(() => {
        startGame();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [status, levelConfig, startGame]);

  useEffect(() => {
    if (status === 'ended') {
      const recordId = saveGameRecord();
      setTimeout(() => {
        navigate(`/result/${recordId}`);
      }, 1500);
    }
  }, [status, saveGameRecord, navigate]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveTrash(active.data.current?.trash as TrashItem);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTrash(null);
    setHighlightedBin(null);

    if (over) {
      const trashId = active.id as string;
      const target = over.id as TargetType;
      dropTrash(trashId, target);
    }
  };

  const handleDragOver = (event: { over: { id: string | number | null } | null }) => {
    if (event.over) {
      setHighlightedBin(event.over.id as TargetType);
    } else {
      setHighlightedBin(null);
    }
  };

  const currentTrash = trashQueue[currentTrashIndex];
  const hasAppointment = levelConfig?.hasAppointmentMechanic ?? false;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-gradient-to-b from-sky-300 to-sky-100">
      {/* 3D Scene Background */}
      <div className="absolute inset-0">
        <GameScene />
      </div>

      {/* HUD Overlay */}
      <GameHUD />

      {/* Drag and Drop Context */}
      <DndContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        {/* Trash Card Area */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
          <div className="flex items-center justify-center">
            <AnimatePresence mode="wait">
              {currentTrash && status === 'playing' && (
                <TrashCard
                  key={currentTrash.id}
                  trash={currentTrash}
                  isActive={true}
                />
              )}
            </AnimatePresence>
          </div>
          <p className="text-center text-white/80 text-sm mt-4">
            拖拽垃圾卡片到下方投放区域
          </p>
        </div>

        {/* Drop Zones */}
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-20">
          <div className={`grid gap-4 ${hasAppointment ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <DropZone target="recyclable" label="可回收物" />
            <DropZone target="wet" label="湿垃圾" />
            <DropZone target="dry" label="干垃圾" />
            <DropZone target="hazardous" label="有害垃圾" />
            {hasAppointment && (
              <DropZone target="appointment" label="大件预约" />
            )}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTrash && (
            <div className="opacity-80 scale-110">
              <TrashCard trash={activeTrash} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {status === 'ended' && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <h2 className="text-4xl font-bold mb-4">游戏结束</h2>
              <p className="text-xl">正在生成报告...</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GamePage;
