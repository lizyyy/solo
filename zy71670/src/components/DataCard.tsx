import React from 'react';
import { DataLayer, LayerType, LAYER_TYPE_LABELS, RISK_LEVEL_LABELS, RISK_LEVEL_COLORS } from '../types';
import { formatDate } from '../utils/tension';

interface DataCardProps {
  type: LayerType;
  data: DataLayer;
  highlight?: boolean;
}

export const DataCard: React.FC<DataCardProps> = ({ type, data, highlight }) => {
  const getTypeColor = () => {
    switch (type) {
      case 'original':
        return 'border-l-blue-500 bg-blue-50';
      case 'corrected':
        return 'border-l-amber-500 bg-amber-50';
      case 'final':
        return 'border-l-emerald-500 bg-emerald-50';
    }
  };

  const getRiskColor = () => {
    const color = RISK_LEVEL_COLORS[data.riskLevel];
    switch (color) {
      case 'success':
        return 'bg-success-100 text-success-800';
      case 'warning':
        return 'bg-warning-100 text-warning-800';
      case 'danger':
        return 'bg-danger-100 text-danger-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className={`card-base border-l-4 ${getTypeColor()} ${highlight ? 'animate-highlight ring-2 ring-primary-300' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-800">{LAYER_TYPE_LABELS[type]}</h4>
        <span className="text-xs text-gray-500">{formatDate(data.updatedAt)}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">
            {data.tension.toFixed(2)}
          </span>
          <span className="text-sm text-gray-500">N (牛顿)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`badge ${getRiskColor()}`}>
            {RISK_LEVEL_LABELS[data.riskLevel]}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 mt-2">{data.conclusion}</p>
      </div>
    </div>
  );
};
