import React from 'react';
import { Lawyer, getDomainLabel } from '../types';

interface LawyersListProps {
  lawyers: Lawyer[];
  loading: boolean;
  onCreateLawyer: () => void;
}

const LawyersList: React.FC<LawyersListProps> = ({ lawyers, loading, onCreateLawyer }) => {
  if (loading) {
    return (
      <div className="section">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  const getCapacityClass = (current: number, capacity: number) => {
    const ratio = current / capacity;
    if (ratio < 0.5) return 'low';
    if (ratio < 0.8) return 'medium';
    return 'high';
  };

  return (
    <div className="section">
      <div className="flex justify-between items-center mb-5">
        <h2 className="section-title" style={{ margin: 0, padding: 0, border: 'none' }}>
          律师列表
        </h2>
        <button className="btn btn-primary" onClick={onCreateLawyer}>
          添加律师
        </button>
      </div>

      {lawyers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍⚖️</div>
          <div className="empty-state-text">暂无律师数据</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
          {lawyers.map(lawyer => (
            <div key={lawyer.id} className="lawyer-card">
              <div className="lawyer-name">{lawyer.name}</div>
              <div className="lawyer-meta">
                <span>专业: {getDomainLabel(lawyer.specialty)}</span>
                <span>容量: {lawyer.current_load}/{lawyer.capacity}</span>
              </div>
              <div className="capacity-bar">
                <div
                  className={`capacity-fill ${getCapacityClass(lawyer.current_load, lawyer.capacity)}`}
                  style={{ width: `${(lawyer.current_load / lawyer.capacity) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LawyersList;
