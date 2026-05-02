import React from 'react';
import { useAppStore } from '../store';
import {
  downloadMarkdown,
  downloadInspectionCSV,
  downloadAlertsCSV,
  downloadSensorReadingsCSV,
} from '../utils/exportUtils';

export const ExportPanel: React.FC = () => {
  const {
    inspectionSuggestions,
    alerts,
    workOrders,
    sensors,
    thresholds,
  } = useAppStore();

  const hasData = sensors.length > 0;

  return (
    <div className="export-panel">
      <div className="panel-header">
        <h3>数据导出</h3>
      </div>

      {!hasData ? (
        <div className="empty-state">
          <p>暂无数据可导出</p>
          <p className="hint">请先导入数据或加载示例数据</p>
        </div>
      ) : (
        <div className="export-buttons">
          <div className="export-section">
            <h4>巡检建议</h4>
            <div className="button-row">
              <button
                className="btn btn-primary"
                onClick={() => downloadMarkdown(
                  inspectionSuggestions,
                  alerts,
                  workOrders,
                  sensors,
                  thresholds
                )}
                disabled={inspectionSuggestions.length === 0}
              >
                📄 导出 Markdown
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => downloadInspectionCSV(
                  inspectionSuggestions,
                  alerts,
                  workOrders,
                  sensors
                )}
                disabled={inspectionSuggestions.length === 0}
              >
                📊 导出 CSV
              </button>
            </div>
            <div className="export-count">
              {inspectionSuggestions.length} 条建议
            </div>
          </div>

          <div className="export-section">
            <h4>告警列表</h4>
            <button
              className="btn btn-secondary"
              onClick={() => downloadAlertsCSV(alerts)}
              disabled={alerts.length === 0}
            >
              ⚠️ 导出告警 CSV
            </button>
            <div className="export-count">
              {alerts.length} 条告警
            </div>
          </div>

          <div className="export-section">
            <h4>传感器数据</h4>
            <button
              className="btn btn-secondary"
              onClick={() => downloadSensorReadingsCSV(sensors)}
            >
              🌡️ 导出读数 CSV
            </button>
            <div className="export-count">
              {sensors.length} 个传感器, 
              {sensors.reduce((acc, s) => acc + s.readings.length, 0)} 条读数
            </div>
          </div>
        </div>
      )}

      <div className="export-info">
        <h4>导出说明</h4>
        <ul>
          <li>
            <strong>巡检建议 Markdown:</strong> 完整的巡检报告，包含摘要、阈值配置、分优先级的建议列表、活跃工单和传感器概览
          </li>
          <li>
            <strong>巡检建议 CSV:</strong> 表格格式的巡检建议，包含优先级、问题类型、位置、建议内容、关联告警和工单数量
          </li>
          <li>
            <strong>告警列表 CSV:</strong> 所有告警的详细信息，包括类型、严重程度、描述、位置、时间和附加数据
          </li>
          <li>
            <strong>传感器读数 CSV:</strong> 所有传感器的所有历史读数记录，包含时间、温度、湿度和在线状态
          </li>
        </ul>
      </div>
    </div>
  );
};
