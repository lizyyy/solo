import React from 'react';

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  warningThreshold?: number;
  criticalThreshold?: number;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max,
  label,
  unit = '%',
  warningThreshold = 0.03,
  criticalThreshold = 0.05,
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage / 100) * 180 - 90;
  
  let color = '#10B981';
  if (value > criticalThreshold) {
    color = '#EF4444';
  } else if (value > warningThreshold) {
    color = '#F59E0B';
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full border-8 border-gray-200" 
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
        <div 
          className="absolute bottom-0 left-0 w-32 h-32 rounded-full border-8 transition-all duration-500"
          style={{ 
            borderColor: color,
            clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center bottom',
          }} 
        />
        <div 
          className="absolute bottom-0 left-1/2 w-1 h-12 bg-gray-700 rounded transition-transform duration-500"
          style={{ 
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            transformOrigin: 'bottom center',
          }} 
        />
        <div className="absolute bottom-0 left-1/2 w-3 h-3 bg-gray-700 rounded-full transform -translate-x-1/2 translate-y-1/2" />
      </div>
      <div className="mt-2 text-center">
        <div className="text-2xl font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
          {(value * 100).toFixed(2)}{unit}
        </div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
};
