import { useState } from 'react';
import { api } from '../services/api';
import { useAppStore } from '../store/appStore';

type ImportCategory = 'sites' | 'devices' | 'targets' | 'windows' | 'lightPollution';

interface ImportInfo {
  label: string;
  description: string;
  format: 'csv' | 'json';
  apiFn: (file: File) => Promise<any>;
}

const importConfigs: Record<ImportCategory, ImportInfo> = {
  sites: {
    label: '观测点 CSV',
    description: '导入观测点列表（名称、经纬度、海拔）',
    format: 'csv',
    apiFn: api.importSitesCSV,
  },
  devices: {
    label: '设备表 CSV',
    description: '导入望远镜/相机等设备（名称、类型、电量）',
    format: 'csv',
    apiFn: api.importDevicesCSV,
  },
  targets: {
    label: '目标天体 JSON',
    description: '导入观测目标列表（名称、赤经赤纬、优先级）',
    format: 'json',
    apiFn: api.importTargetsJSON,
  },
  windows: {
    label: '观测窗口 JSON',
    description: '导入目标天体窗口（时间、设备ID）',
    format: 'json',
    apiFn: api.importWindowsJSON,
  },
  lightPollution: {
    label: '光污染 JSON',
    description: '导入光污染数据（Bortle等级、极限星等）',
    format: 'json',
    apiFn: api.importLightPollutionJSON,
  },
};

export default function ImportPage() {
  const [importing, setImporting] = useState<ImportCategory | null>(null);
  const [result, setResult] = useState<{ category: ImportCategory; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchAllData = useAppStore((state) => state.fetchAllData);

  const handleFileChange = async (category: ImportCategory, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(category);
    setError(null);
    setResult(null);

    try {
      const config = importConfigs[category];
      const response = await config.apiFn(file);
      setResult({ category, message: response.message || '导入成功' });
      fetchAllData();
    } catch (err) {
      setError('导入失败，请检查文件格式');
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="import-page">
      <h2>📁 数据导入</h2>

      <div className="import-instructions">
        <h3>导入指南</h3>
        <p>支持以下数据格式导入：</p>
        <ul>
          <li><strong>CSV 文件</strong>：观测点、设备表</li>
          <li><strong>JSON 文件</strong>：目标天体、观测窗口、光污染数据</li>
        </ul>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          ✅ {importConfigs[result.category].label}: {result.message}
        </div>
      )}

      <div className="import-cards">
        {(Object.entries(importConfigs) as [ImportCategory, ImportInfo][]).map(([key, config]) => (
          <div key={key} className="import-card">
            <h3>{config.label}</h3>
            <p className="description">{config.description}</p>
            <div className="format-badge">
              格式: {config.format.toUpperCase()}
            </div>
            <label className="file-input-label">
              <input
                type="file"
                accept={config.format === 'csv' ? '.csv' : '.json'}
                onChange={(e) => handleFileChange(key, e)}
                disabled={importing === key}
              />
              {importing === key ? (
                <span className="importing-text">⏳ 导入中...</span>
              ) : (
                <span className="select-file-text">选择文件</span>
              )}
            </label>
          </div>
        ))}
      </div>

      <div className="sample-data-section">
        <h3>📋 数据格式示例</h3>

        <div className="format-example">
          <h4>观测点 CSV 示例</h4>
          <pre>{`name,latitude,longitude,elevation
天文观测站1,40.1234,116.5678,500
市郊观测点,39.9876,116.4321,200`}</pre>
        </div>

        <div className="format-example">
          <h4>设备表 CSV 示例</h4>
          <pre>{`name,type,model,battery_level,is_available
主望远镜,telescope,Meade 12",100,true
深空相机,camera,ASI294MC,85,true
赤道仪,mount,EQ6-R Pro,70,true
滤镜轮,filter,Optolong 7nm,100,true`}</pre>
        </div>

        <div className="format-example">
          <h4>目标天体 JSON 示例</h4>
          <pre>{`{
  "targets": [
    {
      "name": "M42 猎户座大星云",
      "type": "发射星云",
      "rightAscension": "05h35m17.3s",
      "declination": "-05°23'28\"",
      "priority": 3
    },
    {
      "name": "M31 仙女座星系",
      "type": "星系",
      "rightAscension": "00h42m44.3s",
      "declination": "+41°16'09\"",
      "priority": 2
    }
  ]
}`}</pre>
        </div>

        <div className="format-example">
          <h4>观测窗口 JSON 示例</h4>
          <pre>{`{
  "windows": [
    {
      "targetId": "target_xxx",
      "startTime": "2024-05-15T20:00:00",
      "endTime": "2024-05-15T22:30:00",
      "duration": 150,
      "deviceIds": ["device_1", "device_2"],
      "notes": "深空拍摄窗口"
    }
  ]
}`}</pre>
        </div>
      </div>
    </div>
  );
}
