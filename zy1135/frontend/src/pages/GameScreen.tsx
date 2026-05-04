import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Action } from '../types';
import { ACTIONS } from '../config/gameData';
import ResourceDisplay from '../components/ResourceDisplay';
import LocationList from '../components/LocationList';
import FacilityPanel from '../components/FacilityPanel';
import InventoryDisplay from '../components/InventoryDisplay';
import ActionPanel from '../components/ActionPanel';
import LogView from '../components/LogView';
import EventModal from '../components/EventModal';
import Toast from '../components/Toast';

const GameScreen = () => {
  const { currentGame, activeEvent } = useGameStore();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'actions' | 'log'>('actions');

  if (!currentGame) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const globalActions: Action[] = ACTIONS.filter((a) => !a.location);
  const locationActions: Action[] = selectedLocation
    ? ACTIONS.filter((a) => a.location === selectedLocation)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean to-sand">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏝️</span>
              <div>
                <h1 className="text-xl font-bold text-ocean-dark">{currentGame.name}</h1>
                <p className="text-sm text-gray-500">鲁滨逊漂流记</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-forest">第 {currentGame.currentDay} 天</div>
                <div className="text-sm text-gray-500">
                  行动点: <span className="font-bold text-ocean">{currentGame.actionPoints}</span> /{' '}
                  {currentGame.maxActionPoints}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <ResourceDisplay
              resources={currentGame.resources}
              maxResources={currentGame.maxResources}
              actionPoints={currentGame.actionPoints}
              maxActionPoints={currentGame.maxActionPoints}
              currentDay={currentGame.currentDay}
            />
            <LocationList
              locations={currentGame.locations}
              selectedLocation={selectedLocation}
              onSelectLocation={setSelectedLocation}
            />
          </div>

          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('actions')}
                  className={`flex-1 py-3 px-4 font-medium transition-colors ${
                    activeTab === 'actions' ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  🎮 行动
                </button>
                <button
                  onClick={() => setActiveTab('log')}
                  className={`flex-1 py-3 px-4 font-medium transition-colors ${
                    activeTab === 'log' ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  📖 日志
                </button>
              </div>
              <div className="p-4">
                {activeTab === 'actions' ? (
                  <ActionPanel
                    gameState={currentGame}
                    selectedLocation={selectedLocation}
                    globalActions={globalActions}
                    locationActions={locationActions}
                  />
                ) : (
                  <LogView logs={currentGame.logs} />
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <FacilityPanel
              facilities={currentGame.facilities}
              hasFire={currentGame.hasFire}
              hasShelter={currentGame.hasShelter}
              hasFriday={currentGame.hasFriday}
            />
            <InventoryDisplay inventory={currentGame.inventory} />
          </div>
        </div>
      </main>

      {activeEvent && (
        <EventModal event={activeEvent} gameState={currentGame} />
      )}

      <Toast />
    </div>
  );
};

export default GameScreen;
