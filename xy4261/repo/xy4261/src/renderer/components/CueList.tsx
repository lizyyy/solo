import React, { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { Cue } from '../../shared/models/types';
import { 
  getCueStartTime, 
  getCueEndTime, 
  updateCue as updateCueModel,
  createCue
} from '../../shared/models';
import { v4 as uuidv4 } from 'uuid';

interface CueListProps {
  className?: string;
}

export const CueList: React.FC<CueListProps> = ({ className }) => {
  const { state, selectCue, updateCue, addCue, deleteCue } = useApp();
  
  const project = state.project;
  const cues = project.cues;
  const selectedCueId = state.selectedCueId;
  
  const sortedCues = useMemo(() => {
    return [...cues].sort((a, b) => a.time - b.time);
  }, [cues]);

  const handleAddCue = () => {
    const lastTime = sortedCues.length > 0 
      ? getCueEndTime(sortedCues[sortedCues.length - 1]) 
      : 0;
    
    const newCue = createCue(
      `${cues.length + 1}`,
      lastTime + 2,
      {
        name: `新 Cue ${cues.length + 1}`,
        fadeIn: 1,
        fadeOut: 0
      }
    );
    
    addCue(newCue);
    selectCue(newCue.id);
  };

  const handleDeleteCue = (cueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cue = cues.find((c: Cue) => c.id === cueId);
    if (cue?.isLocked) {
      alert('此 Cue 已锁定，无法删除');
      return;
    }
    if (window.confirm(`确定要删除 Cue ${cue?.number} 吗？`)) {
      deleteCue(cueId);
    }
  };

  const handleToggleLock = (cue: Cue, e: React.MouseEvent) => {
    e.stopPropagation();
    updateCue(cue.id, { isLocked: !cue.isLocked });
  };

  const handleToggleBlackout = (cue: Cue, e: React.MouseEvent) => {
    e.stopPropagation();
    updateCue(cue.id, { isBlackout: !cue.isBlackout });
  };

  return (
    <div className={`cue-list-container ${className || ''}`}>
      <div className="cue-list-header">
        <h3>Cue 列表</h3>
        <button className="btn btn-primary" onClick={handleAddCue}>
          + 添加 Cue
        </button>
      </div>

      <div className="cue-list-content">
        {sortedCues.length === 0 ? (
          <div className="empty-state">
            暂无 Cue，点击上方按钮添加或从 CSV 导入
          </div>
        ) : (
          <div className="cue-table">
            <div className="cue-table-header">
              <div className="col-number">#</div>
              <div className="col-name">名称</div>
              <div className="col-time">时间</div>
              <div className="col-fade">淡入/淡出</div>
              <div className="col-fixtures">灯具数</div>
              <div className="col-flags">状态</div>
              <div className="col-actions">操作</div>
            </div>
            
            {sortedCues.map((cue) => {
              const isSelected = cue.id === selectedCueId;
              const startTime = getCueStartTime(cue);
              
              return (
                <div
                  key={cue.id}
                  className={`cue-row ${isSelected ? 'selected' : ''} ${cue.isLocked ? 'locked' : ''}`}
                  onClick={() => selectCue(cue.id)}
                >
                  <div className="col-number">{cue.number}</div>
                  <div className="col-name">{cue.name}</div>
                  <div className="col-time">{startTime.toFixed(2)}s</div>
                  <div className="col-fade">
                    <span className="fade-in-badge">{cue.fadeIn}s</span>
                    <span className="fade-separator">/</span>
                    <span className="fade-out-badge">{cue.fadeOut}s</span>
                  </div>
                  <div className="col-fixtures">{cue.activeFixtures.length}</div>
                  <div className="col-flags">
                    {cue.isBlackout && (
                      <span className="flag blackout" title="黑场">黑场</span>
                    )}
                    {cue.isLocked && (
                      <span className="flag locked" title="已锁定">🔒</span>
                    )}
                  </div>
                  <div className="col-actions">
                    <button
                      className="action-btn"
                      onClick={(e) => handleToggleLock(cue, e)}
                      title={cue.isLocked ? '解锁' : '锁定'}
                    >
                      {cue.isLocked ? '🔓' : '🔒'}
                    </button>
                    <button
                      className="action-btn"
                      onClick={(e) => handleToggleBlackout(cue, e)}
                      title={cue.isBlackout ? '取消黑场' : '设为黑场'}
                    >
                      {cue.isBlackout ? '☀️' : '🌑'}
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={(e) => handleDeleteCue(cue.id, e)}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .cue-list-container {
          display: flex;
          flex-direction: column;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          overflow: hidden;
          height: 100%;
        }

        .cue-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .cue-list-header h3 {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .cue-list-content {
          flex: 1;
          overflow-y: auto;
          min-height: 200px;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .cue-table {
          display: flex;
          flex-direction: column;
        }

        .cue-table-header {
          display: flex;
          padding: 8px 16px;
          background-color: var(--bg-tertiary);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .cue-table-header > div {
          padding: 4px 8px;
        }

        .col-number { width: 60px; min-width: 60px; }
        .col-name { flex: 1; min-width: 120px; }
        .col-time { width: 80px; min-width: 80px; }
        .col-fade { width: 100px; min-width: 100px; }
        .col-fixtures { width: 60px; min-width: 60px; text-align: center; }
        .col-flags { width: 80px; min-width: 80px; }
        .col-actions { width: 100px; min-width: 100px; display: flex; gap: 4px; }

        .cue-row {
          display: flex;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: background-color 0.15s;
          align-items: center;
        }

        .cue-row:hover {
          background-color: var(--bg-tertiary);
        }

        .cue-row.selected {
          background-color: var(--bg-hover);
          border-left: 3px solid var(--accent-primary);
        }

        .cue-row.locked {
          opacity: 0.7;
        }

        .cue-row > div {
          padding: 4px 8px;
          font-size: 13px;
        }

        .col-number {
          font-weight: 600;
          color: var(--accent-primary);
        }

        .col-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .col-fade {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .fade-in-badge {
          color: var(--success);
        }

        .fade-out-badge {
          color: var(--error);
        }

        .fade-separator {
          color: var(--text-secondary);
        }

        .col-flags {
          display: flex;
          gap: 4px;
        }

        .flag {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
        }

        .flag.blackout {
          background-color: rgba(0, 0, 0, 0.6);
          color: white;
        }

        .flag.locked {
          background-color: rgba(96, 165, 250, 0.2);
        }

        .action-btn {
          padding: 4px 6px;
          border-radius: 4px;
          font-size: 12px;
          transition: background-color 0.15s;
        }

        .action-btn:hover {
          background-color: var(--bg-tertiary);
        }

        .action-btn.delete:hover {
          background-color: rgba(248, 113, 113, 0.2);
        }
      `}</style>
    </div>
  );
};
