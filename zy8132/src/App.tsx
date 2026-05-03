import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { FileImporter } from './components/FileImporter';
import { Timeline } from './components/Timeline';
import { SubtitleList } from './components/SubtitleList';
import { SubtitleEditor } from './components/SubtitleEditor';
import { ExportPanel } from './components/ExportPanel';
import { Subtitle } from './types';
import './App.css';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  const handleSelectSubtitle = (subtitle: Subtitle) => {
    setSelectedSubtitle(subtitle);
    dispatch({ type: 'SELECT_SUBTITLE', payload: subtitle.id });
  };

  const handleLoadSample = () => {
    setShowWelcome(false);
  };

  const hasData = state.subtitles.length > 0 && state.audioMarkers.length > 0;

  if (showWelcome && !hasData) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>离线字幕对齐复核器</h1>
          <p className="app-subtitle">Subtitle Alignment Verifier</p>
        </header>
        
        <main className="app-main">
          <div className="welcome-section">
            <div className="welcome-content">
              <h2>欢迎使用字幕对齐复核器</h2>
              <p className="welcome-desc">
                这是一个专为字幕制作同事设计的离线工具，帮助您快速检查和修正字幕时间与音频标记的对齐问题。
              </p>
              
              <div className="feature-grid">
                <div className="feature-item">
                  <span className="feature-icon">🔍</span>
                  <h4>智能校验</h4>
                  <p>自动检测字幕与静音/说话区间的错位</p>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📊</span>
                  <h4>可视化时间轴</h4>
                  <p>可拖拽时间轴，直观展示各元素</p>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">✏️</span>
                  <h4>逐条修正</h4>
                  <p>方便的编辑界面，支持自动修正</p>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📝</span>
                  <h4>导出报告</h4>
                  <p>生成复核报告和修正后的字幕</p>
                </div>
              </div>

              <div className="start-actions">
                <FileImporter onLoadSample={handleLoadSample} />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1>离线字幕对齐复核器</h1>
          <div className="header-stats">
            {state.subtitles.length > 0 && (
              <span className="stat-chip">
                📝 {state.subtitles.length} 条字幕
              </span>
            )}
            {state.validationIssues.length > 0 && (
              <span className="stat-chip warning">
                ⚠️ {state.validationIssues.length} 个问题
              </span>
            )}
            {state.subtitles.filter(s => s.isModified).length > 0 && (
              <span className="stat-chip modified">
                ✏️ {state.subtitles.filter(s => s.isModified).length} 已修改
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <FileImporter onLoadSample={handleLoadSample} />
        </div>
      </header>

      <main className="app-main">
        <div className="main-layout">
          <div className="timeline-section">
            <Timeline onSelectSubtitle={handleSelectSubtitle} />
          </div>

          <div className="content-section">
            <div className="left-panel">
              <SubtitleList onSelectSubtitle={handleSelectSubtitle} />
            </div>
            
            <div className="right-panel">
              <div className="editor-panel">
                <SubtitleEditor subtitle={selectedSubtitle} />
              </div>
              <div className="export-panel">
                <ExportPanel />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
