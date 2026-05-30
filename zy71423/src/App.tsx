import { useGameStore } from './store/gameStore';
import { Navigation } from './components/Navigation';
import { Home } from './pages/Home';
import { Game } from './pages/Game';
import { Records } from './pages/Records';
import { Reports } from './pages/Reports';

function App() {
  const { currentScreen, setScreen, startNewBatch, currentBatchId } = useGameStore();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <Home />;
      case 'game':
        return <Game />;
      case 'records':
        return <Records />;
      case 'reports':
        return <Reports />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <Navigation
        currentScreen={currentScreen}
        onNavigate={setScreen}
        onNewBatch={startNewBatch}
        currentBatchId={currentBatchId}
      />
      {renderScreen()}
    </div>
  );
}

export default App;
