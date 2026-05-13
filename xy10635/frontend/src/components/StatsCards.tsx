import React from 'react';
import { Statistics } from '../types';

interface StatsCardsProps {
  statistics: Statistics | null;
  loading: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ statistics, loading }) => {
  if (loading || !statistics) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="stat-card">
            <div className="loading">
              <div className="spinner"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    { label: '总案件数', value: statistics.total_cases, class: 'primary' },
    { label: '待处理', value: statistics.pending_cases, class: 'warning' },
    { label: '处理中', value: statistics.in_progress_cases, class: 'info' },
    { label: '已完成', value: statistics.completed_cases, class: 'success' },
    { label: '有冲突', value: statistics.has_conflict_cases, class: 'danger' }
  ];

  return (
    <div className="stats-grid">
      {stats.map((stat, index) => (
        <div key={index} className={`stat-card ${stat.class}`}>
          <h3>{stat.label}</h3>
          <div className="value">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
