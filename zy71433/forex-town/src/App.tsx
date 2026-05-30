import { GameProvider, useGame } from './GameContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Orders } from './components/Orders';
import { Inventory } from './components/Inventory';
import { Ledger } from './components/Ledger';
import { Exceptions } from './components/Exceptions';
import { Review } from './components/Review';
import { GameOver } from './components/GameOver';
import './App.css';

function GameContent() {
  const { state } = useGame();

  const renderContent = () => {
    switch (state.selectedTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'orders':
        return <Orders />;
      case 'inventory':
        return <Inventory />;
      case 'ledger':
        return <Ledger />;
      case 'exceptions':
        return <Exceptions />;
      case 'review':
        return <Review />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {renderContent()}
        </main>
      </div>
      <GameOver />
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}

export default App;
