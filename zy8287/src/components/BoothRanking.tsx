import React from 'react';
import type { BoothRankingData } from '../types';
import { formatCurrency, formatPercent } from '../utils/exportUtils';
import { useDashboard } from '../context/DashboardContext';

interface BoothRankingProps {
  data: BoothRankingData[];
  title: string;
  sortBy: 'revenue' | 'visitors' | 'conversionRate';
}

const BoothRanking: React.FC<BoothRankingProps> = ({ data, title, sortBy }) => {
  const { selectBooth, clearSelections, selectedBoothId } = useDashboard();

  if (data.length === 0) {
    return (
      <div className="card h-full">
        <div className="card-header">{title}</div>
        <div className="card-body flex items-center justify-center h-48 text-gray-400">
          暂无数据
        </div>
      </div>
    );
  }

  const getValue = (item: BoothRankingData): number => {
    switch (sortBy) {
      case 'revenue':
        return item.revenue;
      case 'visitors':
        return item.visitors;
      case 'conversionRate':
        return item.conversionRate;
      default:
        return item.revenue;
    }
  };

  const formatValue = (value: number): string => {
    switch (sortBy) {
      case 'revenue':
        return formatCurrency(value);
      case 'visitors':
        return value.toLocaleString() + ' 人';
      case 'conversionRate':
        return formatPercent(value);
      default:
        return formatCurrency(value);
    }
  };

  const maxValue = Math.max(...data.map(getValue));

  const getBarColor = (index: number): string => {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];
    return colors[index % colors.length];
  };

  return (
    <div className="card h-full">
      <div className="card-header flex items-center justify-between">
        <span>{title}</span>
        {selectedBoothId && (
          <button
            onClick={clearSelections}
            className="text-xs text-primary hover:underline"
          >
            清除选择
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="space-y-3">
          {data.map((item, index) => {
            const value = getValue(item);
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const isSelected = selectedBoothId === item.boothId;

            return (
              <div
                key={item.boothId}
                className={`relative cursor-pointer rounded-lg p-3 transition-colors ${
                  isSelected ? 'bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  if (isSelected) {
                    clearSelections();
                  } else {
                    selectBooth(item.boothId);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index < 3 ? 'bg-warning text-white' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{item.boothName}</div>
                      <div className="text-xs text-gray-500">{item.exhibitor}</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{formatValue(value)}</span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: getBarColor(index),
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>{item.hallName}</span>
                  <span>转化率: {formatPercent(item.conversionRate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BoothRanking;
