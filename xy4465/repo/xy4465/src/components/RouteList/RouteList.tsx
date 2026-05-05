import React, { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { 
  getCongestionRiskLabel, 
  getTrendLabel, 
  formatTimeSlot 
} from '../../services/dataProcessor';
import type { RouteStats, FilterOptions } from '../../types';
import { DIFFICULTY_ORDER, ZONES } from '../../types';
import './RouteList.css';

const RouteList: React.FC = () => {
  const { state, dispatch, filteredAndSortedRoutes, getRouteStats, getRouteAlerts } = useAppContext();

  const availableDifficulties = useMemo(() => {
    const difficulties = new Set(state.data.routes.map(r => r.difficulty));
    return DIFFICULTY_ORDER.filter(d => difficulties.has(d));
  }, [state.data.routes]);

  const availableZones = useMemo(() => {
    const zones = new Set(state.data.routes.map(r => r.zone));
    return ZONES.filter(z => zones.has(z));
  }, [state.data.routes]);

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    dispatch({ type: 'SET_FILTERS', payload: { [key]: value } });
  };

  const handleRouteClick = (routeId: string) => {
    dispatch({ type: 'SELECT_ROUTE', payload: routeId === state.selectedRouteId ? null : routeId });
  };

  const clearAllFilters = () => {
    dispatch({
      type: 'SET_FILTERS',
      payload: {
        difficulties: [],
        zones: [],
        searchText: '',
        sortBy: 'name',
        sortOrder: 'asc'
      }
    });
  };

  const getDifficultyColor = (difficulty: string): string => {
    const colors: Record<string, string> = {
      'V0': '#22c55e',
      'V1': '#4ade80',
      'V2': '#84cc16',
      'V3': '#eab308',
      'V4': '#f97316',
      'V5': '#ef4444',
      'V6': '#dc2626',
      'V7': '#b91c1c',
      'V8': '#7f1d1d',
      'V9': '#431407',
      'V10+': '#1a1a1a'
    };
    return colors[difficulty] || '#6b7280';
  };

  const getCongestionRiskBadgeClass = (risk: RouteStats['congestionRisk']): string => {
    switch (risk) {
      case 'low': return 'congestion--low';
      case 'medium': return 'congestion--medium';
      case 'high': return 'congestion--high';
    }
  };

  const getTrendBadgeClass = (trend: RouteStats['recentTrend']): string => {
    switch (trend) {
      case 'improving': return 'trend--improving';
      case 'declining': return 'trend--declining';
      case 'stable': return 'trend--stable';
    }
  };

  const hasActiveFilters = 
    state.filters.difficulties.length > 0 || 
    state.filters.zones.length > 0 || 
    state.filters.searchText !== '';

  return (
    <div className="route-list">
      <div className="route-list__header">
        <h3>线路列表</h3>
        <span className="route-list__count">
          {filteredAndSortedRoutes.length} / {state.data.routes.length} 条线路
        </span>
      </div>

      <div className="route-list__filters">
        <div className="route-list__filter-group">
          <label className="route-list__filter-label">搜索</label>
          <input
            type="text"
            className="route-list__search-input"
            placeholder="搜索线路名称、区域、定线员..."
            value={state.filters.searchText}
            onChange={(e) => handleFilterChange('searchText', e.target.value)}
          />
        </div>

        <div className="route-list__filter-group">
          <label className="route-list__filter-label">难度</label>
          <div className="route-list__filter-buttons">
            {availableDifficulties.map(difficulty => (
              <button
                key={difficulty}
                className={`route-list__filter-btn ${
                  state.filters.difficulties.includes(difficulty) 
                    ? 'route-list__filter-btn--active' 
                    : ''
                }`}
                style={{
                  backgroundColor: state.filters.difficulties.includes(difficulty) 
                    ? getDifficultyColor(difficulty)
                    : undefined,
                  color: state.filters.difficulties.includes(difficulty) 
                    ? 'white'
                    : undefined
                }}
                onClick={() => {
                  const current = state.filters.difficulties;
                  const updated = current.includes(difficulty)
                    ? current.filter(d => d !== difficulty)
                    : [...current, difficulty];
                  handleFilterChange('difficulties', updated);
                }}
              >
                {difficulty}
              </button>
            ))}
          </div>
        </div>

        <div className="route-list__filter-group">
          <label className="route-list__filter-label">区域</label>
          <div className="route-list__filter-buttons">
            {availableZones.map(zone => (
              <button
                key={zone}
                className={`route-list__filter-btn ${
                  state.filters.zones.includes(zone) 
                    ? 'route-list__filter-btn--active' 
                    : ''
                }`}
                onClick={() => {
                  const current = state.filters.zones;
                  const updated = current.includes(zone)
                    ? current.filter(z => z !== zone)
                    : [...current, zone];
                  handleFilterChange('zones', updated);
                }}
              >
                {zone}
              </button>
            ))}
          </div>
        </div>

        <div className="route-list__filter-group">
          <label className="route-list__filter-label">排序</label>
          <div className="route-list__sort-controls">
            <select
              className="route-list__select"
              value={state.filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="name">名称</option>
              <option value="difficulty">难度</option>
              <option value="successRate">完攀率</option>
              <option value="popularity">人气</option>
            </select>
            <button
              className="route-list__sort-btn"
              onClick={() => handleFilterChange('sortOrder', state.filters.sortOrder === 'asc' ? 'desc' : 'asc')}
              title={state.filters.sortOrder === 'asc' ? '升序' : '降序'}
            >
              {state.filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            className="route-list__clear-btn"
            onClick={clearAllFilters}
          >
            清除筛选
          </button>
        )}
      </div>

      {filteredAndSortedRoutes.length === 0 ? (
        <div className="route-list__empty">
          <div className="route-list__empty-icon">🧗</div>
          <h4>暂无线路数据</h4>
          <p>请先导入线路表数据，或调整筛选条件</p>
        </div>
      ) : (
        <div className="route-list__grid">
          {filteredAndSortedRoutes.map(route => {
            const stats = getRouteStats(route.id);
            const routeAlerts = getRouteAlerts(route.id);
            const unacknowledgedAlerts = routeAlerts.filter(a => !a.acknowledged);
            const isSelected = state.selectedRouteId === route.id;

            return (
              <div
                key={route.id}
                className={`route-card ${isSelected ? 'route-card--selected' : ''}`}
                onClick={() => handleRouteClick(route.id)}
              >
                <div className="route-card__header">
                  <div className="route-card__difficulty-badge" style={{
                    backgroundColor: getDifficultyColor(route.difficulty)
                  }}>
                    {route.difficulty}
                  </div>
                  
                  {unacknowledgedAlerts.length > 0 && (
                    <div className="route-card__alert-badge">
                      ⚠️ {unacknowledgedAlerts.length}
                    </div>
                  )}
                </div>

                <h4 className="route-card__name">{route.name}</h4>
                
                <div className="route-card__meta">
                  <span className="route-card__zone">📍 {route.zone}</span>
                  {route.setter && (
                    <span className="route-card__setter">👤 {route.setter}</span>
                  )}
                </div>

                {stats && (
                  <div className="route-card__stats">
                    <div className="route-card__stat-item">
                      <div className="route-card__stat-value">{stats.successRate.toFixed(1)}%</div>
                      <div className="route-card__stat-label">完攀率</div>
                    </div>
                    
                    <div className="route-card__stat-item">
                      <div className="route-card__stat-value">{stats.totalAttempts}</div>
                      <div className="route-card__stat-label">尝试次数</div>
                    </div>
                    
                    <div className="route-card__stat-item">
                      <div className={`route-card__stat-value ${getCongestionRiskBadgeClass(stats.congestionRisk)}`}>
                        {getCongestionRiskLabel(stats.congestionRisk)}
                      </div>
                      <div className="route-card__stat-label">拥堵风险</div>
                    </div>
                    
                    <div className="route-card__stat-item">
                      <div className={`route-card__stat-value ${getTrendBadgeClass(stats.recentTrend)}`}>
                        {getTrendLabel(stats.recentTrend)}
                      </div>
                      <div className="route-card__stat-label">趋势</div>
                    </div>
                  </div>
                )}

                {stats && stats.popularTimeSlots.length > 0 && (
                  <div className="route-card__popular-times">
                    <div className="route-card__popular-label">热门时段</div>
                    <div className="route-card__time-slots">
                      {stats.popularTimeSlots.slice(0, 3).map((slot, index) => (
                        <span key={index} className="route-card__time-slot">
                          {formatTimeSlot(slot)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RouteList;
