import React, { useRef, useState } from 'react';
import { useAppStore } from '../store';
import { parseFloorJson, parseSensorCsv, parseWorkOrderJson, parseThresholdsJson } from '../utils/dataParser';
import { sampleFloors, sampleSensors, sampleWorkOrders } from '../data';

export const ImportPanel: React.FC = () => {
  const {
    setFloors,
    setSensors,
    setWorkOrders,
    setThresholds,
    thresholds,
  } = useAppStore();

  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const showStatus = (type: string, message: string) => {
    setImportStatus({ type, message });
    setTimeout(() => setImportStatus(null), 3000);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const extension = file.name.split('.').pop()?.toLowerCase();

        try {
          if (extension === 'json') {
            if (file.name.toLowerCase().includes('floor') || file.name.toLowerCase().includes('楼层')) {
              const floors = parseFloorJson(content);
              setFloors(floors);
              showStatus('success', `已导入 ${floors.length} 个楼层数据`);
            } else if (file.name.toLowerCase().includes('work') || file.name.toLowerCase().includes('工单')) {
              const orders = parseWorkOrderJson(content);
              setWorkOrders(orders);
              showStatus('success', `已导入 ${orders.length} 条工单数据`);
            } else if (file.name.toLowerCase().includes('threshold') || file.name.toLowerCase().includes('阈值')) {
              const newThresholds = parseThresholdsJson(content);
              setThresholds(newThresholds);
              showStatus('success', '已更新阈值配置');
            } else {
              try {
                const floors = parseFloorJson(content);
                if (floors.length > 0 && floors[0].zones) {
                  setFloors(floors);
                  showStatus('success', `已导入 ${floors.length} 个楼层数据`);
                  return;
                }
              } catch { /* ignore */ }
              
              try {
                const orders = parseWorkOrderJson(content);
                if (orders.length > 0) {
                  setWorkOrders(orders);
                  showStatus('success', `已导入 ${orders.length} 条工单数据`);
                  return;
                }
              } catch { /* ignore */ }

              throw new Error('无法识别JSON数据类型');
            }
          } else if (extension === 'csv') {
            const { sensors } = parseSensorCsv(content);
            setSensors(sensors);
            showStatus('success', `已导入 ${sensors.length} 个传感器数据`);
          } else {
            showStatus('error', `不支持的文件格式: ${extension}`);
          }
        } catch (error) {
          showStatus('error', `解析文件失败: ${(error as Error).message}`);
        }
      };
      reader.readAsText(file);
    });
  };

  const loadSampleData = () => {
    setFloors(sampleFloors);
    setSensors(sampleSensors);
    setWorkOrders(sampleWorkOrders);
    showStatus('success', '已加载示例数据');
  };

  return (
    <div className="import-panel">
      <div className="panel-header">
        <h3>数据导入</h3>
      </div>

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="drop-icon">📁</div>
        <div className="drop-text">
          拖拽文件到此处
          <br />
          或点击选择文件
        </div>
        <div className="drop-hint">
          支持: 楼层JSON、传感器CSV、工单JSON、阈值JSON
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      {importStatus && (
        <div className={`import-status ${importStatus.type}`}>
          {importStatus.type === 'success' ? '✓' : '✗'} {importStatus.message}
        </div>
      )}

      <div className="import-section">
        <h4>阈值配置</h4>
        <div className="threshold-form">
          <div className="threshold-row">
            <label>
              温度下限 (°C):
              <input
                type="number"
                step="0.5"
                value={thresholds.temperatureMin}
                onChange={(e) => setThresholds({
                  ...thresholds,
                  temperatureMin: parseFloat(e.target.value) || 18,
                })}
              />
            </label>
            <label>
              温度上限 (°C):
              <input
                type="number"
                step="0.5"
                value={thresholds.temperatureMax}
                onChange={(e) => setThresholds({
                  ...thresholds,
                  temperatureMax: parseFloat(e.target.value) || 26,
                })}
              />
            </label>
          </div>
          <div className="threshold-row">
            <label>
              湿度下限 (%):
              <input
                type="number"
                step="1"
                value={thresholds.humidityMin}
                onChange={(e) => setThresholds({
                  ...thresholds,
                  humidityMin: parseFloat(e.target.value) || 30,
                })}
              />
            </label>
            <label>
              湿度上限 (%):
              <input
                type="number"
                step="1"
                value={thresholds.humidityMax}
                onChange={(e) => setThresholds({
                  ...thresholds,
                  humidityMax: parseFloat(e.target.value) || 70,
                })}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <button className="btn btn-primary" onClick={loadSampleData}>
          📊 加载示例数据
        </button>
      </div>

      <div className="format-guide">
        <h4>数据格式说明</h4>
        <div className="format-item">
          <strong>楼层JSON:</strong>
          <pre>{`{
  "id": "floor_1",
  "name": "1F 零售层",
  "level": 1,
  "zones": [{
    "id": "zone_1",
    "name": "东北区域",
    "points": [
      {"x": 0, "y": 0},
      {"x": 50, "y": 0},
      {"x": 50, "y": 30},
      {"x": 0, "y": 30}
    ]
  }]
}`}</pre>
        </div>
        <div className="format-item">
          <strong>传感器CSV:</strong>
          <pre>{`sensorId,name,floorId,zoneId,x,y,temperature,humidity,timestamp,isOnline
sensor_1,1F-东北-A01,floor_1,zone_1,25,15,23.5,52,1714640400000,true`}</pre>
        </div>
        <div className="format-item">
          <strong>工单JSON:</strong>
          <pre>{`{
  "id": "WO-001",
  "title": "温度异常",
  "description": "检查空调",
  "floorId": "floor_1",
  "zoneId": "zone_1",
  "sensorId": "sensor_1",
  "status": "pending",
  "priority": "high",
  "createdAt": 1714640400000,
  "assignedTo": "张三",
  "assigneeId": "worker_001"
}`}</pre>
        </div>
      </div>
    </div>
  );
};
