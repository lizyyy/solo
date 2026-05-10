import React, { useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Reservations from './components/Reservations.jsx';
import ReservationDetail from './components/ReservationDetail.jsx';
import Kitchens from './components/Kitchens.jsx';
import Schedules from './components/Schedules.jsx';
import Reports from './components/Reports.jsx';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedReservation, setSelectedReservation] = useState(null);

  const tabs = [
    { id: 'dashboard', label: '总览看板' },
    { id: 'reservations', label: '预约管理' },
    { id: 'kitchens', label: '厨房档案' },
    { id: 'schedules', label: '档期安排' },
    { id: 'reports', label: '报表分析' }
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedReservation(null);
  };

  const handleViewReservation = (id) => {
    setSelectedReservation(id);
  };

  const handleBackToList = () => {
    setSelectedReservation(null);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>共享厨房档期审批台</h1>
        <p className="subtitle">设备占用 · 清洁窗口 · 消防检查 · 统一调度</p>
      </header>

      <nav className="nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard onViewReservation={handleViewReservation} />}
        {activeTab === 'reservations' && (
          selectedReservation ? (
            <ReservationDetail 
              id={selectedReservation} 
              onBack={handleBackToList}
            />
          ) : (
            <Reservations onViewReservation={handleViewReservation} />
          )
        )}
        {activeTab === 'kitchens' && <Kitchens />}
        {activeTab === 'schedules' && <Schedules />}
        {activeTab === 'reports' && <Reports onViewReservation={handleViewReservation} />}
      </main>
    </div>
  );
}

export default App;
