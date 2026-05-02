import React, { useState } from 'react';
import { Source, Event, EventType } from '../types';
import { createEvent } from '../models';

interface ManualAnchorModalProps {
  sources: Source[];
  onClose: () => void;
  onSave: (event: Event) => void;
}

const EVENT_TYPES: EventType[] = ['manual_anchor', 'clap_peak', 'flash_frame'];

const eventTypeLabels: Record<EventType, string> = {
  manual_anchor: '人工标记',
  clap_peak: '音频峰值',
  flash_frame: '视频闪光帧'
};

const ManualAnchorModal: React.FC<ManualAnchorModalProps> = ({ sources, onClose, onSave }) => {
  const [selectedSourceId, setSelectedSourceId] = useState(sources[0]?.id || '');
  const [timestamp, setTimestamp] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('manual_anchor');
  const [confidence, setConfidence] = useState('1.0');

  const handleSave = () => {
    if (!selectedSourceId || !timestamp) return;

    const event = createEvent({
      sourceId: selectedSourceId,
      type: eventType,
      timestamp: parseFloat(timestamp),
      description: description || undefined,
      confidence: parseFloat(confidence)
    });

    onSave(event);
  };

  if (sources.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>添加锚点</h3>
            <button 
              className="btn btn-icon btn-secondary btn-small"
              onClick={onClose}
            >
              ✕
            </button>
          </div>

          <div className="modal-body">
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-icon">⚠️</div>
              <div className="empty-state-title">需要先添加源</div>
              <div className="empty-state-text">
                请先创建输入源，然后再添加锚点事件。
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button 
              className="btn btn-secondary"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>添加手动锚点</h3>
          <button 
            className="btn btn-icon btn-secondary btn-small"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">选择源</label>
            <select
              className="form-select"
              value={selectedSourceId}
              onChange={(e) => setSelectedSourceId(e.target.value)}
            >
              {sources.map(source => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.type === 'microphone' ? '🎤' : source.type === 'camera' ? '📷' : source.type === 'remote_stream' ? '🌐' : '📁'})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">事件类型</label>
            <select
              className="form-select"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              {EVENT_TYPES.map(type => (
                <option key={type} value={type}>
                  {eventTypeLabels[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">时间戳 (ms)</label>
            <input
              type="number"
              className="form-input"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="例如：1000, 3500, 5200"
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              锚点应该是所有源在同一时间点发生的事件
            </p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">置信度 (0.0 - 1.0)</label>
              <select
                className="form-select"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
              >
                <option value="1.0">1.0 - 非常确定</option>
                <option value="0.8">0.8 - 高度确定</option>
                <option value="0.6">0.6 - 中等确定</option>
                <option value="0.4">0.4 - 不确定</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">描述 (可选)</label>
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：开场拍手、副歌开始、镜头切换"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!selectedSourceId || !timestamp}
          >
            添加锚点
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualAnchorModal;
