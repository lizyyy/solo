import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { Disc, Move, Info, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useDragOperation, DraggableHookResult } from '@/hooks/useDragOperation';
import { useGameStore } from '@/store/useGameStore';
import type { VinylElement, Effect } from '@/types/game';

interface DraggableVinylProps {
  element: VinylElement;
  effect: Effect | null;
  isDragging: boolean;
  disabled: boolean;
  tooltip: string;
}

const DraggableVinyl = ({ element, effect, isDragging, disabled, tooltip }: DraggableVinylProps) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: element.id,
    disabled,
    data: element,
  }) as DraggableHookResult;

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const getEffectColor = (effect: Effect | null): string => {
    if (!effect) return element.color;
    if (effect.resource < 0 && effect.score > 0) return 'from-red-500 to-red-600';
    if (effect.resource > 0 && effect.score < 0) return 'from-green-500 to-green-600';
    if (effect.risk > 10) return 'from-orange-500 to-orange-600';
    if (effect.score > 0) return 'from-blue-500 to-blue-600';
    if (effect.resource > 0) return 'from-purple-500 to-purple-600';
    return element.color;
  };

  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isDragging ? 0.5 : 1, scale: isDragging ? 1.05 : 1 }}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${getEffectColor(effect)} 
        shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center
        transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'}
        border-4 border-vinyl-800`}
    >
      <div className="absolute inset-2 rounded-full bg-vinyl-900/80 flex items-center justify-center">
        <div className="absolute inset-1 rounded-full border-2 border-vinyl-700/50" />
        <div className="absolute w-3 h-3 rounded-full bg-gold-500 shadow-gold" />
      </div>
      <Disc className="absolute w-6 h-6 text-gold-400/30" />

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 z-50 px-3 py-2 bg-vinyl-900 border border-vinyl-600 rounded-lg shadow-xl whitespace-nowrap"
          >
            <div className="text-xs font-medium text-vinyl-100 mb-1">{tooltip}</div>
            {effect && (
              <div className="flex gap-2 text-xs">
                {effect.resource !== 0 && (
                  <span className={effect.resource > 0 ? 'text-green-400' : 'text-red-400'}>
                    {effect.resource > 0 ? '+' : ''}{effect.resource} 资源
                  </span>
                )}
                {effect.score !== 0 && (
                  <span className={effect.score > 0 ? 'text-blue-400' : 'text-red-400'}>
                    {effect.score > 0 ? '+' : ''}{effect.score} 分数
                  </span>
                )}
                {effect.risk !== 0 && (
                  <span className={effect.risk > 0 ? 'text-orange-400' : 'text-green-400'}>
                    {effect.risk > 0 ? '+' : ''}{effect.risk} 风险
                  </span>
                )}
              </div>
            )}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-vinyl-900 border-r border-b border-vinyl-600 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {effect && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
          {effect.score > 0 && <TrendingUp className="w-3 h-3 text-green-400" />}
          {effect.score < 0 && <TrendingDown className="w-3 h-3 text-red-400" />}
          {effect.risk > 10 && <AlertCircle className="w-3 h-3 text-orange-400" />}
        </div>
      )}
    </motion.div>
  );
};

export const DragOperationArea = () => {
  const {
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    getElementEffect,
    canDrag,
    getDragTooltip,
    isPaused,
    currentRound,
    error,
    clearError,
  } = useDragOperation();

  const { currentLevel, lastOperation } = useGameStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStartEvent = useCallback((event: DragStartEvent) => {
    const element = event.active.data.current as VinylElement;
    if (handleDragStart(element)) {
      setActiveId(event.active.id as string);
    }
  }, [handleDragStart]);

  const handleDragEndEvent = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const element = active.data.current as VinylElement;

    const position = {
      x: element.position.x + delta.x,
      y: element.position.y + delta.y,
    };

    setLastPosition(position);
    handleDragEnd(element, position);
    setActiveId(null);
  }, [handleDragEnd]);

  const handleDragCancelEvent = useCallback(() => {
    handleDragCancel();
    setActiveId(null);
  }, [handleDragCancel]);

  const dragElements = currentLevel?.vinylElements.filter(
    el => el.type === 'drag' || el.type === 'both'
  ) || [];

  const activeElement = dragElements.find(el => el.id === activeId);

  const dropZoneStyle = lastPosition
    ? {
        left: `${Math.max(0, Math.min(100, lastPosition.x))}%`,
        top: `${Math.max(0, Math.min(100, lastPosition.y))}%`,
      }
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-vinyl-900/90 backdrop-blur-sm rounded-2xl p-6 shadow-vinyl border border-vinyl-700 h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Move className="w-5 h-5 text-gold-500" />
          <h3 className="text-lg font-bold text-vinyl-100">拖拽操作区</h3>
        </div>
        {!currentRound && (
          <span className="text-xs text-vinyl-500 px-2 py-1 bg-vinyl-800 rounded">
            等待比赛开始
          </span>
        )}
        {isPaused && currentRound && (
          <span className="text-xs text-yellow-500 px-2 py-1 bg-yellow-500/20 rounded">
            已暂停
          </span>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-2 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-2 text-red-300 text-sm"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStartEvent}
        onDragEnd={handleDragEndEvent}
        onDragCancel={handleDragCancelEvent}
      >
        <div className="relative w-full h-64 bg-vinyl-950/50 rounded-xl border-2 border-dashed border-vinyl-700 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, #D4AF37 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
          </div>

          {lastOperation?.type === 'drag' && lastOperation.position && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 1], opacity: [0, 0.5, 0] }}
              transition={{ duration: 0.8 }}
              className="absolute w-8 h-8 rounded-full border-2 border-gold-500"
              style={{
                left: `${lastOperation.position.x}%`,
                top: `${lastOperation.position.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          {lastPosition && (
            <div
              className="absolute w-2 h-2 bg-gold-500 rounded-full opacity-50"
              style={{
                ...dropZoneStyle,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          <div className="absolute inset-0 p-4 flex flex-wrap gap-6 items-center justify-center">
            {dragElements.map((element) => (
              <DraggableVinyl
                key={element.id}
                element={element}
                effect={getElementEffect(element.id)}
                isDragging={activeId === element.id}
                disabled={!canDrag(element)}
                tooltip={getDragTooltip(element)}
              />
            ))}
          </div>

          {dragElements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-vinyl-500">
              <div className="text-center">
                <Disc className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>当前关卡没有可拖拽的黑胶元素</p>
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeId && activeElement && (
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: 1.1, rotate: 5 }}
              className={`w-24 h-24 rounded-full bg-gradient-to-br ${activeElement.color} 
                shadow-2xl cursor-grabbing flex items-center justify-center
                border-4 border-vinyl-800 opacity-90`}
            >
              <div className="absolute inset-2 rounded-full bg-vinyl-900/80 flex items-center justify-center">
                <div className="absolute w-3 h-3 rounded-full bg-gold-500 shadow-gold" />
              </div>
              <Disc className="absolute w-6 h-6 text-gold-400/50" />
            </motion.div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-vinyl-500">
          <Info className="w-4 h-4" />
          <span>拖拽黑胶唱片到目标位置</span>
        </div>
        <div className="text-vinyl-500">
          可用元素: <span className="text-vinyl-300 font-mono">{dragElements.length}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-vinyl-700">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600" />
            <span className="text-vinyl-400">正向分数</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-500 to-green-600" />
            <span className="text-vinyl-400">正向资源</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-500 to-red-600" />
            <span className="text-vinyl-400">高风险高收益</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-500 to-orange-600" />
            <span className="text-vinyl-400">高风险</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-500 to-purple-600" />
            <span className="text-vinyl-400">资源获取</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
