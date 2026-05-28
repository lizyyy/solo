import { motion } from 'framer-motion';

interface GaugeMeterProps {
  value: number;
  max: number;
  label: string;
  color: string;
  reverse?: boolean;
}

export function GaugeMeter({ value, max, label, color, reverse = false }: GaugeMeterProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const displayPercentage = reverse ? 100 - percentage : percentage;

  const radius = 60;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  const getStatusColor = () => {
    if (reverse) {
      if (percentage <= 30) return '#4A7C59';
      if (percentage <= 60) return '#B5651D';
      return '#8B0000';
    } else {
      if (percentage >= 70) return '#4A7C59';
      if (percentage >= 40) return '#B5651D';
      return '#8B0000';
    }
  };

  const statusColor = getStatusColor();

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16">
        <svg viewBox="0 0 140 70" className="w-full h-full">
          <defs>
            <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={statusColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <path
            d="M 10 60 A 60 60 0 0 1 130 60"
            className="gauge-track"
          />
          <motion.path
            d="M 10 60 A 60 60 0 0 1 130 60"
            className="gauge-progress"
            stroke={`url(#gradient-${label})`}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <text
            x="70"
            y="50"
            textAnchor="middle"
            className="fill-museum-paper font-bold text-xl"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {Math.round(value)}%
          </text>
        </svg>
      </div>
      <span className="text-sm text-museum-paper/80 mt-1 font-medium">{label}</span>
    </div>
  );
}
