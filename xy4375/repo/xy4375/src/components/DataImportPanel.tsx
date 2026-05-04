import { useState, useCallback } from 'react';
import './DataImportPanel.css';

interface DataImportPanelProps {
  onImport: (files: {
    positionFile: File | null;
    sensorFile: File | null;
    deviceFile: File | null;
  }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const DataImportPanel = ({ onImport, onCancel, isLoading }: DataImportPanelProps) => {
  const [positionFile, setPositionFile] = useState<File | null>(null);
  const [sensorFile, setSensorFile] = useState<File | null>(null);
  const [deviceFile, setDeviceFile] = useState<File | null>(null);

  const handleFileChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onImport({ positionFile, sensorFile, deviceFile });
  }, [positionFile, sensorFile, deviceFile, onImport]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const FileUploadArea = ({
    label,
    file,
    onFileChange,
    accept,
    icon,
    hint
  }: {
    label: string;
    file: File | null;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    accept: string;
    icon: string;
    hint: string;
  }) => (
    <div className="upload-area">
      <label className="upload-label">
        <div className="upload-icon">{icon}</div>
        <div className="upload-text">
          <strong>{label}</strong>
          <span className="upload-hint">{hint}</span>
        </div>
        <input
          type="file"
          accept={accept}
          onChange={onFileChange}
          disabled={isLoading}
        />
      </label>
      {file && (
        <div className="file-info">
          <span className="file-name">✓ {file.name}</span>
          <span className="file-size">{formatFileSize(file.size)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="import-panel">
      <div className="panel-header">
        <h2>📁 导入演练数据</h2>
        <button className="close-btn" onClick={onCancel} disabled={isLoading}>
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="upload-sections">
          <FileUploadArea
            label="人员定位数据"
            file={positionFile}
            onFileChange={(e) => handleFileChange(e, setPositionFile)}
            accept=".csv"
            icon="👤"
            hint="支持 CSV 格式"
          />

          <FileUploadArea
            label="烟感/水位传感器数据"
            file={sensorFile}
            onFileChange={(e) => handleFileChange(e, setSensorFile)}
            accept=".json"
            icon="📡"
            hint="支持 JSON 格式"
          />

          <FileUploadArea
            label="阀门/防火门状态表"
            file={deviceFile}
            onFileChange={(e) => handleFileChange(e, setDeviceFile)}
            accept=".csv,.json"
            icon="🚪"
            hint="支持 CSV 或 JSON 格式"
          />
        </div>

        <div className="import-tips">
          <div className="tips-header">💡 数据格式说明</div>
          <div className="tips-content">
            <p><strong>人员定位 CSV 列名：</strong>timestamp, personId, personName, x, y, z, section</p>
            <p><strong>传感器 JSON 字段：</strong>timestamp, sensorId, sensorType, position, value, status</p>
            <p><strong>设备状态字段：</strong>timestamp, deviceId, deviceType, deviceName, position, status</p>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || (!positionFile && !sensorFile && !deviceFile)}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner-small"></span>
                处理中...
              </>
            ) : (
              '开始导入'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DataImportPanel;
