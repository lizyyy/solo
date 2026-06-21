import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BimNotes from './components/BimNotes';
import Collisions from './components/Collisions';
import Tracking from './components/Tracking';
import Review from './components/Review';
import BadData from './components/BadData';
import type { ViewType } from './types';
import './App.css';

function AppContent() {
  const { state, dispatch } = useApp();
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const pendingCount = state.materialChanges.filter(
    (m) => m.status === 'pending' && !m.isBadData
  ).length;
  const badDataCount = state.materialChanges.filter((m) => m.isBadData).length;

  const handleViewChange = (view: string) => {
    setCurrentView(view as ViewType);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            materialChanges={state.materialChanges}
            bimNotes={state.bimNotes}
            collisions={state.collisions}
            onViewChange={handleViewChange}
          />
        );
      case 'bimNotes':
        return (
          <BimNotes
            notes={state.bimNotes}
            impactResult={state.lastImpactResult}
            onAddNote={(note) => {
              dispatch({ type: 'PROCESS_NEW_NOTE_IMPACT', payload: { bimNote: note } });
            }}
            selectedNoteId={state.selectedBimNoteId ?? undefined}
            onSelectNote={(note) => dispatch({ type: 'SELECT_BIM_NOTE', payload: note.id })}
          />
        );
      case 'collisions':
        return (
          <Collisions
            collisions={state.collisions}
            bimNotes={state.bimNotes}
            bimComponents={state.bimComponents}
            selectedCollisionId={state.selectedCollisionId}
            onSelectCollision={(id) => dispatch({ type: 'SELECT_COLLISION', payload: id })}
            onConfirmDuplicate={(collisionId, isDuplicate) =>
              dispatch({ type: 'CONFIRM_DUPLICATE', payload: { collisionId, isDuplicate } })
            }
          />
        );
      case 'tracking':
        return (
          <Tracking
            materialChanges={state.materialChanges}
            bimNotes={state.bimNotes}
            collisions={state.collisions}
          />
        );
      case 'review':
        return (
          <Review
            materialChanges={state.materialChanges}
            bimNotes={state.bimNotes}
            collisions={state.collisions}
          />
        );
      case 'badData':
        return (
          <BadData
            materialChanges={state.materialChanges}
            bimNotes={state.bimNotes}
            onViewBimNote={(noteId) => {
              dispatch({ type: 'SELECT_BIM_NOTE', payload: noteId });
              setCurrentView('bimNotes');
            }}
          />
        );
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

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
