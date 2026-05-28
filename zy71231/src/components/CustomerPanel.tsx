import React from 'react';
import { useGame } from '../context/GameContext';
import type { CustomerPreference } from '../types/game';

interface CustomerPanelProps {
  onShowDetail: (type: string, item: any) => void;
}

export const CustomerPanel: React.FC<CustomerPanelProps> = ({ onShowDetail }) => {
  const { state } = useGame();

  const todayVisitors = state.dailyReports.length > 0
    ? state.dailyReports[state.dailyReports.length - 1].customerVisits
    : [];

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">👥 顾客档案</h2>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {state.customerPreferences.map((customer: CustomerPreference) => {
          const isVisited = todayVisitors.includes(customer.id);
          
          return (
            <div
              key={customer.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                isVisited ? 'border-green-300 bg-green-50' : 'border-gray-200'
              }`}
              onClick={() => onShowDetail('customer', customer)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{customer.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-800">{customer.name}</h3>
                    {isVisited && (
                      <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">
                        今日到访
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {customer.favoriteGenres.map(genre => (
                      <span
                        key={genre}
                        className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    预算: ¥{customer.budget} · 出价意愿: {(customer.willingnessToPay * 100).toFixed(0)}%
                  </p>
                </div>
                <span className="text-gray-400">→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
