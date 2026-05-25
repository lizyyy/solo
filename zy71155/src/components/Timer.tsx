import { Clock } from 'lucide-react';

interface TimerProps {
  timeElapsed: number;
  timeLimit?: number;
}

export const Timer = ({ timeElapsed, timeLimit = 0 }: TimerProps) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const isOvertime = timeLimit > 0 && timeElapsed > timeLimit;
  const isWarning = timeLimit > 0 && timeElapsed > timeLimit * 0.8 && !isOvertime;
  
  return (
    <div className={`
      flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold
      ${isOvertime ? 'bg-red-100 text-red-600 animate-pulse' : ''}
      ${isWarning ? 'bg-orange-100 text-orange-600' : ''}
      ${!isOvertime && !isWarning ? 'bg-gray-100 text-gray-700' : ''}
    `}>
      <Clock size={20} />
      <span>{formatTime(timeElapsed)}</span>
      {timeLimit > 0 && (
        <span className="text-sm font-normal">/ {formatTime(timeLimit)}</span>
      )}
    </div>
  );
};
