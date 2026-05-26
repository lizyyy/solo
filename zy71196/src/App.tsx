import { useState, useEffect } from 'react';
import { MainMenu } from './components/menu/MainMenu';
import { RecordsScreen } from './components/menu/RecordsScreen';
import { GameScreen } from './components/game/GameScreen';
import { ResultScreen } from './components/result/ResultScreen';
import { ReplayScreen } from './components/replay/ReplayScreen';
import { useGameStore } from './store/gameStore';
import type { GameRecord } from './game/types';

type Screen = 'menu' | 'records' | 'game' | 'result' | 'replay';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('menu');
  const [replayRecord, setReplayRecord] = useState<GameRecord | null>(null);
  const { state, startGame } = useGameStore();

  useEffect(() => {
    if (state?.phase === 'result' && currentScreen === 'game') {
      setCurrentScreen('result');
    }
  }, [state?.phase, currentScreen]);

  const handleStartGame = (levelId: number) => {
    startGame(levelId);
    setCurrentScreen('game');
  };

  const handleGameEnd = () => {
    setCurrentScreen('result');
  };

  const handleRestart = () => {
    setCurrentScreen('game');
  };

  const handleMainMenu = () => {
    setCurrentScreen('menu');
  };

  const handleViewRecords = () => {
    setCurrentScreen('records');
  };

  const handleViewReplayFromResult = () => {
    const lastRecord = localStorage.getItem('roof-inspection-records');
    if (lastRecord) {
      const records = JSON.parse(lastRecord);
      if (records.length > 0) {
        setReplayRecord(records[records.length - 1]);
        setCurrentScreen('replay');
      }
    }
  };

  const handleViewReplay = (record: GameRecord) => {
    setReplayRecord(record);
    setCurrentScreen('replay');
  };

  const handleBackFromReplay = () => {
    setReplayRecord(null);
    setCurrentScreen('records');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {currentScreen === 'menu' && (
        <MainMenu
          onStartGame={handleStartGame}
          onViewRecords={handleViewRecords}
        />
      )}

      {currentScreen === 'records' && (
        <RecordsScreen
          onBack={handleMainMenu}
          onViewReplay={handleViewReplay}
        />
      )}

      {currentScreen === 'game' && (
        <GameScreen
          onGameEnd={handleGameEnd}
          onExit={handleMainMenu}
        />
      )}

      {currentScreen === 'result' && (
        <ResultScreen
          onRestart={handleRestart}
          onMainMenu={handleMainMenu}
          onViewReplay={handleViewReplayFromResult}
        />
      )}

      {currentScreen === 'replay' && replayRecord && (
        <ReplayScreen
          record={replayRecord}
          onBack={handleBackFromReplay}
        />
      )}
    </div>
  );
}

export default App;
