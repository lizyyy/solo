import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { useGameStore } from '../game/state';

export const EventCard: React.FC = () => {
  const { activeEvent, handleEventChoice, canUseEventChoice } = useGameStore();

  if (!activeEvent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="game-card max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-emergency-500 to-emergency-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">{activeEvent.title}</h2>
              <p className="text-sm opacity-90">突发事件!</p>
            </div>
            <span className="text-4xl ml-auto">{activeEvent.icon}</span>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-6 leading-relaxed">{activeEvent.description}</p>

          <div className="space-y-3">
            {activeEvent.choices.map((choice, index) => {
              const { canUse, missingItems } = canUseEventChoice(index);

              return (
                <button
                  key={index}
                  onClick={() => canUse && handleEventChoice(index)}
                  disabled={!canUse}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    canUse
                      ? 'border-gray-200 hover:border-primary-400 hover:bg-primary-50 cursor-pointer group'
                      : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                  }`}
                >
                  <div className={`font-medium ${canUse ? 'text-gray-800 group-hover:text-primary-700' : 'text-gray-500'}`}>
                    {!canUse && <Lock className="w-4 h-4 inline mr-2" />}
                    {choice.text}
                  </div>
                  {!canUse && missingItems.length > 0 && (
                    <div className="text-xs text-red-500 mt-1">
                      ⚠️ 缺少: {missingItems.join(', ')}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    {choice.effect.health !== undefined && (
                      <span className={choice.effect.health > 0 ? 'text-green-600' : 'text-red-500'}>
                        ❤️ {choice.effect.health > 0 ? '+' : ''}{choice.effect.health}
                      </span>
                    )}
                    {choice.effect.actionPoints !== undefined && (
                      <span className={choice.effect.actionPoints > 0 ? 'text-green-600' : 'text-orange-500'}>
                        ⚡ {choice.effect.actionPoints > 0 ? '+' : ''}{choice.effect.actionPoints}
                      </span>
                    )}
                    {choice.effect.score !== undefined && choice.effect.score !== 0 && (
                      <span className={choice.effect.score > 0 ? 'text-green-600' : 'text-red-500'}>
                        🏆 {choice.effect.score > 0 ? '+' : ''}{choice.effect.score}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
