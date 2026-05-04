import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  AlertOctagon,
  XOctagon,
  Trash2
} from 'lucide-react';
import { getStatIconClass } from '../utils/helpers';

const iconMap = {
  normal: CheckCircle,
  caution: AlertTriangle,
  warning: AlertOctagon,
  critical: XOctagon,
  scrap: Trash2
};

const StatCard = ({ title, value, level = 'normal', icon: IconProp, onClick, className = '' }) => {
  const Icon = IconProp || iconMap[level] || CheckCircle;
  const iconClass = getStatIconClass(level);

  return (
    <div 
      className={`stat-card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={`stat-icon ${iconClass}`}>
        <Icon size={24} />
      </div>
      <div className="stat-info">
        <h4>{title}</h4>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
};

export default StatCard;
