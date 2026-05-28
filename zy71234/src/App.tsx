import { HomePage } from './pages/HomePage';
import { LevelsPage } from './pages/LevelsPage';
import { GamePage } from './pages/GamePage';
import { SettlementPage } from './pages/SettlementPage';
import { ReportPage } from './pages/ReportPage';
import { useGameStore } from './stores/useGameStore';

function App() {
  const currentPage = useGameStore(state => state.currentPage);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'levels':
        return <LevelsPage />;
      case 'game':
        return <GamePage />;
      case 'settlement':
        return <SettlementPage />;
      case 'report':
        return <ReportPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen">
      {renderPage()}
    </div>
  );
}

export default App;
