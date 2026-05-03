import React from 'react';
import { Route, DifficultyLevel } from '../types';
import { useApp } from '../context/AppContext';
import { DIFFICULTY_NAMES } from '../data/sampleData';

interface RouteListProps {
  routes: Route[];
  activeRouteId: string | null;
  onSelectRoute: (routeId: string | null) => void;
  onEditRoute?: (route: Route) => void;
}

export function RouteList({ routes, activeRouteId, onSelectRoute, onEditRoute }: RouteListProps) {
  const { createNewRoute, activeWall } = useApp();

  const handleAddRoute = () => {
    if (activeWall) {
      createNewRoute(activeWall.id);
    }
  };

  const getDifficultyBadgeClass = (difficulty: DifficultyLevel) => {
    switch (difficulty) {
      case 'beginner': return 'difficulty-beginner';
      case 'intermediate': return 'difficulty-intermediate';
      case 'advanced': return 'difficulty-advanced';
    }
  };

  return (
    <div className="panel-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="panel-title" style={{ marginBottom: 0 }}>线路列表</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAddRoute}
          disabled={!activeWall}
        >
          + 新建线路
        </button>
      </div>

      {routes.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p>暂无线路</p>
          <p style={{ fontSize: '0.75rem' }}>点击"新建线路"开始</p>
        </div>
      ) : (
        <div className="route-list">
          {routes.map((route) => (
            <RouteItem
              key={route.id}
              route={route}
              isActive={route.id === activeRouteId}
              onClick={() => onSelectRoute(route.id === activeRouteId ? null : route.id)}
              onEdit={() => onEditRoute?.(route)}
              getDifficultyBadgeClass={getDifficultyBadgeClass}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RouteItemProps {
  route: Route;
  isActive: boolean;
  onClick: () => void;
  onEdit: () => void;
  getDifficultyBadgeClass: (d: DifficultyLevel) => string;
}

function RouteItem({ route, isActive, onClick, onEdit, getDifficultyBadgeClass }: RouteItemProps) {
  return (
    <div
      className={`route-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="route-header">
        <span className="route-name">
          <span
            className="route-color-dot"
            style={{ backgroundColor: route.color }}
          />
          {route.name}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          编辑
        </button>
      </div>
      <div className="route-meta">
        <span className={`difficulty-badge ${getDifficultyBadgeClass(route.difficulty)}`}>
          {DIFFICULTY_NAMES[route.difficulty]}
        </span>
        <span>{route.holds.length} 个岩点</span>
        {route.estimatedGrade && (
          <span>{route.estimatedGrade}</span>
        )}
      </div>
    </div>
  );
}
