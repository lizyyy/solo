import React, { useEffect, useCallback } from 'react';
import { Stage3DView } from './Stage3DView';
import { TimelineControls } from './TimelineControls';
import { RiskPanel } from './RiskPanel';
import { PropertyPanel } from './PropertyPanel';
import { ImportDialog } from './ImportDialog';
import { ExportDialog } from './ExportDialog';
import { useStore } from '@/store';
import type { StageProject, LightFixture, Rig, Actor } from '@/types';
import { Upload, Download, AlertTriangle, RotateCcw } from 'lucide-react';

export const App: React.FC = () => {
  const {
    project,
    timeline,
    ui,
    currentRisks,
    adjustments,
    setCurrentTime,
    togglePlay,
    setPlaySpeed,
    stepForward,
    stepBackward,
    selectLight,
    selectRig,
    selectActor,
    toggleRisksPanel,
    toggleImportDialog,
    toggleExportDialog,
    updateLightAngle,
    updateRigHeight,
    updateLightIntensity,
    loadProject,
    updateProject,
    resetProject,
    evaluateCurrentRisks,
  } = useStore();

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const state = useStore.getState();
      if (state.timeline.isPlaying) {
        const delta = (currentTime - lastTime) / 1000;
        const newTime = Math.min(
          state.timeline.totalDuration,
          state.timeline.currentTime + delta * state.timeline.playSpeed
        );

        if (newTime >= state.timeline.totalDuration) {
          useStore.setState({
            timeline: { ...state.timeline, currentTime: 0, isPlaying: false },
          });
        } else {
          useStore.setState({
            timeline: { ...state.timeline, currentTime: newTime },
          });
          evaluateCurrentRisks();
        }
      }

      lastTime = currentTime;
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    evaluateCurrentRisks();
  }, [timeline.currentTime, project]);

  const handleSelect = useCallback(
    (type: 'light' | 'rig' | 'actor', id: string) => {
      switch (type) {
        case 'light':
          selectLight(id);
          break;
        case 'rig':
          selectRig(id);
          break;
        case 'actor':
          selectActor(id);
          break;
      }
    },
    [selectLight, selectRig, selectActor]
  );

  const handleImportProject = useCallback(
    (importedProject: StageProject) => {
      loadProject(importedProject);
    },
    [loadProject]
  );

  const handleImportData = useCallback(
    (data: Record<string, unknown>) => {
      updateProject(data as Partial<StageProject>);
    },
    [updateProject]
  );

  const getSelectedItem = (): LightFixture | Rig | Actor | null => {
    if (ui.selectedLightId) {
      return project.lights.find((l) => l.id === ui.selectedLightId) || null;
    }
    if (ui.selectedRigId) {
      return project.rigs.find((r) => r.id === ui.selectedRigId) || null;
    }
    if (ui.selectedActorId) {
      return project.actors.find((a) => a.id === ui.selectedActorId) || null;
    }
    return null;
  };

  const selectedType = ui.selectedLightId
    ? 'light'
    : ui.selectedRigId
    ? 'rig'
    : ui.selectedActorId
    ? 'actor'
    : null;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f0f1a',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <header
        style={{
          height: '56px',
          backgroundColor: '#16213e',
          borderBottom: '1px solid #2a3a5a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#e94560',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={20} color="white" />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: '#e94560',
              }}
            >
              灯位安全预演台
            </h1>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: '11px',
                color: '#666688',
              }}
            >
              {project.name}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleImportDialog}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #2a3a5a',
              borderRadius: '6px',
              color: '#aaaacc',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(233, 69, 96, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a2e';
              e.currentTarget.style.borderColor = '#2a3a5a';
            }}
          >
            <Upload size={16} />
            导入
          </button>

          <button
            onClick={toggleExportDialog}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #2a3a5a',
              borderRadius: '6px',
              color: '#aaaacc',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(233, 69, 96, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(233, 69, 96, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a2e';
              e.currentTarget.style.borderColor = '#2a3a5a';
            }}
          >
            <Download size={16} />
            导出
          </button>

          <button
            onClick={resetProject}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              backgroundColor: '#1a1a2e',
              border: '1px solid #2a3a5a',
              borderRadius: '6px',
              color: '#aaaacc',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 170, 0, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 170, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a2e';
              e.currentTarget.style.borderColor = '#2a3a5a';
            }}
          >
            <RotateCcw size={16} />
            重置
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <PropertyPanel
          selectedType={selectedType}
          selectedItem={getSelectedItem()}
          onUpdateLightAngle={updateLightAngle}
          onUpdateRigHeight={updateRigHeight}
          onUpdateLightIntensity={updateLightIntensity}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <Stage3DView
              project={project}
              currentTime={timeline.currentTime}
              currentRisks={currentRisks}
              selectedType={selectedType}
              selectedId={
                ui.selectedLightId || ui.selectedRigId || ui.selectedActorId || null
              }
              onSelect={handleSelect}
            />
          </div>

          <TimelineControls
            currentTime={timeline.currentTime}
            totalDuration={timeline.totalDuration}
            isPlaying={timeline.isPlaying}
            playSpeed={timeline.playSpeed}
            onPlayPause={togglePlay}
            onSeek={setCurrentTime}
            onStepForward={stepForward}
            onStepBackward={stepBackward}
            onSpeedChange={setPlaySpeed}
          />
        </div>
      </div>

      <RiskPanel
        risks={currentRisks}
        isOpen={ui.showRisksPanel}
        onToggle={toggleRisksPanel}
        onJumpToTime={setCurrentTime}
      />

      <ImportDialog
        isOpen={ui.showImportDialog}
        onClose={toggleImportDialog}
        onImportProject={handleImportProject}
        onImportData={handleImportData}
      />

      <ExportDialog
        isOpen={ui.showExportDialog}
        onClose={toggleExportDialog}
        project={project}
        adjustments={adjustments}
      />
    </div>
  );
};
