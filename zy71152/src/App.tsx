import { useState } from 'react';
import LevelSelect from './pages/LevelSelect';
import GamePage from './pages/GamePage';
import ReplayPage from './pages/ReplayPage';

type Page = 'menu' | 'game' | 'replay';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('menu');
  const [selectedLevelId, setSelectedLevelId] = useState<number>(1);

  const handleSelectLevel = (levelId: number) => {
    setSelectedLevelId(levelId);
    setCurrentPage('game');
  };

  const handleBackToMenu = () => {
    setCurrentPage('menu');
  };

  const handleViewReplays = () => {
    setCurrentPage('replay');
  };

  return (
    <div className="font-sans">
      {currentPage === 'menu' && (
        <LevelSelect
          onSelectLevel={handleSelectLevel}
          onViewReplays={handleViewReplays}
        />
      )}
      {currentPage === 'game' && (
        <GamePage
          levelId={selectedLevelId}
          onBackToMenu={handleBackToMenu}
        />
      )}
      {currentPage === 'replay' && (
        <ReplayPage onBack={handleBackToMenu} />
      )}
    </div>
  );
}

export default App;
