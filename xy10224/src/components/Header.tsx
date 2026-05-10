import React from 'react';
import { useApp } from '../AppContext';

export const Header: React.FC = () => {
  const { state, dispatch } = useApp();

  return (
    <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🏊</div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">游泳馆泳道训练排布器</h1>
              <p className="text-blue-100 text-sm">
                高效管理训练队、散客和私教课的泳道资源
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={state.selectedDate}
              onChange={(e) => dispatch({ type: 'SET_SELECTED_DATE', payload: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white"
            />

            <button
              onClick={() => dispatch({ type: 'LOAD_SMOOTH_SAMPLE' })}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-sm font-medium transition-colors"
            >
              📋 加载顺利样例
            </button>

            <button
              onClick={() => dispatch({ type: 'LOAD_CONFLICT_SAMPLE' })}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-sm font-medium transition-colors"
            >
              ⚠️ 加载冲突样例
            </button>

            <button
              onClick={() => dispatch({ type: 'CLEAR_ALL' })}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
            >
              🗑️ 清空数据
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
