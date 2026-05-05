import React from 'react';
import type { Risk } from '../types';
import { RiskType } from '../types';

interface RiskCardProps {
  risk: Risk;
}

const riskTypeLabels: Record<RiskType, string> = {
  [RiskType.NO_RISK]: '无风险',
  [RiskType.UNDER_WATERING]: '缺水警告',
  [RiskType.OVER_WATERING]: '过灌警告',
  [RiskType.HIGH_EC]: 'EC 值偏高',
  [RiskType.CLOGGED_NOZZLE]: '喷头堵塞',
  [RiskType.MULTIPLE]: '多种风险'
};

const severityColors: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800' },
  low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' }
};

const severityIcons: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢'
};

const severityLabels: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险'
};

const RiskCard: React.FC<RiskCardProps> = ({ risk }) => {
  const colors = severityColors[risk.severity];
  
  return (
    <div className={`risk-card p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="risk-header flex items-center gap-2 mb-2">
        <span className="risk-icon text-xl">{severityIcons[risk.severity]}</span>
        <span className={`risk-type font-semibold ${colors.text}`}>
          {riskTypeLabels[risk.type]}
        </span>
        <span className={`risk-severity text-sm px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
          {severityLabels[risk.severity]}
        </span>
      </div>
      <p className="risk-description text-gray-700 mb-2">
        {risk.description}
      </p>
      <p className="risk-suggestion text-sm text-gray-600">
        <strong>建议:</strong> {risk.suggestion}
      </p>
    </div>
  );
};

export default RiskCard;
