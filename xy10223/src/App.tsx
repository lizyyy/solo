import { useState, useEffect, useCallback } from 'react';
import type { Batch, TemperatureRecord } from './types';
import { getBatches, addTemperatureRecord, transitionStage } from './services/storage';
import BatchBoard from './components/BatchBoard';
import BatchDetail from './components/BatchDetail';
import StatisticsPanel from './components/StatisticsPanel';
import Toolbar from './components/Toolbar';
import './App.css';

function App() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [showStats, setShowStats] = useState(false);

  const refreshBatches = useCallback(() => {
    const loadedBatches = getBatches();
    setBatches(loadedBatches);
    if (selectedBatch) {
      const updated = loadedBatches.find(b => b.id === selectedBatch.id);
      setSelectedBatch(updated || null);
    }
  }, [selectedBatch]);

  useEffect(() => {
    refreshBatches();
  }, [refreshBatches]);

  const handleSelectBatch = (batch: Batch) => {
    setSelectedBatch(batch);
  };

  const handleCloseDetail = () => {
    setSelectedBatch(null);
  };

  const handleAddTempRecord = (record: Omit<TemperatureRecord, 'id' | 'recordedAt'>) => {
    if (selectedBatch) {
      addTemperatureRecord(selectedBatch.id, record);
      refreshBatches();
    }
  };

  const handleTransitionStage = (toStage: string, note?: string) => {
    if (selectedBatch) {
      transitionStage(selectedBatch.id, toStage, note);
      refreshBatches();
    }
  };

  return (
    <div className="app">
      <Toolbar batches={batches} onRefresh={refreshBatches} />
      
      <div className="app-content">
        <div className="main-content">
          <BatchBoard 
            batches={batches} 
            onSelectBatch={handleSelectBatch} 
          />
        </div>
        
        <div className="side-panel">
          <button 
            className="toggle-stats-btn"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? '隐藏统计' : '显示统计'}
          </button>
          
          {showStats && <StatisticsPanel batches={batches} />}
          
          {selectedBatch && (
            <BatchDetail 
              batch={selectedBatch}
              onClose={handleCloseDetail}
              onAddTempRecord={handleAddTempRecord}
              onTransitionStage={handleTransitionStage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
