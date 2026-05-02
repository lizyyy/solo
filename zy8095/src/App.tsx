import { useState, useEffect, useCallback } from 'react';
import { StowageScene } from '@/components/Scene/StowageScene';
import { FileImport } from '@/components/UI/FileImport';
import { ControlPanel } from '@/components/UI/ControlPanel';
import { CalculationPanel } from '@/components/UI/CalculationPanel';
import { SavePanel } from '@/components/UI/SavePanel';
import { useStowageStore, loadFromLocalStorage } from '@/store/stowageStore';
import { calculateStowage } from '@/calculator/stowageCalculator';
import type { CargoItem, Bay } from '@/types';
import './App.css';

function App() {
  const { state, placeCargo, removeCargo, undo, redo, canUndo, canRedo, loadState, clearPlacements } = useStowageStore();
  const [selectedCargo, setSelectedCargo] = useState<CargoItem | null>(null);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);

  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved) {
      loadState(saved);
    }
  }, [loadState]);

  const calculationResult = calculateStowage(state);

  const handleBayClick = useCallback((bayId: string) => {
    const bay = state.bays.find(b => b.id === bayId);
    setSelectedBay(bay || null);
  }, [state.bays]);

  const handleCargoClick = useCallback((cargoId: string) => {
    const cargo = state.cargoItems.find(c => c.id === cargoId);
    setSelectedCargo(cargo || null);
  }, [state.cargoItems]);

  const handlePlaceCargo = useCallback((cargoId: string, bayId: string) => {
    const bay = state.bays.find(b => b.id === bayId);
    if (!bay) return;
    
    placeCargo(cargoId, bayId, {
      x: 0,
      y: bay.dimensions.height / 2,
      z: 0,
    });
    
    setSelectedCargo(null);
    setSelectedBay(null);
  }, [state.bays, placeCargo]);

  const handleLoad = useCallback((newState: typeof state) => {
    loadState(newState);
    setSelectedCargo(null);
    setSelectedBay(null);
  }, [loadState]);

  return (
    <div className="app">
      <header className="header">
        <h1>三维配载复核工具</h1>
        <div className="header-actions">
          <FileImport onLoad={handleLoad} />
          <SavePanel state={state} />
        </div>
      </header>

      <div className="main-content">
        <div className="scene-container">
          <StowageScene 
            state={state} 
            onBayClick={handleBayClick}
            onCargoClick={handleCargoClick}
          />
        </div>

        <div className="side-panel">
          <CalculationPanel 
            result={calculationResult}
            cargoItems={state.cargoItems}
            bays={state.bays}
          />
          
          <ControlPanel
            state={state}
            selectedCargo={selectedCargo}
            selectedBay={selectedBay}
            onSelectCargo={setSelectedCargo}
            onSelectBay={setSelectedBay}
            onPlaceCargo={handlePlaceCargo}
            onRemoveCargo={removeCargo}
            onUndo={undo}
            onRedo={redo}
            onClear={clearPlacements}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </div>
      </div>

      <footer className="footer">
        <p>小型货船三维配载复核工具 - 支持拖拽配载、实时计算、规则校验</p>
      </footer>
    </div>
  );
}

export default App;