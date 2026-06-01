import { useRef, useState, useEffect } from 'react';
import { Scene } from './components/three/Scene';
import { LeftPanel } from './components/panels/LeftPanel';
import { RightPanel } from './components/panels/RightPanel';
import { Toolbar } from './components/toolbar/Toolbar';
import { HoverTooltip } from './components/ui/HoverTooltip';
import { useStore } from './store/useStore';
import { exportScreenshot, downloadReport } from './utils/export';
import { format } from 'date-fns';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  const {
    records,
    anomalies,
    dataCheckResult,
    selectedAnomalyId,
    hoveredAnomalyId,
    cameraState,
    leftPanelCollapsed,
    rightPanelCollapsed,
    schemes,
    currentSchemeId,
    currentOperator,
    highlightedSourceRow,
    loadSampleData,
    selectAnomaly,
    setHoveredAnomaly,
    updateAnomalyStatus,
    addSupplementNote,
    saveScheme,
    loadScheme,
    deleteScheme,
    setCameraState,
    toggleLeftPanel,
    toggleRightPanel,
    resetView,
    setHighlightedSourceRow,
    setCurrentOperator,
  } = useStore();
  
  useEffect(() => {
    if (records.length === 0) {
      loadSampleData();
    }
  }, [records.length, loadSampleData]);
  
  const selectedAnomaly = anomalies.find(a => a.id === selectedAnomalyId) || null;
  const hoveredAnomaly = anomalies.find(a => a.id === hoveredAnomalyId) || null;
  const hoveredRecord = hoveredAnomaly
    ? records.find(r => r.id === hoveredAnomaly.recordId)
    : undefined;
  
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };
  
  const handleExportScreenshot = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const scheme = schemes.find(s => s.id === currentSchemeId) || null;
      exportScreenshot(canvas, scheme, anomalies);
    }
  };
  
  const handleExportReport = () => {
    const scheme = schemes.find(s => s.id === currentSchemeId) || null;
    downloadReport(scheme, anomalies);
  };
  
  const handleDataCheckItemClick = (type: string) => {
    if (!dataCheckResult) return;
    
    let targetAnomalies: string[] = [];
    
    switch (type) {
      case 'coordinateOffsets':
        targetAnomalies = dataCheckResult.coordinateOffsets.map(o => o.anomaly.id);
        break;
      case 'missingPhotos':
        targetAnomalies = dataCheckResult.missingPhotos.map(a => a.id);
        break;
      case 'crossFloor':
        targetAnomalies = dataCheckResult.crossFloor.map(a => a.id);
        break;
      case 'boundaryRecords':
        targetAnomalies = dataCheckResult.boundaryRecords.map(a => a.id);
        break;
    }
    
    if (targetAnomalies.length > 0) {
      selectAnomaly(targetAnomalies[0]);
    }
  };
  
  const handleSaveNewScheme = () => {
    const defaultName = `预演方案_${format(new Date(), 'MMdd_HHmm')}`;
    saveScheme(defaultName);
  };
  
  const currentScheme = currentSchemeId ? schemes.find(s => s.id === currentSchemeId) : null;
  
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ fontFamily: '"Noto Sans SC", -apple-system, sans-serif' }}
      onMouseMove={handleMouseMove}
    >
      <div className="absolute inset-0 flex">
        <LeftPanel
          collapsed={leftPanelCollapsed}
          onToggle={toggleLeftPanel}
          dataCheckResult={dataCheckResult}
          schemes={schemes}
          currentSchemeId={currentSchemeId}
          records={records}
          highlightedRow={highlightedSourceRow}
          onDataCheckItemClick={handleDataCheckItemClick}
          onLoadScheme={loadScheme}
          onDeleteScheme={deleteScheme}
          onSaveNewScheme={handleSaveNewScheme}
          onHighlightRow={setHighlightedSourceRow}
        />
        
        <div className="flex-1 relative">
          <Scene
            records={records}
            anomalies={anomalies}
            selectedAnomalyId={selectedAnomalyId}
            hoveredAnomalyId={hoveredAnomalyId}
            cameraState={cameraState}
            onSelectAnomaly={selectAnomaly}
            onHoverAnomaly={setHoveredAnomaly}
            onCameraChange={setCameraState}
            canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
          />
          
          <Toolbar
            anomalies={anomalies}
            schemes={schemes}
            currentSchemeId={currentSchemeId}
            currentOperator={currentOperator}
            cameraPosition={cameraState.position}
            onSaveScheme={saveScheme}
            onExportScreenshot={handleExportScreenshot}
            onExportReport={handleExportReport}
            onResetView={resetView}
            onSetOperator={setCurrentOperator}
          />
        </div>
        
        <RightPanel
          collapsed={rightPanelCollapsed}
          onToggle={toggleRightPanel}
          selectedAnomaly={selectedAnomaly}
          records={records}
          highlightedRow={highlightedSourceRow}
          onClose={() => selectAnomaly(null)}
          onUpdateStatus={updateAnomalyStatus}
          onAddSupplement={addSupplementNote}
          onHighlightRow={setHighlightedSourceRow}
        />
      </div>
      
      <HoverTooltip
        anomaly={hoveredAnomaly}
        record={hoveredRecord}
        position={mousePosition}
      />
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h1 className="text-lg font-bold text-white/90 tracking-wider" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          桥梁施工吊装预演 · 3D可视化系统
        </h1>
        <p className="text-xs text-white/50 mt-0.5">
          {currentScheme ? `方案: ${currentScheme.name}` : '未保存方案'}
        </p>
      </div>
    </div>
  );
}

export default App;
