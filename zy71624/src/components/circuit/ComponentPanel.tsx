import { motion } from 'framer-motion';
import type { ComponentType, CircuitComponent } from '@/types';
import { CircuitIcon } from './CircuitIcons';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

interface ComponentItemProps {
  type: ComponentType;
  count: number;
  disabled?: boolean;
}

function ComponentItem({ type, count, disabled }: ComponentItemProps) {
  const typeNames: Record<ComponentType, string> = {
    power: '电源',
    switch: '开关',
    bulb: '灯泡',
    resistor: '电阻',
    bar: '吧台',
  };

  const typeColors: Record<ComponentType, string> = {
    power: 'text-neon-orange border-neon-orange/50 hover:border-neon-orange',
    switch: 'text-neon-green border-neon-green/50 hover:border-neon-green',
    bulb: 'text-neon-orange border-neon-orange/50 hover:border-neon-orange',
    resistor: 'text-neon-purple border-neon-purple/50 hover:border-neon-purple',
    bar: 'text-neon-cyan border-neon-cyan/50 hover:border-neon-cyan',
  };

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      className={cn(
        'relative p-3 rounded-lg border-2 bg-neon-card/50',
        'transition-all duration-200 cursor-grab active:cursor-grabbing',
        typeColors[type],
        disabled && 'opacity-40 cursor-not-allowed'
      )}
      draggable={!disabled}
      onDragStart={(e) => {
        if (!disabled && 'dataTransfer' in e) {
          (e as unknown as React.DragEvent<HTMLDivElement>).dataTransfer.setData('componentType', type);
        }
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <CircuitIcon type={type} className="w-8 h-8" />
        <span className="text-xs font-display font-medium">{typeNames[type]}</span>
        <span className="text-xs opacity-60">x{count}</span>
      </div>
      {count === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-neon-bg/80 rounded-lg">
          <span className="text-neon-red text-xs">已用完</span>
        </div>
      )}
    </motion.div>
  );
}

export function ComponentPanel() {
  const availableComponents = useGameStore(state => state.availableComponents);

  const componentCounts = availableComponents.reduce((acc, comp) => {
    acc[comp.type] = (acc[comp.type] || 0) + 1;
    return acc;
  }, {} as Record<ComponentType, number>);

  const componentTypes: ComponentType[] = ['power', 'switch', 'bulb', 'resistor', 'bar'];

  return (
    <div className="glass-card p-4">
      <h3 className="text-neon-purple font-display font-bold text-sm mb-4 text-neon-glow-purple">
        元件库
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {componentTypes.map(type => (
          <ComponentItem
            key={type}
            type={type}
            count={componentCounts[type] || 0}
            disabled={!componentCounts[type]}
          />
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-neon-purple/20">
        <p className="text-xs text-neon-silver/60">
          拖拽元件到画布开始拼接电路
        </p>
      </div>
    </div>
  );
}
