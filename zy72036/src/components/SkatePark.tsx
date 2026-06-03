import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Zone, DraggableElement, GameState } from '../types';

interface SkateParkProps {
  zones: Zone[];
  elements: DraggableElement[];
  currentState: GameState;
  onDrop: (element: DraggableElement, zone: Zone) => void;
  onClick: (element: DraggableElement) => void;
  disabled?: boolean;
}

interface SortableElementProps {
  element: DraggableElement;
  onClick: () => void;
}

function SortableElement({ element, onClick }: SortableElementProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="draggable-item flex flex-col items-center justify-center p-3 bg-chalkboard-light rounded-lg border-2 border-chalk/30 cursor-grab active:cursor-grabbing"
      whileHover={{ scale: 1.05, rotate: 3 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-4xl mb-1">{element.emoji}</span>
      <span className="text-xs font-mono text-chalk-muted">{element.label}</span>
      <span className="text-[10px] text-skate-orange">×{element.baseValue}</span>
    </motion.div>
  );
}

interface ZoneDropTargetProps {
  zone: Zone;
  isActive: boolean;
}

function ZoneDropTarget({ zone, isActive }: ZoneDropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: zone.id,
  });

  return (
    <motion.div
      ref={setNodeRef}
      id={zone.id}
      data-zone-id={zone.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`drop-zone absolute flex flex-col items-center justify-center text-white text-center p-2 transition-all duration-300 ${
        isActive || isOver ? 'drop-zone-active' : ''
      }`}
      style={{
        left: zone.x,
        top: zone.y,
        width: zone.width,
        height: zone.height,
        ...zone.style,
      }}
    >
      <div className="font-hand text-lg font-bold drop-shadow-lg">{zone.name}</div>
      <div className="text-[10px] font-mono opacity-80 mt-1">
        {zone.effect.resources ? (
          <span className={zone.effect.resources > 0 ? 'text-green-300' : 'text-red-300'}>
            资源{zone.effect.resources > 0 ? '+' : ''}{zone.effect.resources}{' '}
          </span>
        ) : null}
        {zone.effect.score ? (
          <span className="text-yellow-300">
            分数{zone.effect.score > 0 ? '+' : ''}{zone.effect.score}{' '}
          </span>
        ) : null}
        {zone.effect.risk ? (
          <span className={zone.effect.risk > 0 ? 'text-orange-300' : 'text-green-300'}>
            风险{zone.effect.risk > 0 ? '+' : ''}{zone.effect.risk}
          </span>
        ) : null}
      </div>
      {zone.effect.description && (
        <div className="text-[9px] font-mono opacity-60 mt-1 max-w-full overflow-hidden text-ellipsis">
          {zone.effect.description}
        </div>
      )}
    </motion.div>
  );
}

export function SkatePark({
  zones,
  elements,
  currentState,
  onDrop,
  onClick,
  disabled = false,
}: SkateParkProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overZoneId, setOverZoneId] = useState<string | null>(null);
  const [elementList, setElementList] = useState(elements);
  const parkRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeElement = elementList.find((e) => e.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    if (disabled || currentState.isNegative) return;
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (disabled || currentState.isNegative) return;
    const { over } = event;
    setOverZoneId(over ? (over.id as string) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (disabled || currentState.isNegative) return;
    const { active, over } = event;
    setActiveId(null);
    setOverZoneId(null);

    if (over && over.id.toString().startsWith('zone-')) {
      const element = elementList.find((e) => e.id === active.id);
      const zone = zones.find((z) => z.id === over.id);
      if (element && zone) {
        onDrop(element, zone);
      }
    }

    if (over && over.id.toString().startsWith('elem-')) {
      const oldIndex = elementList.findIndex((e) => e.id === active.id);
      const newIndex = elementList.findIndex((e) => e.id === over.id);
      if (oldIndex !== newIndex) {
        setElementList(arrayMove(elementList, oldIndex, newIndex));
      }
    }
  };

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6">
          <div className="w-48 flex-shrink-0">
            <h3 className="font-hand text-xl text-skate-orange mb-3">🧰 道具区</h3>
            <p className="text-xs text-chalk-muted mb-3 font-mono">
              拖拽到区域 或 点击快速使用
            </p>
            <SortableContext items={elementList.map((e) => e.id)}>
              <div className="grid grid-cols-2 gap-2">
                {elementList.map((element) => (
                  <SortableElement
                    key={element.id}
                    element={element}
                    onClick={() => !disabled && !currentState.isNegative && onClick(element)}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          <div
            ref={parkRef}
            className="flex-1 relative chalkboard-bg rounded-xl border-4 border-chalk/50 overflow-hidden"
            style={{ minHeight: '400px' }}
          >
            <div className="absolute top-2 left-2 font-hand text-2xl text-chalk/70">
              🛹 微积分滑板公园
            </div>
            <div className="absolute top-2 right-2 text-xs font-mono text-chalk-muted">
              提示：拖拽道具到不同区域
            </div>

            {zones.map((zone) => (
              <ZoneDropTarget
                key={zone.id}
                zone={zone}
                isActive={overZoneId === zone.id}
              />
            ))}

            {disabled && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="text-4xl mb-2">⚠️</div>
                  <div className="font-hand text-2xl text-skate-red">
                    请先开始新的对局
                  </div>
                </div>
              </div>
            )}

            {currentState.isNegative && (
              <div className="absolute inset-0 bg-skate-red/20 flex items-center justify-center z-10 backdrop-blur-sm">
                <div className="text-center bg-chalkboard p-6 rounded-xl border-4 border-skate-red warning-flash">
                  <div className="text-5xl mb-3">🚨</div>
                  <div className="font-hand text-3xl text-skate-red mb-2">
                    资源已为负数！
                  </div>
                  <div className="text-sm font-mono text-chalk-muted mb-4">
                    当前资源: {currentState.resources}
                  </div>
                  <div className="text-xs text-chalk-muted">
                    请点击"重置状态"按钮恢复，或结束本局
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeElement ? (
            <motion.div
              className="flex flex-col items-center justify-center p-3 bg-skate-orange/90 rounded-lg border-2 border-white shadow-2xl"
              animate={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <span className="text-5xl mb-1">{activeElement.emoji}</span>
              <span className="text-xs font-mono text-white">{activeElement.label}</span>
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
