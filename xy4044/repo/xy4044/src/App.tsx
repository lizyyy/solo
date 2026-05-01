import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Session, Source, Event, CalibrationResult, Problem, SyncIssue, PlaybackState } from './types';
import { createSession, getSourceTypeLabel } from './models';
import { runCalibration } from './calibration';
import { saveSessionToStorage, loadSessionFromStorage, importSessionFromJSON, downloadSession, loadFileFromInput } from './storage';
import { downloadMarkdownReport, downloadDelayOffsetCSV, downloadEventsCSV } from './reports';
import { generateSampleSession, sampleScenarios } from './sampleData';
import { PlaybackController, PlaybackLogEntry } from './playback';
import { detectSyncIssues, applyOffsetsToEvents, calculateTimelineBounds } from './timeline';
import SourceList from './components/SourceList';
import TimelineView from './components/TimelineView';
import ResultsPanel from './components/ResultsPanel';
import ImportModal from './components/ImportModal';
import SourceModal from './components/SourceModal';
import ManualAnchorModal from './components/ManualAnchorModal';

const App: React.FC = () => {
  const [session, setSession] = useState<Session>(() => {
    const saved = loadSessionFromStorage();
    return saved || createSession({
      name: '新建校准会话',
      description: '添加源和事件后开始校准'
    });
  });

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    speed: 1.0
  });

  const [playbackLogs, setPlaybackLogs] = useState<PlaybackLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'results' | 'problems' | 'logs'>('results');
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const playbackControllerRef = useRef<PlaybackController | null>(null);

  useEffect(() => {
    saveSessionToStorage(session);
  }, [session]);

  useEffect(() => {
    const bounds = calculateTimelineBounds(session.events);
    
    if (!playbackControllerRef.current) {
      playbackControllerRef.current = new PlaybackController();
    }

    playbackControllerRef.current.setDataSource(
      session.events,
      session.sources,
      session.calibrationResults,
      session.syncIssues
    );

    playbackControllerRef.current.setStateChangeCallback((state) => {
      setPlaybackState(state);
    });

    playbackControllerRef.current.setLogEntryCallback((entry) => {
      setPlaybackLogs(prev => [...prev, entry]);
    });

    setPlaybackState(prev => ({
      ...prev,
      duration: bounds.duration
    }));
  }, [session.events, session.sources, session.calibrationResults, session.syncIssues]);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleAddSource = useCallback((source: Source) => {
    setSession(prev => ({
      ...prev,
      sources: [...prev.sources, source]
    }));
    setShowSourceModal(false);
    showNotification('源已添加', 'success');
  }, [showNotification]);

  const handleUpdateSource = useCallback((source: Source) => {
    setSession(prev => ({
      ...prev,
      sources: prev.sources.map(s => s.id === source.id ? source : s)
    }));
    setShowSourceModal(false);
    setEditingSource(null);
    showNotification('源已更新', 'success');
  }, [showNotification]);

  const handleDeleteSource = useCallback((sourceId: string) => {
    setSession(prev => ({
      ...prev,
      sources: prev.sources.filter(s => s.id !== sourceId),
      events: prev.events.filter(e => e.sourceId !== sourceId),
      calibrationResults: prev.calibrationResults.filter(r => r.sourceId !== sourceId),
      problems: prev.problems.filter(p => p.sourceId !== sourceId),
      importLogs: prev.importLogs.filter(l => l.sourceId !== sourceId),
      masterClockSourceId: prev.masterClockSourceId === sourceId ? undefined : prev.masterClockSourceId
    }));
    showNotification('源已删除', 'info');
  }, [showNotification]);

  const handleSetMasterClock = useCallback((sourceId: string) => {
    setSession(prev => ({
      ...prev,
      masterClockSourceId: sourceId
    }));
    showNotification('已设为主时钟源', 'success');
  }, [showNotification]);

  const handleAddAnchor = useCallback((event: Event) => {
    setSession(prev => ({
      ...prev,
      events: [...prev.events, event]
    }));
    setShowAnchorModal(false);
    showNotification('锚点已添加', 'success');
  }, [showNotification]);

  const handleRunCalibration = useCallback(() => {
    const { results, problems, masterSourceId } = runCalibration(
      session.sources,
      session.events,
      session.masterClockSourceId
    );

    const eventsWithOffset = applyOffsetsToEvents(session.events, results);
    const syncIssues = detectSyncIssues(
      eventsWithOffset,
      session.sources.filter(s => s.isInMix),
      30
    );

    setSession(prev => ({
      ...prev,
      calibrationResults: results,
      problems: problems,
      syncIssues: syncIssues,
      masterClockSourceId: masterSourceId || prev.masterClockSourceId
    }));

    showNotification(`校准完成: ${results.length} 个源已处理`, 'success');
  }, [session.sources, session.events, session.masterClockSourceId, showNotification]);

  const handleManualOverride = useCallback((sourceId: string, newDelay: number) => {
    setSession(prev => {
      const existingResult = prev.calibrationResults.find(r => r.sourceId === sourceId);
      
      const newResult = {
        ...existingResult,
        sourceId,
        delayOffset: newDelay,
        confidence: 1.0,
        confidenceLevel: 'very_high' as const,
        evidence: existingResult?.evidence || [],
        isManualOverride: true,
        calculatedAt: Date.now()
      };

      const newResults = prev.calibrationResults.some(r => r.sourceId === sourceId)
        ? prev.calibrationResults.map(r => r.sourceId === sourceId ? newResult : r)
        : [...prev.calibrationResults, newResult];

      return {
        ...prev,
        calibrationResults: newResults
      };
    });
    showNotification('已手动覆盖校准结果', 'success');
  }, [showNotification]);

  const handleResolveProblem = useCallback((problemId: string) => {
    setSession(prev => ({
      ...prev,
      problems: prev.problems.map(p => 
        p.id === problemId ? { ...p, resolved: true } : p
      )
    }));
    showNotification('问题已标记为已解决', 'info');
  }, [showNotification]);

  const handleImportSession = useCallback(async (file: File) => {
    try {
      const content = await loadFileFromInput(file);
      const result = importSessionFromJSON(content);

      if (result.success && result.data) {
        setSession(prev => ({
          ...result.data!,
          id: prev.id,
          createdAt: prev.createdAt
        }));
        showNotification('会话导入成功', 'success');
      } else {
        const errorMsg = result.errors.map(e => e.message).join('\n');
        showNotification(`导入失败: ${errorMsg}`, 'error');
      }
    } catch (error) {
      showNotification('读取文件失败', 'error');
    }
    setShowImportModal(false);
  }, [showNotification]);

  const handleLoadSampleData = useCallback((index: number) => {
    const scenario = sampleScenarios[index]();
    const sampleSession = generateSampleSession(scenario);
    setSession(sampleSession);
    showNotification(`已加载 ${scenario.name}`, 'success');
  }, [showNotification]);

  const handlePlayPause = useCallback(() => {
    if (playbackControllerRef.current) {
      playbackControllerRef.current.togglePlayPause();
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    if (playbackControllerRef.current) {
      playbackControllerRef.current.seek(time);
    }
  }, []);

  const handleSetSpeed = useCallback((speed: number) => {
    if (playbackControllerRef.current) {
      playbackControllerRef.current.setSpeed(speed);
    }
  }, []);

  const handleNewSession = useCallback(() => {
    setSession(createSession({
      name: '新建校准会话',
      description: '添加源和事件后开始校准'
    }));
    setPlaybackLogs([]);
    showNotification('已创建新会话', 'info');
  }, [showNotification]);

  const handleExportSession = useCallback(() => {
    downloadSession(session);
    showNotification('会话已导出', 'success');
  }, [session, showNotification]);

  const handleExportReport = useCallback(() => {
    downloadMarkdownReport(session);
    showNotification('报告已导出', 'success');
  }, [session, showNotification]);

  const handleExportCSV = useCallback(() => {
    downloadDelayOffsetCSV(session);
    showNotification('CSV偏移表已导出', 'success');
  }, [session, showNotification]);

  const handleExportEventsCSV = useCallback(() => {
    downloadEventsCSV(session);
    showNotification('事件CSV已导出', 'success');
  }, [session, showNotification]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-title">
          <h1>🎛️ 多路音视频延迟校准台</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {session.name}
          </span>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary btn-small"
            onClick={() => setShowAnchorModal(true)}
          >
            ➕ 添加锚点
          </button>
          <button 
            className="btn btn-secondary btn-small"
            onClick={() => setShowSourceModal(true)}
          >
            ➕ 添加源
          </button>
          <button 
            className="btn btn-secondary btn-small"
            onClick={() => setShowImportModal(true)}
          >
            📥 导入
          </button>
          <button 
            className="btn btn-secondary btn-small"
            onClick={handleExportSession}
          >
            📤 导出
          </button>
          <button 
            className="btn btn-success btn-small"
            onClick={handleRunCalibration}
            disabled={session.events.length === 0 || session.sources.length === 0}
          >
            🔍 自动校准
          </button>
        </div>
      </header>

      <div className="main-layout">
        <div className="panel left-panel">
          <div className="panel-header">
            <h2>输入源 ({session.sources.length})</h2>
            <button 
              className="btn btn-icon btn-small"
              onClick={() => setShowSourceModal(true)}
              title="添加源"
            >
              ➕
            </button>
          </div>
          <div className="panel-content">
            <SourceList
              sources={session.sources}
              calibrationResults={session.calibrationResults}
              masterClockSourceId={session.masterClockSourceId}
              onEdit={(source) => {
                setEditingSource(source);
                setShowSourceModal(true);
              }}
              onDelete={handleDeleteSource}
              onSetMasterClock={handleSetMasterClock}
            />
          </div>
        </div>

        <div className="panel center-panel">
          <TimelineView
            sources={session.sources}
            events={session.events}
            calibrationResults={session.calibrationResults}
            playbackState={playbackState}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onSetSpeed={handleSetSpeed}
          />
        </div>

        <div className="panel right-panel">
          <div className="panel-header">
            <div className="tabs">
              <div 
                className={`tab ${activeTab === 'results' ? 'active' : ''}`}
                onClick={() => setActiveTab('results')}
              >
                校准结果
                {session.calibrationResults.length > 0 && (
                  <span className="badge">{session.calibrationResults.length}</span>
                )}
              </div>
              <div 
                className={`tab ${activeTab === 'problems' ? 'active' : ''}`}
                onClick={() => setActiveTab('problems')}
              >
                问题
                {session.problems.filter(p => !p.resolved).length > 0 && (
                  <span className="badge">{session.problems.filter(p => !p.resolved).length}</span>
                )}
              </div>
              <div 
                className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                回放日志
              </div>
            </div>
          </div>
          <div className="panel-content">
            <ResultsPanel
              activeTab={activeTab}
              sources={session.sources}
              calibrationResults={session.calibrationResults}
              problems={session.problems}
              playbackLogs={playbackLogs}
              masterClockSourceId={session.masterClockSourceId}
              onManualOverride={handleManualOverride}
              onResolveProblem={handleResolveProblem}
              onExportReport={handleExportReport}
              onExportCSV={handleExportCSV}
              onExportEventsCSV={handleExportEventsCSV}
              onNewSession={handleNewSession}
              onLoadSampleData={handleLoadSampleData}
            />
          </div>
        </div>
      </div>

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportSession}
        />
      )}

      {showSourceModal && (
        <SourceModal
          source={editingSource}
          onClose={() => {
            setShowSourceModal(false);
            setEditingSource(null);
          }}
          onSave={editingSource ? handleUpdateSource : handleAddSource}
        />
      )}

      {showAnchorModal && (
        <ManualAnchorModal
          sources={session.sources}
          onClose={() => setShowAnchorModal(false)}
          onSave={handleAddAnchor}
        />
      )}

      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: notification.type === 'success' 
            ? 'var(--accent-success)'
            : notification.type === 'error'
            ? 'var(--accent-primary)'
            : 'var(--accent-secondary)',
          color: 'white',
          fontSize: '13px',
          fontWeight: 500,
          zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default App;
