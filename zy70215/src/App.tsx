import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { ScreeningsPage } from './components/ScreeningsPage';
import { CleaningTasksPage } from './components/CleaningTasksPage';
import { LostItemsPage } from './components/LostItemsPage';
import { EquipmentPage } from './components/EquipmentPage';
import { HistoryPage } from './components/HistoryPage';

function AppContent() {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'screenings' && <ScreeningsPage />}
        {activeTab === 'cleaning' && <CleaningTasksPage />}
        {activeTab === 'lostItems' && <LostItemsPage />}
        {activeTab === 'equipment' && <EquipmentPage />}
        {activeTab === 'history' && <HistoryPage />}
      </main>
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
