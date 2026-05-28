import React from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import type { GameEvent } from '../../types';
import { formatCurrency } from '../../utils/calculations';

interface EventModalProps {
  event: GameEvent;
  onHandle: () => void;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ event, onHandle, onClose }) => {
  const getEventIcon = () => {
    switch (event.type) {
      case 'subscription':
        return <TrendingUp className="text-green-500" size={32} />;
      case 'redemption':
        return <TrendingDown className="text-red-500" size={32} />;
      case 'suspension':
        return <AlertTriangle className="text-yellow-500" size={32} />;
      case 'marketMove':
        return <Banknote className="text-blue-500" size={32} />;
      default:
        return <AlertTriangle className="text-gray-500" size={32} />;
    }
  };

  const getEventColor = () => {
    switch (event.type) {
      case 'subscription':
        return 'border-green-500';
      case 'redemption':
        return 'border-red-500';
      case 'suspension':
        return 'border-yellow-500';
      case 'marketMove':
        return 'border-blue-500';
      default:
        return 'border-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-lg shadow-xl max-w-md w-full mx-4 border-t-4 ${getEventColor()}`}>
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center gap-3">
            {getEventIcon()}
            <h3 className="text-lg font-semibold text-slate-800">{event.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-gray-600 mb-4">{event.description}</p>
          
          {event.amount && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <span className="text-gray-500">金额: </span>
              <span className="font-mono font-semibold text-slate-800">
                {formatCurrency(event.amount)}
              </span>
            </div>
          )}
          
          {event.affectedStock && (
            <div className="mb-4 p-3 bg-yellow-50 rounded">
              <span className="text-gray-500">影响股票代码: </span>
              <span className="font-mono font-semibold text-yellow-700">
                {event.affectedStock}
              </span>
            </div>
          )}
          
          {event.priceChange !== undefined && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <span className="text-gray-500">市场波动: </span>
              <span className={`font-mono font-semibold ${event.priceChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {event.priceChange >= 0 ? '+' : ''}{(event.priceChange * 100).toFixed(2)}%
              </span>
            </div>
          )}
          
          <div className="text-sm text-gray-500 mb-6">
            提示: 请根据事件情况调整您的投资组合，以控制跟踪误差。
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onHandle}
              className="flex-1 py-3 bg-slate-800 text-white rounded font-medium hover:bg-slate-700 transition-colors"
            >
              处理事件
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded font-medium hover:bg-gray-200 transition-colors"
            >
              稍后处理
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
