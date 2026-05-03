import React, { useCallback, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { 
  getCueStartTime, 
  getCueEndTime, 
  getCueFadeInPeriod, 
  getCueFadeOutPeriod 
} from '../../shared/models';

interface CueEditorProps {
  className?: string;
}

export const CueEditor: React.FC<CueEditorProps> = ({ className }) => {
  const { state, updateCue } = useApp();
  const { selectedCueId, project } = state;
  
  const selectedCue = project.cues.find(c => c.id === selectedCueId);
  
  const initialRender = useRef(true);

  useEffect(() => {
    initialRender.current = true;
  }, [selectedCueId]);

  const handleChange = useCallback((field: string, value: any) => {
    if (!selectedCueId || selectedCue?.isLocked) return;
    
    let processedValue = value;
    
    if (['time', 'fadeIn', 'fadeOut', 'delay'].includes(field)) {
      processedValue = parseFloat(value) || 0;
    }
    
    updateCue(selectedCueId, { [field]: processedValue });
  }, [selectedCueId, selectedCue, updateCue]);

  const handleToggleFixture = useCallback((fixtureId: string) => {
    if (!selectedCueId || selectedCue?.isLocked) return;
    
    const currentFixtures = selectedCue?.activeFixtures || [];
    const newFixtures = currentFixtures.includes(fixtureId)
      ? currentFixtures.filter(id => id !== fixtureId)
      : [...currentFixtures, fixtureId];
    
    updateCue(selectedCueId, { activeFixtures: newFixtures });
  }, [selectedCueId, selectedCue, updateCue]);

  const handleSelectAllFixtures = useCallback(() => {
    if (!selectedCueId || selectedCue?.isLocked) return;
    
    const allFixtureIds = project.fixtures.map(f => f.id);
    updateCue(selectedCueId, { activeFixtures: allFixtureIds });
  }, [selectedCueId, selectedCue, project.fixtures, updateCue]);

  const handleClearFixtures = useCallback(() => {
    if (!selectedCueId || selectedCue?.isLocked) return;
    updateCue(selectedCueId, { activeFixtures: [] });
  }, [selectedCueId, selectedCue, updateCue]);

  if (!selectedCue) {
    return (
      <div className={`cue-editor-container ${className || ''}`}>
        <div className="cue-editor-empty">
          <div className="empty-icon">🎭</div>
          <h3>选择一个 Cue 进行编辑</h3>
          <p>从时间轴或 Cue 列表中点击选择一个 Cue</p>
        </div>

        <style>{`
          .cue-editor-container {
            display: flex;
            flex-direction: column;
            background-color: var(--bg-secondary);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            height: 100%;
          }

          .cue-editor-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            text-align: center;
          }

          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
          }

          .cue-editor-empty h3 {
            font-size: 16px;
            margin-bottom: 8px;
            color: var(--text-secondary);
          }

          .cue-editor-empty p {
            font-size: 13px;
            color: var(--text-secondary);
          }
        `}</style>
      </div>
    );
  }

  const startTime = getCueStartTime(selectedCue);
  const endTime = getCueEndTime(selectedCue);
  const fadeInPeriod = getCueFadeInPeriod(selectedCue);
  const fadeOutPeriod = getCueFadeOutPeriod(selectedCue);
  const duration = endTime - startTime;

  const isLocked = selectedCue.isLocked;

  return (
    <div className={`cue-editor-container ${className || ''}`}>
      <div className="cue-editor-header">
        <div className="header-left">
          <span className="cue-number-badge">{selectedCue.number}</span>
          <input
            type="text"
            className="cue-name-input"
            value={selectedCue.name}
            onChange={(e) => handleChange('name', e.target.value)}
            disabled={isLocked}
            placeholder="Cue 名称"
          />
        </div>
        <div className="header-right">
          {isLocked && (
            <span className="locked-badge">🔒 已锁定</span>
          )}
          {selectedCue.isBlackout && (
            <span className="blackout-badge">🌑 黑场</span>
          )}
        </div>
      </div>

      <div className="cue-editor-content">
        <div className="editor-section">
          <h4>时间设置</h4>
          <div className="time-grid">
            <div className="form-group">
              <label>触发时间 (s)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedCue.time}
                onChange={(e) => handleChange('time', e.target.value)}
                disabled={isLocked}
              />
            </div>
            <div className="form-group">
              <label>延迟 (s)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedCue.delay}
                onChange={(e) => handleChange('delay', e.target.value)}
                disabled={isLocked}
              />
            </div>
            <div className="form-group">
              <label>淡入 (s)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedCue.fadeIn}
                onChange={(e) => handleChange('fadeIn', e.target.value)}
                disabled={isLocked}
              />
            </div>
            <div className="form-group">
              <label>淡出 (s)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={selectedCue.fadeOut}
                onChange={(e) => handleChange('fadeOut', e.target.value)}
                disabled={isLocked}
              />
            </div>
          </div>
        </div>

        <div className="editor-section">
          <h4>时间线预览</h4>
          <div className="timeline-preview">
            <div className="timeline-preview-row">
              <span className="preview-label">实际起始:</span>
              <span className="preview-value">{startTime.toFixed(2)}s</span>
            </div>
            <div className="timeline-preview-row">
              <span className="preview-label">实际结束:</span>
              <span className="preview-value">{endTime.toFixed(2)}s</span>
            </div>
            <div className="timeline-preview-row">
              <span className="preview-label">持续时间:</span>
              <span className="preview-value">{duration.toFixed(2)}s</span>
            </div>
            <div className="timeline-visual">
              <div 
                className="timeline-bar"
                style={{
                  background: `linear-gradient(90deg, 
                    ${selectedCue.fadeIn > 0 ? 'rgba(74, 222, 128, 0.6)' : 'var(--accent-primary)'} 0%, 
                    var(--accent-primary) ${selectedCue.fadeIn > 0 ? (selectedCue.fadeIn / duration * 100) : 0}%, 
                    var(--accent-primary) ${selectedCue.fadeOut > 0 ? (1 - selectedCue.fadeOut / duration) * 100 : 100}%, 
                    ${selectedCue.fadeOut > 0 ? 'rgba(248, 113, 113, 0.6)' : 'var(--accent-primary)'} 100%
                  )`
                }}
              />
              {selectedCue.fadeIn > 0 && (
                <div className="fade-marker fade-in-marker" style={{ left: '0' }}>
                  淡入 {selectedCue.fadeIn}s
                </div>
              )}
              {selectedCue.fadeOut > 0 && (
                <div className="fade-marker fade-out-marker" style={{ right: '0' }}>
                  淡出 {selectedCue.fadeOut}s
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="editor-section">
          <div className="section-header">
            <h4>活跃灯具 ({selectedCue.activeFixtures.length}/{project.fixtures.length})</h4>
            <div className="fixture-actions">
              <button
                className="btn btn-sm"
                onClick={handleSelectAllFixtures}
                disabled={isLocked}
              >
                全选
              </button>
              <button
                className="btn btn-sm"
                onClick={handleClearFixtures}
                disabled={isLocked}
              >
                清空
              </button>
            </div>
          </div>
          
          <div className="fixture-list">
            {project.fixtures.length === 0 ? (
              <div className="no-fixtures">
                暂无灯具，请先导入或添加灯具
              </div>
            ) : (
              project.fixtures.map((fixture) => {
                const isActive = selectedCue.activeFixtures.includes(fixture.id);
                return (
                  <div
                    key={fixture.id}
                    className={`fixture-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleToggleFixture(fixture.id)}
                  >
                    <div className="fixture-checkbox">
                      {isActive ? '✓' : ''}
                    </div>
                    <div className="fixture-info">
                      <span className="fixture-name">{fixture.name}</span>
                      <span className="fixture-meta">
                        {fixture.channelCount}ch · {fixture.power}{fixture.powerUnit}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="editor-section">
          <h4>备注</h4>
          <textarea
            className="notes-textarea"
            value={selectedCue.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            disabled={isLocked}
            placeholder="添加备注..."
            rows={3}
          />
        </div>
      </div>

      <style>{`
        .cue-editor-container {
          display: flex;
          flex-direction: column;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          height: 100%;
          overflow: hidden;
        }

        .cue-editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background-color: var(--bg-tertiary);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .cue-number-badge {
          padding: 4px 12px;
          background-color: var(--accent-primary);
          border-radius: 4px;
          font-weight: 700;
          font-size: 14px;
        }

        .cue-name-input {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          border: none;
          background: transparent;
          padding: 4px 8px;
        }

        .cue-name-input:focus {
          background-color: var(--bg-primary);
        }

        .cue-name-input:disabled {
          opacity: 0.7;
        }

        .header-right {
          display: flex;
          gap: 8px;
        }

        .locked-badge, .blackout-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .locked-badge {
          background-color: rgba(96, 165, 250, 0.2);
          color: var(--info);
        }

        .blackout-badge {
          background-color: rgba(0, 0, 0, 0.5);
          color: var(--text-primary);
        }

        .cue-editor-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .editor-section {
          margin-bottom: 20px;
        }

        .editor-section:last-child {
          margin-bottom: 0;
        }

        .editor-section h4 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .section-header h4 {
          margin-bottom: 0;
        }

        .fixture-actions {
          display: flex;
          gap: 8px;
        }

        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
        }

        .time-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .form-group label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .form-group input {
          font-size: 13px;
        }

        .form-group input:disabled {
          opacity: 0.5;
        }

        .timeline-preview {
          background-color: var(--bg-tertiary);
          border-radius: 6px;
          padding: 12px;
        }

        .timeline-preview-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .preview-label {
          color: var(--text-secondary);
        }

        .preview-value {
          font-weight: 500;
        }

        .timeline-visual {
          position: relative;
          height: 40px;
          margin-top: 12px;
          background-color: var(--bg-primary);
          border-radius: 4px;
          overflow: hidden;
        }

        .timeline-bar {
          position: absolute;
          top: 8px;
          left: 4px;
          right: 4px;
          height: 24px;
          border-radius: 4px;
        }

        .fade-marker {
          position: absolute;
          top: 2px;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 600;
        }

        .fade-in-marker {
          background-color: rgba(74, 222, 128, 0.3);
          color: var(--success);
        }

        .fade-out-marker {
          background-color: rgba(248, 113, 113, 0.3);
          color: var(--error);
        }

        .fixture-list {
          max-height: 200px;
          overflow-y: auto;
          background-color: var(--bg-tertiary);
          border-radius: 6px;
        }

        .no-fixtures {
          padding: 20px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .fixture-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .fixture-item:last-child {
          border-bottom: none;
        }

        .fixture-item:hover {
          background-color: var(--bg-hover);
        }

        .fixture-item.active {
          background-color: rgba(233, 69, 96, 0.1);
        }

        .fixture-checkbox {
          width: 20px;
          height: 20px;
          border: 2px solid var(--border-color);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
        }

        .fixture-item.active .fixture-checkbox {
          background-color: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .fixture-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .fixture-name {
          font-size: 13px;
          font-weight: 500;
        }

        .fixture-meta {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .notes-textarea {
          width: 100%;
          resize: vertical;
          min-height: 60px;
        }

        .notes-textarea:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
};
