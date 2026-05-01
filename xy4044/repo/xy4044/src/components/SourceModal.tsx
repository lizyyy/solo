import React, { useState, useEffect } from 'react';
import { Source, SourceType } from '../types';
import { createSource, getSourceTypeLabel } from '../models';

interface SourceModalProps {
  source?: Source | null;
  onClose: () => void;
  onSave: (source: Source) => void;
}

const SOURCE_TYPES: SourceType[] = ['microphone', 'camera', 'remote_stream', 'local_file'];

const SourceModal: React.FC<SourceModalProps> = ({ source, onClose, onSave }) => {
  const isEditing = !!source;
  
  const [name, setName] = useState('');
  const [type, setType] = useState<SourceType>('microphone');
  const [sampleRate, setSampleRate] = useState<string>('48000');
  const [frameRate, setFrameRate] = useState<string>('30');
  const [delayOffset, setDelayOffset] = useState<string>('0');
  const [color, setColor] = useState('#e94560');

  useEffect(() => {
    if (source) {
      setName(source.name);
      setType(source.type);
      setSampleRate(source.sampleRate?.toString() || '48000');
      setFrameRate(source.frameRate?.toString() || '30');
      setDelayOffset(source.delayOffset.toString());
      setColor(source.color);
    }
  }, [source]);

  const handleSave = () => {
    const newSource = createSource({
      id: source?.id,
      name: name || '未命名源',
      type,
      sampleRate: sampleRate ? parseInt(sampleRate, 10) : undefined,
      frameRate: type === 'camera' ? parseInt(frameRate, 10) : undefined,
      delayOffset: parseFloat(delayOffset) || 0,
      color,
      isActive: true,
      isInMix: true
    });

    onSave(newSource);
  };

  const isAudioType = type === 'microphone' || type === 'remote_stream' || type === 'local_file';
  const isVideoType = type === 'camera';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? '编辑源' : '添加新源'}</h3>
          <button 
            className="btn btn-icon btn-secondary btn-small"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">源名称</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：主唱麦克风、远程贝斯手、伴奏轨"
            />
          </div>

          <div className="form-group">
            <label className="form-label">源类型</label>
            <select
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
            >
              {SOURCE_TYPES.map(t => (
                <option key={t} value={t}>{getSourceTypeLabel(t)}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            {isAudioType && (
              <div className="form-group">
                <label className="form-label">采样率 (Hz)</label>
                <select
                  className="form-select"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                >
                  <option value="44100">44100 Hz</option>
                  <option value="48000">48000 Hz</option>
                  <option value="96000">96000 Hz</option>
                  <option value="">未指定</option>
                </select>
              </div>
            )}

            {isVideoType && (
              <div className="form-group">
                <label className="form-label">帧率 (fps)</label>
                <select
                  className="form-select"
                  value={frameRate}
                  onChange={(e) => setFrameRate(e.target.value)}
                >
                  <option value="24">24 fps</option>
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">初始延迟偏移 (ms)</label>
              <input
                type="number"
                className="form-input"
                value={delayOffset}
                onChange={(e) => setDelayOffset(e.target.value)}
                placeholder="0"
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                正值表示延后，负值表示提前
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">显示颜色</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  '#e94560', '#f39c12', '#27ae60', '#3498db', 
                  '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
                ].map(c => (
                  <div
                    key={c}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: c,
                      cursor: 'pointer',
                      border: color === c ? '3px solid white' : '3px solid transparent',
                      boxShadow: color === c ? '0 0 0 2px var(--accent-secondary)' : 'none'
                    }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
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
            disabled={!name.trim()}
          >
            {isEditing ? '保存' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourceModal;
