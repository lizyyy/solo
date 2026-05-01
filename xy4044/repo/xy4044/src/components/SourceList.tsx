import React from 'react';
import { Source, CalibrationResult } from '../types';
import { getSourceTypeLabel } from '../models';
import { getSourceDelayInfo } from '../timeline';

interface SourceListProps {
  sources: Source[];
  calibrationResults: CalibrationResult[];
  masterClockSourceId?: string;
  onEdit: (source: Source) => void;
  onDelete: (sourceId: string) => void;
  onSetMasterClock: (sourceId: string) => void;
}

const SourceList: React.FC<SourceListProps> = ({
  sources,
  calibrationResults,
  masterClockSourceId,
  onEdit,
  onDelete,
  onSetMasterClock
}) => {
  if (sources.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📦</div>
        <div className="empty-state-title">暂无输入源</div>
        <div className="empty-state-text">
          点击顶部的 "添加源" 按钮来创建新的输入源，
          或导入示例数据来体验功能。
        </div>
      </div>
    );
  }

  return (
    <div>
      {sources.map(source => {
        const isMaster = source.id === masterClockSourceId;
        const result = calibrationResults.find(r => r.sourceId === source.id);
        const delayInfo = result 
          ? getSourceDelayInfo(source.id, calibrationResults)
          : { delayOffset: source.delayOffset, direction: 'none' as const, readable: '未校准' };

        return (
          <div 
            key={source.id} 
            className={`source-card ${isMaster ? 'master' : ''}`}
          >
            <div className="source-header">
              <div className="source-name">
                <span 
                  className="source-color-indicator" 
                  style={{ backgroundColor: source.color }}
                />
                <span>{source.name}</span>
                {isMaster && (
                  <span style={{ 
                    fontSize: '10px', 
                    color: 'var(--accent-success)',
                    fontWeight: 600
                  }}>
                    (主时钟)
                  </span>
                )}
              </div>
              <span className="source-type-badge">
                {getSourceTypeLabel(source.type)}
              </span>
            </div>

            <div className="source-details">
              {source.sampleRate && (
                <span>采样率: {source.sampleRate} Hz</span>
              )}
              {source.frameRate && (
                <span>帧率: {source.frameRate} fps</span>
              )}
            </div>

            <div className="source-delay">
              <span>延迟偏移:</span>
              <span className={`delay-value ${delayInfo.direction}`}>
                {delayInfo.readable}
              </span>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>参与混音:</span>
                  <div 
                    className={`toggle-switch ${source.isInMix ? 'active' : ''}`}
                    onClick={() => {}}
                    title="参与混音状态"
                  >
                    <div className="toggle-knob" />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>激活:</span>
                  <div 
                    className={`toggle-switch ${source.isActive ? 'active' : ''}`}
                    onClick={() => {}}
                    title="激活状态"
                  >
                    <div className="toggle-knob" />
                  </div>
                </div>
              </div>
            </div>

            <div className="source-actions">
              {!isMaster && (
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => onSetMasterClock(source.id)}
                  title="设为主时钟源"
                >
                  设为主时钟
                </button>
              )}
              <button 
                className="btn btn-secondary btn-small"
                onClick={() => onEdit(source)}
                title="编辑源"
              >
                编辑
              </button>
              <button 
                className="btn btn-secondary btn-small"
                onClick={() => onDelete(source.id)}
                style={{ color: 'var(--accent-primary)' }}
                title="删除源"
              >
                删除
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SourceList;
