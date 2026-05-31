import React from 'react';
import { useApp } from '../context/AppContext';
import { TaskStatus, Department } from '../types';
import { getStatusLabel, getDepartmentLabel } from '../utils/helpers';

const TaskFilter: React.FC = () => {
  const { state, dispatch } = useApp();
  const { filters } = state;

  const statusOptions: TaskStatus[] = ['draft', 'pending', 'confirmed', 'exported', 'withdrawn', 'archived'];
  const departmentOptions: Department[] = ['design', 'marketing', 'printing'];
  const seasonOptions = ['春季', '夏季', '秋季', '冬季'];

  const toggleStatus = (status: TaskStatus) => {
    const current = filters.status || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    dispatch({ type: 'SET_FILTERS', payload: { status: updated.length ? updated : undefined } });
  };

  const toggleDepartment = (dept: Department) => {
    const current = filters.department || [];
    const updated = current.includes(dept)
      ? current.filter(d => d !== dept)
      : [...current, dept];
    dispatch({ type: 'SET_FILTERS', payload: { department: updated.length ? updated : undefined } });
  };

  const toggleSeason = (season: string) => {
    const current = filters.season || [];
    const updated = current.includes(season)
      ? current.filter(s => s !== season)
      : [...current, season];
    dispatch({ type: 'SET_FILTERS', payload: { season: updated.length ? updated : undefined } });
  };

  return (
    <div className="filter-panel">
      <div className="filter-section">
        <label className="filter-label">搜索</label>
        <input
          type="text"
          className="search-input"
          placeholder="输入任务名称或SKU..."
          value={filters.searchText || ''}
          onChange={(e) => dispatch({
            type: 'SET_FILTERS',
            payload: { searchText: e.target.value || undefined }
          })}
        />
      </div>

      <div className="filter-section">
        <label className="filter-label">状态</label>
        <div className="filter-tags">
          {statusOptions.map(status => (
            <button
              key={status}
              className={`filter-tag ${filters.status?.includes(status) ? 'active' : ''}`}
              onClick={() => toggleStatus(status)}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">部门</label>
        <div className="filter-tags">
          {departmentOptions.map(dept => (
            <button
              key={dept}
              className={`filter-tag ${filters.department?.includes(dept) ? 'active' : ''}`}
              onClick={() => toggleDepartment(dept)}
            >
              {getDepartmentLabel(dept)}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">季节</label>
        <div className="filter-tags">
          {seasonOptions.map(season => (
            <button
              key={season}
              className={`filter-tag ${filters.season?.includes(season) ? 'active' : ''}`}
              onClick={() => toggleSeason(season)}
            >
              {season}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">异常</label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={filters.hasAnomalies || false}
            onChange={(e) => dispatch({
              type: 'SET_FILTERS',
              payload: { hasAnomalies: e.target.checked || undefined }
            })}
          />
          仅显示待确认异常
        </label>
      </div>
    </div>
  );
};

export default TaskFilter;
