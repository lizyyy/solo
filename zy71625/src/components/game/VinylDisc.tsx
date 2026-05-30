import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scratch, ScratchSeverity } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { Search, Check, X, AlertTriangle } from 'lucide-react';

interface VinylDiscProps {
  isInteractive?: boolean;
  onScratchClick?: (scratch: Scratch) => void;
}

const severityColors: Record<ScratchSeverity, string> = {
  light: '#F1C40F',
  medium: '#E67E22',
  deep: '#C0392B',
};

export const VinylDisc = ({ isInteractive = true, onScratchClick }: VinylDiscProps) => {
  const { currentRecord, selectedScratchId, status } = useGameStore();
  const [rotation, setRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(true);
  const [hoveredScratch, setHoveredScratch] = useState<string | null>(null);
  const discRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRotating || status !== 'playing') return;

    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, [isRotating, status]);

  const handleScratchClick = (scratch: Scratch, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInteractive) return;
    onScratchClick?.(scratch);
  };

  const getScratchPosition = (scratch: Scratch) => {
    const radius = 140;
    const scratchRadius = (scratch.position / 100) * radius;
    const angleRad = ((scratch.angle + rotation) * Math.PI) / 180;
    const x = 180 + scratchRadius * Math.cos(angleRad);
    const y = 180 + scratchRadius * Math.sin(angleRad);
    const endAngle = angleRad + (scratch.length / 100) * Math.PI;
    const endX = 180 + (scratchRadius + 5) * Math.cos(endAngle);
    const endY = 180 + (scratchRadius + 5) * Math.sin(endAngle);
    return { x, y, endX, endY };
  };

  if (!currentRecord) {
    return (
      <div className="flex items-center justify-center w-[360px] h-[360px] rounded-full bg-[#1a1a1a] border-4 border-[#D4A574]">
        <p className="text-[#D4A574] font-serif">请选择一张黑胶唱片</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="p-2 rounded-full bg-[#2C1810] text-[#D4A574] hover:bg-[#3D2317] transition-colors border border-[#D4A574]/30"
          title={isRotating ? '暂停旋转' : '开始旋转'}
        >
          {isRotating ? '⏸' : '▶'}
        </button>
      </div>

      <div
        ref={discRef}
        className="relative w-[360px] h-[360px] rounded-full cursor-pointer select-none"
        style={{
          background: `
            radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 70%, #000 100%)
          `,
          boxShadow: `
            0 0 60px rgba(0, 0, 0, 0.8),
            inset 0 0 100px rgba(212, 165, 116, 0.05)
          `,
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 360 360"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {[...Array(15)].map((_, i) => (
            <circle
              key={i}
              cx="180"
              cy="180"
              r={30 + i * 10}
              fill="none"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth="1"
            />
          ))}

          <circle cx="180" cy="180" r="80" fill="#1a1a1a" stroke="#D4A574" strokeWidth="2" />
          <circle cx="180" cy="180" r="20" fill="#0a0a0a" stroke="#D4A574" strokeWidth="2" />
          <circle cx="180" cy="180" r="8" fill="#D4A574" />
        </svg>

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 360 360"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {currentRecord.scratches.map((scratch) => {
            const { x, y, endX, endY } = getScratchPosition(scratch);
            const isSelected = selectedScratchId === scratch.id;
            const isHovered = hoveredScratch === scratch.id;
            const color = severityColors[scratch.severity];

            return (
              <g key={scratch.id}>
                <line
                  x1={x}
                  y1={y}
                  x2={endX}
                  y2={endY}
                  stroke={color}
                  strokeWidth={isSelected || isHovered ? 4 : 2}
                  strokeLinecap="round"
                  filter={isSelected || isHovered ? 'url(#glow)' : undefined}
                  className="pointer-events-auto cursor-pointer transition-all duration-200"
                  style={{
                    opacity: scratch.repaired ? 0.3 : 1,
                    animation: isSelected ? 'pulse 1s infinite' : undefined,
                  }}
                  onClick={(e) => handleScratchClick(scratch, e)}
                  onMouseEnter={() => setHoveredScratch(scratch.id)}
                  onMouseLeave={() => setHoveredScratch(null)}
                />
                {isSelected && (
                  <circle
                    cx={(x + endX) / 2}
                    cy={(y + endY) / 2}
                    r="12"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    className="animate-ping"
                  />
                )}
              </g>
            );
          })}
        </svg>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <div className="w-[120px] h-[120px] rounded-full bg-[#2C1810] border-2 border-[#D4A574] flex flex-col items-center justify-center p-3">
            <p className="text-[#D4A574] text-xs font-serif leading-tight truncate w-full">
              {currentRecord.title}
            </p>
            <p className="text-[#D4A574]/60 text-[10px] font-serif mt-1">
              {currentRecord.artist}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {hoveredScratch && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] border border-[#D4A574]/30 rounded-lg p-3 min-w-[200px] z-20"
          >
            {(() => {
              const scratch = currentRecord.scratches.find(s => s.id === hoveredScratch);
              if (!scratch) return null;
              return (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#D4A574] text-sm font-serif">划痕信息</span>
                    {scratch.isFalsePositive && (
                      <span className="flex items-center gap-1 text-xs text-orange-400">
                        <AlertTriangle size={12} />
                        疑似误判
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/70 space-y-1">
                    <p>位置: {scratch.position}% 半径处</p>
                    <p>严重程度:
                      <span style={{ color: severityColors[scratch.severity] }}>
                        {' '}{scratch.severity === 'light' ? '轻微' : scratch.severity === 'medium' ? '中等' : '深度'}
                      </span>
                    </p>
                    <p>状态: {scratch.repaired ? (
                      <span className="text-green-400 flex items-center gap-1"><Check size={12} />已修复</span>
                    ) : scratch.detected ? (
                      <span className="text-yellow-400 flex items-center gap-1"><Search size={12} />已检测</span>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1"><X size={12} />未检测</span>
                    )}</p>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-20 flex flex-wrap gap-2 justify-center">
        {currentRecord.scratches.map((scratch) => (
          <button
            key={scratch.id}
            onClick={() => onScratchClick?.(scratch)}
            className={`px-3 py-1 rounded-full text-xs font-serif transition-all ${
              selectedScratchId === scratch.id
                ? 'bg-[#D4A574] text-[#2C1810]'
                : 'bg-[#2C1810] text-[#D4A574] hover:bg-[#3D2317]'
            } ${scratch.repaired ? 'opacity-50' : ''} border border-[#D4A574]/30`}
          >
            划痕 {scratch.id.slice(-2)}
            {scratch.isFalsePositive && ' ⚠'}
          </button>
        ))}
      </div>
    </div>
  );
};
