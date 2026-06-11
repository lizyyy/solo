import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BimNotes from './components/BimNotes';
import Collisions from './components/Collisions';
import Tracking from './components/Tracking';
import Review from './components/Review';
import BadData from './components/BadData';
import { mockBimNotes, mockCollisions, mockMaterialChanges } from './data/mockData';
import type { ViewType } from './types';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const pendingCount = mockMaterialChanges.filter(
    (m) => m.status === 'pending' && !m.isBadData
  ).length;
  const badDataCount = mockMaterialChanges.filter((m) => m.isBadData).length;

  const handleViewChange = (view: string) => {
    setCurrentView(view as ViewType);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            materialChanges={mockMaterialChanges}
            bimNotes={mockBimNotes}
            collisions={mockCollisions}
            onViewChange={handleViewChange}
          />
        );
      case 'bimNotes':
        return <BimNotes notes={mockBimNotes} />;
      case 'collisions':
        return <Collisions collisions={mockCollisions} bimNotes={mockBimNotes} />;
      case 'tracking':
        return (
          <Tracking
            materialChanges={mockMaterialChanges}
            bimNotes={mockBimNotes}
            collisions={mockCollisions}
          />
        );
      case 'review':
        return <Review materialChanges={mockMaterialChanges} />;
      case 'badData':
        return <BadData materialChanges={mockMaterialChanges} bimNotes={mockBimNotes} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        pendingCount={pendingCount}
        badDataCount={badDataCount}
      />
      <main className="flex-1 overflow-hidden">{renderContent()}</main>
    </div>
  );
}

export default App;
