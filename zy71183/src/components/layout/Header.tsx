import { Clock, Trophy, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  levelName: string;
  score: number;
  timeRemaining: number;
  anomalyCount: number;
  formatTime: (seconds: number) => string;
}

export function Header({ levelName, score, timeRemaining, anomalyCount, formatTime }: HeaderProps) {
  const isWarning = timeRemaining <= 30 && timeRemaining > 0;
  const isDanger = timeRemaining <= 10;

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">配电房巡检</h1>
          <span className="px-3 py-1 bg-industrial-blue text-white text-sm rounded-full">
            {levelName}
          </span>
        </div>
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${
              isDanger ? 'text-industrial-red animate-pulse' : 
              isWarning ? 'text-industrial-yellow' : 'text-slate-400'
            }`} />
            <span className={`font-mono text-lg font-bold ${
              isDanger ? 'text-industrial-red' : 
              isWarning ? 'text-industrial-yellow' : 'text-white'
            }`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-industrial-yellow" />
            <span className="font-mono text-lg font-bold text-industrial-yellow">
              {score}
            </span>
          </div>
          
          {anomalyCount > 0 && (
            <div className="flex items-center gap-2 animate-pulse-warning">
              <AlertTriangle className="w-5 h-5 text-industrial-red" />
              <span className="font-mono text-lg font-bold text-industrial-red">
                {anomalyCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
