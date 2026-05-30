import { useGameStore } from '../store/gameStore';
import { getEventEmoji, getRateChangeDisplay } from '../logic/events';
import { Zap, ArrowRight } from 'lucide-react';

export function EventCard() {
  const { events, currentRound, status, nextRound, totalRounds } = useGameStore();
  
  const currentEvent = events.find(e => e.round === currentRound);
  const isLastRound = currentRound >= totalRounds;

  if (status !== 'playing') {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-200">
      <h2 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
        <Zap className="text-purple-500" size={20} />
        本回合事件
      </h2>

      {currentEvent ? (
        <div className={`rounded-xl p-4 mb-4 ${
          currentEvent.direction === 'up' ? 'bg-red-50 border-2 border-red-200' :
          currentEvent.direction === 'down' ? 'bg-green-50 border-2 border-green-200' :
          'bg-gray-50 border-2 border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{getEventEmoji(currentEvent.direction)}</span>
            <div>
              <div className={`text-2xl font-bold ${
                currentEvent.direction === 'up' ? 'text-red-600' :
                currentEvent.direction === 'down' ? 'text-green-600' :
                'text-gray-600'
              }`}>
                {getRateChangeDisplay(currentEvent.rateChange)}
              </div>
              <div className="text-sm text-gray-600">利率变化</div>
            </div>
          </div>
          <p className="text-gray-700">{currentEvent.description}</p>
          <p className="text-xs text-gray-500 mt-2">来源: {currentEvent.source}</p>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-xl p-4 mb-4 text-center text-gray-500">
          等待事件公布...
        </div>
      )}

      <div className="bg-blue-50 rounded-xl p-3 mb-4">
        <p className="text-sm text-blue-700">
          💡 <strong>教学提示：</strong>利率上升 → 债券价格下跌；利率下降 → 债券价格上涨。这是因为债券的未来现金流需要用新的利率折现。
        </p>
      </div>

      <button
        onClick={nextRound}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
      >
        <ArrowRight size={20} />
        {isLastRound ? '结束并结算' : '下一回合'}
      </button>
    </div>
  );
}
