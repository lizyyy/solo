import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export function ActionFeedback() {
  const { gameState } = useGameStore();
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastRecord, setLastRecord] = useState<typeof gameState.records[0] | null>(null);

  useEffect(() => {
    if (gameState.records.length > 0) {
      const latest = gameState.records[gameState.records.length - 1];
      if (latest !== lastRecord) {
        setLastRecord(latest);
        setShowFeedback(true);
        const timer = setTimeout(() => setShowFeedback(false), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.records, lastRecord]);

  if (!showFeedback || !lastRecord) return null;

  const isCorrect = lastRecord.isCorrect;
  const isTimeout = lastRecord.playerAction === 'timeout';

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      <div
        className={`px-8 py-4 border-2 transform transition-all duration-300 ${
          isCorrect
            ? 'bg-green-900/90 border-green-500'
            : 'bg-red-900/90 border-red-500'
        }`}
      >
        <div className="flex items-center gap-3">
          {isTimeout ? (
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          ) : isCorrect ? (
            <CheckCircle className="w-8 h-8 text-green-400" />
          ) : (
            <XCircle className="w-8 h-8 text-red-400" />
          )}
          <div>
            <p className="text-xl font-bold font-mono text-white">
              {isTimeout ? '超时！' : isCorrect ? '正确！' : '错误！'}
            </p>
            {!isCorrect && lastRecord.errorReason && (
              <p className="text-sm text-red-300">{lastRecord.errorReason}</p>
            )}
            <p
              className={`text-lg font-mono font-bold ${
                lastRecord.scoreChange >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {lastRecord.scoreChange >= 0 ? '+' : ''}
              {lastRecord.scoreChange}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
