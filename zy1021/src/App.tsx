import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DevicePanel } from './components/DevicePanel';
import { Timeline } from './components/Timeline';
import { ConflictResolver } from './components/ConflictResolver';
import { ServerStatus } from './components/ServerStatus';
import { ImportExport } from './components/ImportExport';
import './App.css';

const AppContent: React.FC = () => {
  const { state } = useAppContext();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1>离线表单同步冲突演练器</h1>
          <p className="subtitle">模拟多设备离线编辑与同步冲突的完整流程</p>
        </div>
        <div className="header-right">
          <div className="global-stats">
            <span className="stat-item">
              <span className="stat-label">服务端版本:</span>
              <span className="stat-value">v{state.server.currentVersion}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">待同步更改:</span>
              <span className="stat-value">{state.devices.reduce((acc, d) => acc + d.pendingChanges.length, 0)}</span>
            </span>
            <span className="stat-item">
              <span className="stat-label">未解决冲突:</span>
              <span className="stat-value">{state.server.conflicts.filter(c => !c.resolved).length}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="devices-section">
          <h2>设备视角</h2>
          <div className="devices-grid">
            {state.devices.map((device) => (
              <div key={device.id} className="device-wrapper">
                <DevicePanel device={device} />
              </div>
            ))}
          </div>
        </section>

        <section className="right-panel">
          <div className="panel-row">
            <div className="panel-item">
              <ServerStatus />
            </div>
          </div>
          
          <div className="panel-row">
            <div className="panel-item">
              <ConflictResolver />
            </div>
          </div>
          
          <div className="panel-row">
            <div className="panel-item">
              <ImportExport />
            </div>
          </div>
        </section>
      </main>

      <section className="timeline-section">
        <Timeline />
      </section>
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
