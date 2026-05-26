
import { useDroppable } from '@dnd-kit/core';
import { TargetType, CATEGORY_COLORS, CATEGORY_NAMES, CATEGORY_EMOJIS } from '@/types';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  target: TargetType;
  label: string;
  children?: React.ReactNode;
}

export function DropZone({ target, label, children }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: target,
  });

  const isAppointment = target === 'appointment';
  const color = isAppointment ? '#FF9800' : CATEGORY_COLORS[target as keyof typeof CATEGORY_COLORS];
  const emoji = isAppointment ? '📅' : CATEGORY_EMOJIS[target as keyof typeof CATEGORY_EMOJIS];
  const name = isAppointment ? '预约点' : CATEGORY_NAMES[target as keyof typeof CATEGORY_NAMES];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200',
        'border-2 border-dashed min-h-[100px]',
        isOver && 'scale-110 shadow-2xl border-solid'
      )}
      style={{
        borderColor: isOver ? color : undefined,
        backgroundColor: isOver ? `${color}20` : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{emoji}</span>
        <span
          className="font-bold text-sm"
          style={{ color }}
        >
          {name}
        </span>
      </div>
      {children}
      {label && (
        <span className="text-xs text-gray-500 mt-1">{label}</span>
      )}
    </div>
  );
}

export default DropZone;
