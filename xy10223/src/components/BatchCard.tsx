import type { Batch } from '../types';
import { getStageName, getDoughTypeName, getStageColor, formatTime } from '../utils';

interface BatchCardProps {
  batch: Batch;
  onSelect: (batch: Batch) => void;
}

export default function BatchCard({ batch, onSelect }: BatchCardProps) {
  const stageColor = getStageColor(batch.currentStage);
  const tempRecords = batch.temperatureRecords;
  const lastTemp = tempRecords.length > 0 
    ? tempRecords[tempRecords.length - 1].temperature 
    : null;
  const avgTemp = tempRecords.length > 0 
    ? tempRecords.reduce((sum, r) => sum + r.temperature, 0) / tempRecords.length 
    : null;

  return (
    <div 
      className="batch-card" 
      onClick={() => onSelect(batch)}
      style={{ borderLeft: `4px solid ${stageColor}` }}
    >
      <div className="batch-card-header">
        <div className="batch-number">{batch.batchNumber}</div>
        <div 
          className="stage-badge" 
          style={{ backgroundColor: stageColor }}
        >
          {getStageName(batch.currentStage)}
        </div>
      </div>
      
      <div className="batch-card-body">
        <div className="dough-type">{getDoughTypeName(batch.doughType)}</div>
        <div className="batch-meta">
          <span>重量: {batch.weight}g</span>
          <span>目标温度: {batch.targetTemperature}°C</span>
        </div>
        
        {tempRecords.length > 0 && (
          <div className="temp-info">
            <div className="temp-item">
              <span className="temp-label">最新温度:</span>
              <span className="temp-value">{lastTemp?.toFixed(1)}°C</span>
            </div>
            <div className="temp-item">
              <span className="temp-label">平均温度:</span>
              <span className="temp-value">{avgTemp?.toFixed(1)}°C</span>
            </div>
          </div>
        )}
        
        <div className="time-info">
          <div>开始时间: {formatTime(batch.createdAt)}</div>
          <div>温度记录: {tempRecords.length}条</div>
        </div>
      </div>
      
      {batch.notes && (
        <div className="batch-notes">
          <strong>备注:</strong> {batch.notes}
        </div>
      )}
    </div>
  );
}
