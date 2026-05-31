import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import TaskFilter from './components/TaskFilter';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import { DisplayTask } from './types';
import './styles.css';

const AppContent: React.FC = () => {
  const { state, dispatch } = useApp();
  const selectedTask = state.tasks.find(t => t.id === state.selectedTaskId);

  const handleSelectTask = (task: DisplayTask) => {
    dispatch({ type: 'SELECT_TASK', payload: task.id });
  };

  const handleCloseDetail = () => {
    dispatch({ type: 'SELECT_TASK', payload: null });
  };

  const getTotalStats = () => {
    const total = state.tasks.length;
    const pending = state.tasks.filter(t => t.status === 'pending').length;
    const hasAnomalies = state.tasks.filter(t => t.anomalies.some(a => !a.isResolved)).length;
    return { total, pending, hasAnomalies };
  };

  const stats = getTotalStats();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>门店陈列换季管理系统</h1>
          <div className="user-info">
            当前用户: <strong>{state.user.name}</strong>
          </div>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">总任务数</span>
        </div>
        <div className="stat-item warning">
          <span className="stat-value">{stats.pending}</span>
          <span className="stat-label">待确认</span>
        </div>
        <div className="stat-item error">
          <span className="stat-value">{stats.hasAnomalies}</span>
          <span className="stat-label">存在异常</span>
        </div>
      </div>

      <div className="main-layout">
        <aside className="sidebar">
          <TaskFilter />
        </aside>

        <main className="main-content">
          <TaskList onSelectTask={handleSelectTask} />
        </main>

        {selectedTask && (
          <aside className="detail-panel">
            <TaskDetail task={selectedTask} onClose={handleCloseDetail} />
          </aside>
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
