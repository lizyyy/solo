import React from 'react';
import { useGameStore } from './game/state';
import { MainMenu } from './components/MainMenu';
import { LevelSelect } from './components/LevelSelect';
import { GameCanvas } from './components/GameCanvas';
import { StatusBar } from './components/StatusBar';
import { InventoryPanel } from './components/InventoryPanel';
import { TurnControls } from './components/TurnControls';
import { EventCard } from './components/EventCard';
import { PauseMenu } from './components/PauseMenu';
import { Settlement } from './components/Settlement';
import { HistorySection } from './components/HistorySection';
import { RulesSection } from './components/RulesSection';

const GameScreen: React.FC = () => {
  const { currentLevel } = useGameStore();

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 text-center">
          <h1 className="text-2xl font-bold text-primary-700">
            🏕️ {currentLevel?.name}
          </h1>
        </div>

        <StatusBar />

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <GameCanvas />
            <div className="mt-4">
              <TurnControls />
            </div>
          </div>

          <div className="lg:col-span-1">
            <InventoryPanel />
          </div>
        </div>
      </div>

      <EventCard />
      <PauseMenu />
      <Settlement />
    </div>
  );
};

const MenuScreen: React.FC = () => {
  return (
    <>
      <MainMenu />
      <HistorySection />
      <RulesSection />
    </>
  );
};

const App: React.FC = () => {
  const { status } = useGameStore();

  return (
    <div className="min-h-screen">
      {status === 'menu' && <MenuScreen />}
      {status === 'levelSelect' && <LevelSelect />}
      {(status === 'playing' || status === 'paused' || status === 'settlement') && <GameScreen />}
    </div>
  );
};

export default App;
