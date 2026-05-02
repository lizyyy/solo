import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { TrainingPlan, TrainingSession } from '../shared/types';
import { StorageManager, initializeSamplePlans } from '../shared/StorageManager';
import PlanList from './components/PlanList';
import PlanEditor from './components/PlanEditor';
import TrainingView from './components/TrainingView';
import SessionList from './components/SessionList';
import SessionDetail from './components/SessionDetail';

interface AppContextType {
  storage: StorageManager;
  currentPlan: TrainingPlan | null;
  setCurrentPlan: (plan: TrainingPlan | null) => void;
  currentSession: TrainingSession | null;
  setCurrentSession: (session: TrainingSession | null) => void;
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  refreshPlans: () => void;
  refreshSessions: () => void;
  plans: TrainingPlan[];
  sessions: TrainingSession[];
}

type ViewType = 'plans' | 'editor' | 'training' | 'sessions' | 'detail';

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

const App: React.FC = () => {
  const [storage] = useState(() => new StorageManager());
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [currentPlan, setCurrentPlan] = useState<TrainingPlan | null>(null);
  const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('plans');

  const refreshPlans = useCallback(() => {
    const p = storage.getPlans();
    setPlans(p);
  }, [storage]);

  const refreshSessions = useCallback(() => {
    const s = storage.getSessions();
    setSessions(s);
  }, [storage]);

  useEffect(() => {
    initializeSamplePlans(storage);
    refreshPlans();
    refreshSessions();
  }, [storage, refreshPlans, refreshSessions]);

  const renderView = () => {
    switch (currentView) {
      case 'plans':
        return <PlanList />;
      case 'editor':
        return <PlanEditor />;
      case 'training':
        return <TrainingView />;
      case 'sessions':
        return <SessionList />;
      case 'detail':
        return <SessionDetail />;
      default:
        return <PlanList />;
    }
  };

  const contextValue: AppContextType = {
    storage,
    currentPlan,
    setCurrentPlan,
    currentSession,
    setCurrentSession,
    currentView,
    setCurrentView,
    refreshPlans,
    refreshSessions,
    plans,
    sessions,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div style={styles.app}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>🎯 手部康复节拍教练</h1>
            <span style={styles.subtitle}>社区康复治疗师本地交互训练工具</span>
          </div>
          <nav style={styles.nav}>
            <button
              style={currentView === 'plans' || currentView === 'editor' ? styles.navActive : styles.navButton}
              onClick={() => setCurrentView('plans')}
            >
              📋 训练方案
            </button>
            <button
              style={currentView === 'sessions' || currentView === 'detail' ? styles.navActive : styles.navButton}
              onClick={() => setCurrentView('sessions')}
            >
              📊 训练历史
            </button>
          </nav>
        </header>
        <main style={styles.main}>
          {renderView()}
        </main>
      </div>
    </AppContext.Provider>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    height: '60px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e4e7ed',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#303133',
    margin: 0,
  },
  subtitle: {
    fontSize: '12px',
    color: '#909399',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navButton: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#606266',
    backgroundColor: 'transparent',
    transition: 'all 0.2s',
  },
  navActive: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#409eff',
    backgroundColor: '#ecf5ff',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
};

export default App;
