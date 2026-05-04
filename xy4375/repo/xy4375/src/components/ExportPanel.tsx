import { useState } from 'react';
import { DrillData, ExportConfig } from '../types';
import './ExportPanel.css';

interface ExportPanelProps {
  drill: DrillData;
  defaultConfig: ExportConfig;
  onExport: (config: ExportConfig) => void;
  onCancel: () => void;
}

const ExportPanel = ({ drill, defaultConfig, onExport, onCancel }: ExportPanelProps) => {
  const [config, setConfig] = useState<ExportConfig>({
    ...defaultConfig
  });

  const handleFormatChange = (format: 'markdown' | 'json') => {
    setConfig(prev => ({ ...prev, format }));
  };

  const handleOptionChange = (option: keyof Omit<ExportConfig, 'format'>, value: boolean) => {
    setConfig(prev => ({ ...prev, [option]: value }));
  };

  const handleExport = () => {
    onExport(config);
  };

  return (
    <div className="export-panel">
      <div className="panel-header">
        <h2>📤 导出报告</h2>
        <button className="close-btn" onClick={onCancel}>
          ✕
        </button>
      </div>

      <div className="export-content">
        {/* 演练信息 */}
        <div className="drill-info-section">
          <div className="info-label">当前演练</div>
          <div className="info-value">{drill.name}</div>
          <div className="info-meta">
            风险事件: {drill.riskEvents.length} 起 | 
            已复核: {drill.riskEvents.filter(r => r.isReviewed).length} 起
          </div>
        </div>

        {/* 格式选择 */}
        <div className="format-section">
          <div className="section-title">导出格式</div>
          <div className="format-options">
            <button
              className={`format-btn ${config.format === 'markdown' ? 'active' : ''}`}
              onClick={() => handleFormatChange('markdown')}
            >
              <span className="format-icon">📄</span>
              <span className="format-name">Markdown 复盘单</span>
              <span className="format-desc">适用于阅读和分享</span>
            </button>
            <button
              className={`format-btn ${config.format === 'json' ? 'active' : ''}`}
              onClick={() => handleFormatChange('json')}
            >
              <span className="format-icon">📊</span>
              <span className="format-name">JSON 审计包</span>
              <span className="format-desc">适用于程序处理</span>
            </button>
          </div>
        </div>

        {/* 导出选项 */}
        <div className="options-section">
          <div className="section-title">包含内容</div>
          <div className="options-list">
            <label className="option-item">
              <input
                type="checkbox"
                checked={config.includeRiskEvents}
                onChange={(e) => handleOptionChange('includeRiskEvents', e.target.checked)}
              />
              <span className="option-label">风险事件详情</span>
              <span className="option-count">({drill.riskEvents.length} 起)</span>
            </label>
            
            <label className="option-item">
              <input
                type="checkbox"
                checked={config.includePersonnelPath}
                onChange={(e) => handleOptionChange('includePersonnelPath', e.target.checked)}
              />
              <span className="option-label">人员行动路径</span>
              <span className="option-count">
                ({[...new Set(drill.positionData.map(p => p.personId))].length} 人)
              </span>
            </label>
            
            <label className="option-item">
              <input
                type="checkbox"
                checked={config.includeSensorData}
                onChange={(e) => handleOptionChange('includeSensorData', e.target.checked)}
              />
              <span className="option-label">传感器数据</span>
              <span className="option-count">
                ({[...new Set(drill.sensorData.map(s => s.sensorId))].length} 个)
              </span>
            </label>
            
            <label className="option-item">
              <input
                type="checkbox"
                checked={config.includeDeviceStatus}
                onChange={(e) => handleOptionChange('includeDeviceStatus', e.target.checked)}
              />
              <span className="option-label">设备状态变化</span>
              <span className="option-count">
                ({[...new Set(drill.deviceStatus.map(d => d.deviceId))].length} 台)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExport}
        >
          {config.format === 'markdown' ? '导出 Markdown' : '导出 JSON'}
        </button>
      </div>
    </div>
  );
};

export default ExportPanel;
