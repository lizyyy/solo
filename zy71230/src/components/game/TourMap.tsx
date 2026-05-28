import { motion } from 'framer-motion';
import { Disc3, MapPin, Calendar, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Stop } from '@/types/tour';

interface TourMapProps {
  stops: Stop[];
  currentStopIndex: number;
  onStopClick?: (stop: Stop, index: number) => void;
}

export default function TourMap({ stops, currentStopIndex, onStopClick }: TourMapProps) {
  const getStatusColor = (status: Stop['status']) => {
    switch (status) {
      case 'completed':
        return 'text-success-green';
      case 'current':
        return 'text-neon-cyan';
      case 'pending':
        return 'text-rock-light';
      case 'skipped':
        return 'text-rock-gray';
      default:
        return 'text-rock-light';
    }
  };

  const getStatusBg = (status: Stop['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-success-green';
      case 'current':
        return 'bg-neon-cyan';
      case 'pending':
        return 'bg-rock-light';
      case 'skipped':
        return 'bg-rock-gray';
      default:
        return 'bg-rock-light';
    }
  };

  const getStatusBorder = (status: Stop['status']) => {
    switch (status) {
      case 'completed':
        return 'border-success-green shadow-neon-cyan';
      case 'current':
        return 'border-neon-cyan shadow-neon-cyan';
      case 'pending':
        return 'border-rock-light';
      case 'skipped':
        return 'border-rock-gray';
      default:
        return 'border-rock-light';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="w-full p-6 bg-rock-dark/80 backdrop-blur-sm border border-rock-light rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <MapPin className="w-5 h-5 text-neon-pink" />
        <h2 className="text-xl font-rock text-white tracking-wider">巡演路线</h2>
      </div>

      <div className="relative">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="50%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#3d3d5c" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {stops.slice(0, -1).map((_, index) => {
            const isCompleted = index < currentStopIndex;
            const isCurrent = index === currentStopIndex;
            return (
              <line
                key={index}
                x1={`${(index / (stops.length - 1)) * 100}%`}
                y1="50%"
                x2={`${((index + 1) / (stops.length - 1)) * 100}%`}
                y2="50%"
                stroke={isCompleted ? '#4ade80' : isCurrent ? 'url(#lineGradient)' : '#3d3d5c'}
                strokeWidth="3"
                strokeDasharray={isCompleted ? 'none' : '8,8'}
                filter={isCurrent ? 'url(#glow)' : 'none'}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>

        <div className="relative flex justify-between items-center py-8" style={{ zIndex: 1 }}>
          {stops.map((stop, index) => {
            const isCompleted = stop.status === 'completed';
            const isCurrent = stop.status === 'current';
            const isClickable = isCompleted && onStopClick;

            return (
              <motion.div
                key={stop.id}
                className="flex flex-col items-center relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <motion.button
                  onClick={() => isClickable && onStopClick(stop, index)}
                  className={cn(
                    'relative p-3 rounded-full border-2 bg-rock-darker transition-all duration-300',
                    getStatusBorder(stop.status),
                    isClickable && 'cursor-pointer hover:scale-110',
                    !isClickable && 'cursor-default'
                  )}
                  animate={isCurrent ? {
                    boxShadow: [
                      '0 0 5px #00d4ff, 0 0 20px rgba(0, 212, 255, 0.5)',
                      '0 0 15px #00d4ff, 0 0 40px rgba(0, 212, 255, 0.8)',
                      '0 0 5px #00d4ff, 0 0 20px rgba(0, 212, 255, 0.5)',
                    ],
                  } : {}}
                  transition={isCurrent ? {
                    boxShadow: {
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  } : {}}
                >
                  {isCompleted ? (
                    <CheckCircle2 className={cn('w-8 h-8', getStatusColor(stop.status))} />
                  ) : (
                    <Disc3
                      className={cn(
                        'w-8 h-8',
                        getStatusColor(stop.status),
                        isCurrent && 'animate-spin-slow'
                      )}
                    />
                  )}

                  {isCurrent && (
                    <motion.div
                      className="absolute -inset-2 rounded-full border-2 border-neon-cyan"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.8, 0, 0.8],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                </motion.button>

                <div className="absolute -bottom-20 w-32 text-center">
                  <motion.div
                    className={cn(
                      'text-sm font-bold mb-1',
                      getStatusColor(stop.status)
                    )}
                    animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {stop.city}
                  </motion.div>

                  <div className="flex items-center justify-center gap-1 text-xs text-rock-light">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(stop.date)}</span>
                  </div>

                  <div className={cn(
                    'mt-1 text-xs px-2 py-0.5 rounded-full inline-block',
                    getStatusBg(stop.status),
                    'bg-opacity-20',
                    getStatusColor(stop.status)
                  )}>
                    {stop.status === 'completed' ? '已完成' :
                     stop.status === 'current' ? '进行中' :
                     stop.status === 'skipped' ? '已跳过' : '待演出'}
                  </div>
                </div>

                {index < stops.length - 1 && (
                  <ChevronRight className="absolute top-1/2 -right-4 w-4 h-4 text-rock-light transform -translate-y-1/2" />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="h-16" />
      </div>

      <div className="flex items-center justify-center gap-6 mt-8 pt-4 border-t border-rock-light">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success-green" />
          <span className="text-xs text-rock-light">已完成</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neon-cyan animate-pulse" />
          <span className="text-xs text-rock-light">当前站点</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rock-light" />
          <span className="text-xs text-rock-light">待演出</span>
        </div>
      </div>
    </div>
  );
}
