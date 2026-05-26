import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useGameStore } from '../game/state';

export const EventCard: React.FC = () => {
  const { activeEvent, handleEventChoice } = useGameStore();

  if (!activeEvent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="game-card max-w-md w-full overflow-hidden animate-bounce-in">
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
            {activeEvent.choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleEventChoice(index)}
                className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-all duration-200 group"
              >
                <div className="font-medium text-gray-800 group-hover:text-primary-700">
                  {choice.text}
                </div>
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
