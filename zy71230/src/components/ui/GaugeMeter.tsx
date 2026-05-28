import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GaugeMeterProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { width: 160, height: 90, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-xs' },
  md: { width: 240, height: 130, strokeWidth: 12, fontSize: 'text-4xl', labelSize: 'text-sm' },
  lg: { width: 320, height: 170, strokeWidth: 16, fontSize: 'text-5xl', labelSize: 'text-base' },
};

function getColor(ratio: number): string {
  if (ratio < 0.4) return '#4ade80';
  if (ratio < 0.7) return '#ff9a3c';
  return '#ef4444';
}

function getGlow(ratio: number): string {
  const color = getColor(ratio);
  return `0 0 10px ${color}, 0 0 20px ${color}40`;
}

export default function GaugeMeter({
  value,
  min = 0,
  max = 100,
  label,
  unit = '',
  className,
  size = 'md',
}: GaugeMeterProps) {
  const config = sizeConfig[size];
  const { width, height, strokeWidth, fontSize, labelSize } = config;

  const clampedValue = Math.max(min, Math.min(max, value));
  const ratio = (clampedValue - min) / (max - min);

  const [displayValue, setDisplayValue] = useState(min);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const color = getColor(ratio);

  useEffect(() => {
    const startValue = animatedProgress;
    const controls = animate(startValue, ratio, {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: (latest) => setAnimatedProgress(latest),
    });
    return controls.stop;
  }, [ratio]);

  useEffect(() => {
    const controls = animate(displayValue, clampedValue, {
      duration: 1.5,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return controls.stop;
  }, [clampedValue]);

  const radius = width / 2 - strokeWidth - 4;
  const centerX = width / 2;
  const centerY = height - strokeWidth - 4;

  const createArcPath = (angleRadians: number): string => {
    const startAngle = Math.PI;
    const endAngle = Math.PI + angleRadians;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = angleRadians > Math.PI ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  const needleAngle = Math.PI + animatedProgress * Math.PI;
  const needleLength = radius * 0.85;
  const needleX = centerX + needleLength * Math.cos(needleAngle);
  const needleY = centerY + needleLength * Math.sin(needleAngle);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <filter id={`glow-${label}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <motion.path
            d={createArcPath(Math.PI)}
            fill="none"
            stroke="#2d2d44"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          <motion.path
            d={createArcPath(animatedProgress * Math.PI)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            filter={`url(#glow-${label})`}
            animate={{ d: createArcPath(animatedProgress * Math.PI) }}
            key={animatedProgress}
          />

          <motion.line
            x1={centerX}
            y1={centerY}
            x2={needleX}
            y2={needleY}
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            filter={`url(#glow-${label})`}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              x2: needleX,
              y2: needleY,
            }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />

          <circle
            cx={centerX}
            cy={centerY}
            r={6}
            fill={color}
            filter={`url(#glow-${label})`}
          />

          <text
            x={centerX}
            y={centerY - radius * 0.3}
            textAnchor="middle"
            fill={color}
            className={cn('font-bold', fontSize)}
            style={{ filter: `drop-shadow(${getGlow(ratio)})` }}
          >
            {displayValue}
            {unit && <tspan className="text-sm ml-1">{unit}</tspan>}
          </text>
        </svg>
      </div>

      <div className={cn('text-gray-400 uppercase tracking-wider font-rock mt-1', labelSize)}>
        {label}
      </div>
    </div>
  );
}
