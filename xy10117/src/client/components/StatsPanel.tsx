import React from 'react';
import { Statistics } from '../types';

interface StatsPanelProps {
  stats: Statistics | null;
  loading: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, loading }) => {
  const statItems = stats
    ? [
        { label: '总交易数', value: stats.total, className: '' },
        { label: '异常交易', value: stats.anomalies, className: 'highlight' },
        { label: '待复核', value: stats.unreviewed, className: 'warning' },
        { label: '已确认异常', value: stats.confirmed, className: 'highlight' },
        { label: '误判(回退)', value: stats.rejected, className: 'success' },
        { label: '平均风险分', value: stats.avg_score.toFixed(1), className: '' },
      ]
    : [];

  return (
    <div className="stats-grid">
      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="label">&nbsp;</div>
            <div className="value"><span className="loading"></span></div>
          </div>
        ))
      ) : (
        statItems.map((item, i) => (
          <div key={i} className={`stat-card ${item.className}`}>
            <div className="label">{item.label}</div>
            <div className="value">{item.value}</div>
          </div>
        ))
      )}
    </div>
  );
};
