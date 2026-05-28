import React from 'react';
import { useGame } from '../context/GameContext';

export const Header: React.FC = () => {
  const { state } = useGame();

  return (
    <header className="bg-gradient-to-r from-amber-900 to-amber-700 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎵</span>
            <div>
              <h1 className="text-2xl font-bold">黑胶店进货博弈</h1>
              <p className="text-amber-200 text-sm">Vinyl Store Tycoon</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-amber-200 text-xs">第</p>
              <p className="text-2xl font-bold">{state.day}</p>
              <p className="text-amber-200 text-xs">/ {state.maxDays} 天</p>
            </div>
            
            <div className="bg-amber-800 rounded-lg px-4 py-2">
              <p className="text-amber-200 text-xs">现金</p>
              <p className={`text-2xl font-bold ${state.cash < 100 ? 'text-red-300' : 'text-green-300'}`}>
                ¥{state.cash}
              </p>
            </div>
            
            <div className="bg-amber-800 rounded-lg px-4 py-2">
              <p className="text-amber-200 text-xs">库存</p>
              <p className="text-2xl font-bold">
                {state.inventory.reduce((sum, i) => sum + i.quantity, 0)} 张
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-2 bg-amber-950 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(state.day / state.maxDays) * 100}%` }}
          />
        </div>
      </div>
    </header>
  );
};
