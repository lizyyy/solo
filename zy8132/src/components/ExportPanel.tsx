import React from 'react';
import { useAppContext } from '../context/AppContext';
import { exportSubtitlesAsSRT, exportReviewReport, downloadFile } from '../exporters/exporter';
import './ExportPanel.css';

export function ExportPanel() {
  const { state, dispatch } = useAppContext();

  const canExport = state.subtitles.length > 0;

  const handleExportSRT = () => {
    if (!canExport) return;
    const content = exportSubtitlesAsSRT(state.subtitles);
    const filename = state.projectName 
      ? `${state.projectName}_corrected.srt`
      : 'corrected_subtitles.srt';
    downloadFile(content, filename, 'application/x-subrip');
  };

  const handleExportReport = () => {
    if (!canExport) return;
    const content = exportReviewReport(state, {
      includeSubtitleDetails: true,
      includeTimeline: true,
    });
    const filename = state.projectName
      ? `${state.projectName}_review_report.md`
      : 'review_report.md';
    downloadFile(content, filename, 'text/markdown');
  };

  const handleAutoFixAll = () => {
    dispatch({ type: 'AUTO_FIX_ALL' });
  };

  const handleResetProject = () => {
    if (confirm('确定要重置项目吗？所有修改将丢失。')) {
      dispatch({ type: 'RESET_PROJECT' });
    }
  };

  const handleReValidate = () => {
    dispatch({ type: 'VALIDATE' });
  };

  const issueStats = {
    errors: state.validationIssues.filter(i => i.severity === 'error').length,
    warnings: state.validationIssues.filter(i => i.severity === 'warning').length,
    infos: state.validationIssues.filter(i => i.severity === 'info').length,
  };

  const modifiedCount = state.subtitles.filter(s => s.isModified).length;

  return (
    <div className="export-panel">
      <div className="panel-section">
        <h3>项目统计</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{state.subtitles.length}</span>
            <span className="stat-label">字幕总数</span>
          </div>
          <div className="stat-item modified">
            <span className="stat-value">{modifiedCount}</span>
            <span className="stat-label">已修改</span>
          </div>
          <div className="stat-item errors">
            <span className="stat-value">{issueStats.errors}</span>
            <span className="stat-label">错误</span>
          </div>
          <div className="stat-item warnings">
            <span className="stat-value">{issueStats.warnings}</span>
            <span className="stat-label">警告</span>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <h3>操作</h3>
        <div className="action-buttons">
          <button
            onClick={handleReValidate}
            className="action-btn secondary"
            disabled={!canExport}
          >
            🔍 重新校验
          </button>
          <button
            onClick={handleAutoFixAll}
            className="action-btn auto-fix"
            disabled={!canExport || state.validationIssues.length === 0}
          >
            🔧 自动全部修正
          </button>
          <button
            onClick={handleResetProject}
            className="action-btn danger"
          >
            🗑️ 重置项目
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h3>导出</h3>
        <div className="export-buttons">
          <button
            onClick={handleExportSRT}
            className="export-btn primary"
            disabled={!canExport}
          >
            <span className="btn-icon">📝</span>
            <div className="btn-text">
              <span className="btn-title">导出 SRT</span>
              <span className="btn-desc">修正后的字幕文件</span>
            </div>
          </button>
          <button
            onClick={handleExportReport}
            className="export-btn secondary"
            disabled={!canExport}
          >
            <span className="btn-icon">📊</span>
            <div className="btn-text">
              <span className="btn-title">导出报告</span>
              <span className="btn-desc">复核报告 (Markdown)</span>
            </div>
          </button>
        </div>
      </div>

      {state.isModified && (
        <div className="save-indicator">
          <span className="indicator-dot"></span>
          <span>有未保存的更改 (自动保存中)</span>
        </div>
      )}
    </div>
  );
}
