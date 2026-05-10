import { useState } from 'react';
import type { Batch, TemperatureRecord } from '../types';
import { getStageName, getDoughTypeName, getStageColor, formatDateTime, getNextStage } from '../utils';

interface BatchDetailProps {
  batch: Batch;
  onClose: () => void;
  onAddTempRecord: (record: Omit<TemperatureRecord, 'id' | 'recordedAt'>) => void;
  onTransitionStage: (toStage: string, note?: string) => void;
}

export default function BatchDetail({ 
  batch, 
  onClose, 
  onAddTempRecord, 
  onTransitionStage 
}: BatchDetailProps) {
  const [showAddTempForm, setShowAddTempForm] = useState(false);
  const [showTransitionForm, setShowTransitionForm] = useState(false);
  const [tempValue, setTempValue] = useState('');
  const [tempNote, setTempNote] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [selectedStage, setSelectedStage] = useState('');

  const stageColor = getStageColor(batch.currentStage);
  const nextStage = getNextStage(batch.currentStage);

  const handleAddTemp = () => {
    if (!tempValue) return;
    onAddTempRecord({
      batchId: batch.id,
      stage: batch.currentStage,
      temperature: parseFloat(tempValue),
      note: tempNote || undefined
    });
    setTempValue('');
    setTempNote('');
    setShowAddTempForm(false);
  };

  const handleTransition = () => {
    if (!selectedStage) return;
    onTransitionStage(selectedStage, transitionNote || undefined);
    setTransitionNote('');
    setSelectedStage('');
    setShowTransitionForm(false);
  };

  const sortedTempRecords = [...batch.temperatureRecords].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  const sortedTransitions = [...batch.stageTransitions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="batch-detail">
      <div className="detail-header">
        <div className="detail-title">
          <h2>{batch.batchNumber}</h2>
          <span 
            className="stage-badge" 
            style={{ backgroundColor: stageColor }}
          >
            {getStageName(batch.currentStage)}
          </span>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="detail-body">
        <div className="detail-section">
          <h3>基本信息</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">面团类型</span>
              <span className="info-value">{getDoughTypeName(batch.doughType)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">重量</span>
              <span className="info-value">{batch.weight}g</span>
            </div>
            <div className="info-item">
              <span className="info-label">目标温度</span>
              <span className="info-value">{batch.targetTemperature}°C</span>
            </div>
            <div className="info-item">
              <span className="info-label">创建时间</span>
              <span className="info-value">{formatDateTime(batch.createdAt)}</span>
            </div>
          </div>
          {batch.notes && (
            <div className="notes-section">
              <span className="info-label">备注</span>
              <span className="info-value">{batch.notes}</span>
            </div>
          )}
        </div>

        <div className="detail-section">
          <h3>操作</h3>
          <div className="action-buttons">
            <button 
              className="action-btn"
              onClick={() => setShowAddTempForm(true)}
            >
              记录温度
            </button>
            {nextStage && (
              <button 
                className="action-btn"
                onClick={() => setShowTransitionForm(true)}
              >
                转至下一阶段
              </button>
            )}
          </div>
        </div>

        {showAddTempForm && (
          <div className="form-section">
            <h4>添加温度记录</h4>
            <div className="form-group">
              <label>温度 (°C)</label>
              <input
                type="number"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                placeholder="输入温度"
                step="0.1"
              />
            </div>
            <div className="form-group">
              <label>备注</label>
              <input
                type="text"
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="可选备注"
              />
            </div>
            <div className="form-actions">
              <button className="submit-btn" onClick={handleAddTemp}>
                确认
              </button>
              <button className="cancel-btn" onClick={() => setShowAddTempForm(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        {showTransitionForm && nextStage && (
          <div className="form-section">
            <h4>阶段流转</h4>
            <div className="form-group">
              <label>目标阶段</label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
              >
                <option value="">选择目标阶段</option>
                <option value={nextStage}>{getStageName(nextStage)}</option>
              </select>
            </div>
            <div className="form-group">
              <label>备注</label>
              <input
                type="text"
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="可选备注"
              />
            </div>
            <div className="form-actions">
              <button className="submit-btn" onClick={handleTransition}>
                确认流转
              </button>
              <button className="cancel-btn" onClick={() => setShowTransitionForm(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        <div className="detail-section">
          <h3>温度记录历史</h3>
          {sortedTempRecords.length > 0 ? (
            <div className="records-list">
              {sortedTempRecords.map((record) => (
                <div key={record.id} className="record-item">
                  <div className="record-header">
                    <span className="record-temp">{record.temperature.toFixed(1)}°C</span>
                    <span className="record-stage" style={{ color: getStageColor(record.stage) }}>
                      {getStageName(record.stage)}
                    </span>
                  </div>
                  <div className="record-time">{formatDateTime(record.recordedAt)}</div>
                  {record.note && (
                    <div className="record-note">{record.note}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-records">暂无温度记录</div>
          )}
        </div>

        <div className="detail-section">
          <h3>阶段流转历史</h3>
          <div className="transitions-timeline">
            {sortedTransitions.map((transition, index) => (
              <div key={index} className="timeline-item">
                <div 
                  className="timeline-dot"
                  style={{ backgroundColor: getStageColor(transition.toStage) }}
                />
                <div className="timeline-content">
                  <div className="timeline-stage">
                    {transition.fromStage ? (
                      <>
                        从 <span style={{ color: getStageColor(transition.fromStage) }}>
                          {getStageName(transition.fromStage)}
                        </span>
                      </>
                    ) : '开始'}
                    {' → '}
                    <span style={{ color: getStageColor(transition.toStage) }}>
                      {getStageName(transition.toStage)}
                    </span>
                  </div>
                  <div className="timeline-time">
                    {formatDateTime(transition.timestamp)}
                  </div>
                  {transition.note && (
                    <div className="timeline-note">{transition.note}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
