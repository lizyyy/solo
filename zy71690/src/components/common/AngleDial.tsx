import React, { useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface AngleDialProps {
  angle: number;
  onChange: (angle: number) => void;
  disabled?: boolean;
  size?: number;
  className?: string;
}

export const AngleDial: React.FC<AngleDialProps> = ({
  angle,
  onChange,
  disabled = false,
  size = 120,
  className,
}) => {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dialRef.current) return;

      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;

      let newAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      newAngle = Math.round(newAngle);

      onChange(newAngle);
    },
    [isDragging, onChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleMouseMove(e.nativeEvent);
  };

  const radians = (angle * Math.PI) / 180;
  const arrowLength = (size * 0.8) / 2;
  const center = size / 2;
  const arrowX = center + Math.cos(radians) * arrowLength;
  const arrowY = center + Math.sin(radians) * arrowLength;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div
        ref={dialRef}
        className={cn(
          'relative rounded-full border-2 border-gray-700 bg-gray-900/50',
          'select-none transition-all duration-150',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair hover:border-green-600'
        )}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-0 rounded-full border border-gray-800" />

        {[0, 45, 90, 135, 180, -135, -90, -45].map((a) => {
          const r = (a * Math.PI) / 180;
          const x1 = center + Math.cos(r) * (size / 2 - 8);
          const y1 = center + Math.sin(r) * (size / 2 - 8);
          const x2 = center + Math.cos(r) * (size / 2 - 4);
          const y2 = center + Math.sin(r) * (size / 2 - 4);
          return (
            <svg
              key={a}
              className="absolute inset-0 pointer-events-none"
              width={size}
              height={size}
            >
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#4b5563" strokeWidth="2" />
            </svg>
          );
        })}

        <svg className="absolute inset-0 pointer-events-none" width={size} height={size}>
          <line
            x1={center}
            y1={center}
            x2={arrowX}
            y2={arrowY}
            stroke="#00ff88"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0, 255, 136, 0.5))' }}
          />
          <circle cx={center} cy={center} r="4" fill="#00ff88" />
          <circle
            cx={arrowX}
            cy={arrowY}
            r="6"
            fill="#00ff88"
            style={{ filter: 'drop-shadow(0 0 6px rgba(0, 255, 136, 0.8))' }}
          />
        </svg>

        <div
          className="absolute w-2 h-2 bg-green-500 rounded-full"
          style={{
            left: center - 4,
            top: center - 4,
            boxShadow: '0 0 8px rgba(0, 255, 136, 0.8)',
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono">角度</span>
        <input
          type="number"
          value={angle}
          min={-180}
          max={180}
          step={1}
          onChange={(e) => onChange(Math.round(parseFloat(e.target.value) || 0))}
          disabled={disabled}
          className={cn(
            'w-16 px-2 py-1 text-center text-sm font-mono bg-gray-800 border border-gray-700 rounded',
            'focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        <span className="text-xs text-gray-500">°</span>
      </div>
    </div>
  );
};
