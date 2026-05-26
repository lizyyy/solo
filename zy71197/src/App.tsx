import React, { useState } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { MainMenu } from './pages/MainMenu';
import { GameScreen } from './pages/GameScreen';
import { ReportScreen } from './pages/ReportScreen';
import { HistoryScreen } from './pages/HistoryScreen';

type Page = 'menu' | 'game' | 'report' | 'history';

function AppContent() {
  const [page, setPage] = useState<Page>('menu');
  const { setLevel, resetGame } = useGame();

  const handleSelectLevel = (levelId: number) => {
    setLevel(levelId);
    resetGame();
    setPage('game');
  };

  const handleBackToMenu = () => {
    setPage('menu');
  };

  const handleShowReport = () => {
    setPage('report');
  };

  const handleReplay = () => {
    resetGame();
    setPage('game');
  };

  const handleShowHistory = () => {
    setPage('history');
  };

  switch (page) {
    case 'menu':
      return (
        <MainMenu
          onSelectLevel={handleSelectLevel}
          onShowHistory={handleShowHistory}
        />
      );
    
    case 'game':
      return (
        <GameScreen
          onBack={handleBackToMenu}
          onShowReport={handleShowReport}
        />
      );
    
    case 'report':
      return (
        <ReportScreen
          onBack={() => setPage('game')}
          onReplay={handleReplay}
          onReturnMenu={handleBackToMenu}
        />
      );
    
    case 'history':
      return <HistoryScreen onBack={handleBackToMenu} />;
    
    default:
      return null;
  }
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
