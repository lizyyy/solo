import React, { useState } from 'react';
import { Source, CalibrationResult, Problem } from '../types';
import { getEventTypeLabel, getConfidenceLabel, getProblemTypeLabel, getSeverityLabel } from '../models';
import { getSourceDelayInfo } from '../timeline';
import { PlaybackLogEntry } from '../playback';
import { sampleScenarios } from '../sampleData';

interface ResultsPanelProps {
  activeTab: 'results' | 'problems' | 'logs';
  sources: Source[];
  calibrationResults: CalibrationResult[];
  problems: Problem[];
  playbackLogs: PlaybackLogEntry[];
  masterClockSourceId?: string;
  onManualOverride: (sourceId: string, newDelay: number) => void;
  onResolveProblem: (problemId: string) => void;
  onExportReport: () => void;
  onExportCSV: () => void;
  onExportEventsCSV: () => void;
  onNewSession: () => void;
  onLoadSampleData: (index: number) => void;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({
  activeTab,
  sources,
  calibrationResults,
  problems,
  playbackLogs,
  masterClockSourceId,
  onManualOverride,
  onResolveProblem,
  onExportReport,
  onExportCSV,
  onExportEventsCSV,
  onNewSession,
  onLoadSampleData
}) => {
  const [overrideSourceId, setOverrideSourceId] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [showEvidenceSource, setShowEvidenceSource] = useState<string | null>(null);

  const getSourceName = (sourceId: string): string => {
    const source = sources.find(s => s.id === sourceId);
    return source?.name || sourceId;
  };

  if (activeTab === 'results') {
    if (calibrationResults.length === 0 && sources.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">等待校准</div>
          <div className="empty-state-text" style={{ marginBottom: '16px' }}>
            添加源和事件后，点击 "自动校准" 按钮来计算延迟偏移。
          </div>
          
          <div className="divider" style={{ width: '100%' }} />
          
          <div style={{ width: '100%', marginTop: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              快速开始：加载示例数据
            </div>
            {sampleScenarios.map((scenario, index) => {
              const scenarioData = scenario();
              return (
                <button
                  key={index}
                  className="btn btn-secondary btn-small"
                  style={{ width: '100%', marginBottom: '8px', justifyContent: 'flex-start' }}
                  onClick={() => onLoadSampleData(index)}
                >
                  🎵 {scenarioData.name}
                </button>
              );
            })}
          </div>

          <div className="divider" style={{ width: '100%', marginTop: '16px' }} />
          
          <div style={{ width: '100%', marginTop: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              导出选项
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-secondary btn-small"
                onClick={onNewSession}
              >
                🆕 新建会话
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (calibrationResults.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">请运行校准</div>
          <div className="empty-state-text">
            已添加 {sources.length} 个源和 {sources.length > 0 ? '事件' : '请添加事件'}。
            点击顶部的 "自动校准" 按钮。
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button 
            className="btn btn-secondary btn-small"
            onClick={onExportReport}
          >
            📄 导出报告
          </button>
          <button 
            className="btn btn-secondary btn-small"
            onClick={onExportCSV}
          >
            📊 导出CSV
          </button>
          <button 
            className="btn btn-secondary btn-small"
            onClick={onExportEventsCSV}
          >
            📋 导出事件
          </button>
        </div>

        {calibrationResults.map(result => {
          const isMaster = result.sourceId === masterClockSourceId;
          const sourceName = getSourceName(result.sourceId);
          const delayInfo = getSourceDelayInfo(result.sourceId, calibrationResults);

          return (
            <div 
              key={result.sourceId}
              className={`calibration-card ${isMaster ? 'master' : ''} ${result.isManualOverride ? 'manual' : ''}`}
            >
              <div className="calibration-header">
                <div className="calibration-name">
                  {sourceName}
                  {isMaster && (
                    <span style={{ 
                      fontSize: '10px', 
                      color: 'var(--accent-success)',
                      marginLeft: '8px'
                    }}>
                      (主时钟)
                    </span>
                  )}
                  {result.isManualOverride && (
                    <span style={{ 
                      fontSize: '10px', 
                      color: 'var(--accent-warning)',
                      marginLeft: '8px'
                    }}>
                      (手动覆盖)
                    </span>
                  )}
                </div>
                <span className={`confidence-badge ${result.confidenceLevel}`}>
                  {getConfidenceLabel(result.confidenceLevel)} ({(result.confidence * 100).toFixed(0)}%)
                </span>
              </div>

              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)',
                marginBottom: '8px'
              }}>
                延迟偏移: <span className={`delay-value ${delayInfo.direction}`}>
                  {delayInfo.readable}
                </span>
              </div>

              {!isMaster && (
                <div style={{ marginTop: '8px' }}>
                  {overrideSourceId === result.sourceId ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '120px', padding: '6px 10px' }}
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(e.target.value)}
                        placeholder="毫秒"
                      />
                      <button
                        className="btn btn-small btn-success"
                        onClick={() => {
                          const value = parseFloat(overrideValue);
                          if (!isNaN(value)) {
                            onManualOverride(result.sourceId, value);
                            setOverrideSourceId(null);
                            setOverrideValue('');
                          }
                        }}
                      >
                        确认
                      </button>
                      <button
                        className="btn btn-small btn-secondary"
                        onClick={() => {
                          setOverrideSourceId(null);
                          setOverrideValue('');
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => {
                        setOverrideSourceId(result.sourceId);
                        setOverrideValue(result.delayOffset.toString());
                      }}
                    >
                      ✏️ 手动覆盖
                    </button>
                  )}
                </div>
              )}

              {result.evidence.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="btn btn-small btn-secondary"
                    style={{ width: '100%' }}
                    onClick={() => setShowEvidenceSource(
                      showEvidenceSource === result.sourceId ? null : result.sourceId
                    )}
                  >
                    {showEvidenceSource === result.sourceId ? '▼' : '▶'} 查看 {result.evidence.length} 个校准证据
                  </button>

                  {showEvidenceSource === result.sourceId && (
                    <div className="evidence-list" style={{ marginTop: '8px' }}>
                      {result.evidence.map((ev, idx) => (
                        <div key={idx} className="evidence-item">
                          <div className="evidence-type">
                            <span style={{ 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%',
                              backgroundColor: 
                                ev.type === 'clap_peak' ? 'var(--accent-primary)' :
                                ev.type === 'flash_frame' ? 'var(--accent-warning)' :
                                ev.type === 'rtp_timestamp' ? 'var(--accent-purple)' :
                                'var(--accent-success)'
                            }} />
                            <span>{getEventTypeLabel(ev.type)}</span>
                          </div>
                          <span className={`evidence-delta ${ev.delta >= 0 ? 'positive' : 'negative'}`}>
                            {ev.delta >= 0 ? '+' : ''}{ev.delta.toFixed(1)}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (activeTab === 'problems') {
    const unresolvedProblems = problems.filter(p => !p.resolved);
    const resolvedProblems = problems.filter(p => p.resolved);

    if (problems.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-title">未检测到问题</div>
          <div className="empty-state-text">
            运行校准后，如果检测到时钟漂移、抖动过大、采样率不一致等问题，将显示在这里。
          </div>
        </div>
      );
    }

    return (
      <div>
        {unresolvedProblems.length > 0 && (
          <div className="results-section">
            <h3>待处理问题 ({unresolvedProblems.length})</h3>
            {unresolvedProblems.map(problem => (
              <div 
                key={problem.id}
                className={`problem-card ${problem.severity}`}
              >
                <div className="problem-header">
                  <span className="problem-type" style={{ 
                    color: problem.severity === 'critical' ? 'var(--accent-primary)' :
                           problem.severity === 'warning' ? 'var(--accent-warning)' :
                           'var(--accent-secondary)'
                  }}>
                    {getProblemTypeLabel(problem.type)}
                  </span>
                  <span className="confidence-badge" style={{
                    backgroundColor: problem.severity === 'critical' ? 'var(--error-bg)' :
                                   problem.severity === 'warning' ? 'var(--warning-bg)' :
                                   'var(--bg-tertiary)',
                    color: problem.severity === 'critical' ? 'var(--accent-primary)' :
                           problem.severity === 'warning' ? 'var(--accent-warning)' :
                           'var(--text-primary)'
                  }}>
                    {getSeverityLabel(problem.severity)}
                  </span>
                </div>
                <div className="problem-message">{problem.message}</div>
                {problem.suggestion && (
                  <div className="problem-suggestion">💡 {problem.suggestion}</div>
                )}
                <div style={{ marginTop: '8px' }}>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={() => onResolveProblem(problem.id)}
                  >
                    ✓ 标记为已解决
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolvedProblems.length > 0 && (
          <div className="results-section">
            <h3>已解决问题 ({resolvedProblems.length})</h3>
            {resolvedProblems.map(problem => (
              <div 
                key={problem.id}
                className="problem-card info"
                style={{ opacity: 0.7 }}
              >
                <div className="problem-header">
                  <span className="problem-type">
                    {getProblemTypeLabel(problem.type)}
                  </span>
                  <span className="confidence-badge" style={{
                    backgroundColor: 'var(--success-bg)',
                    color: 'var(--accent-success)'
                  }}>
                    已解决
                  </span>
                </div>
                <div className="problem-message">{problem.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'logs') {
    if (playbackLogs.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">暂无回放日志</div>
          <div className="empty-state-text">
            启动回放预演后，同步检查结果和事件将记录在这里。
            点击时间线中的播放按钮开始回放。
          </div>
        </div>
      );
    }

    return (
      <div className="event-log">
        {[...playbackLogs].reverse().map((log, index) => (
          <div key={index} className="log-entry">
            <span className="log-time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className={`log-type ${log.type}`}>
              {log.type === 'sync_check' ? '⚡' :
               log.type === 'issue' ? '⚠️' : 'ℹ️'}
            </span>
            <span className="log-message">{log.message}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
};

export default ResultsPanel;
