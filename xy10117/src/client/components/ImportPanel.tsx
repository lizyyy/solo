import React, { useState, useRef } from 'react';
import { api } from '../api';

interface ImportPanelProps {
  onSuccess: () => void;
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ onSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [operator, setOperator] = useState('');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setResult({ success: false, message: '请上传 CSV 或 Excel 文件' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await api.importFile(file, operator || 'system');
      setResult({
        success: true,
        message: `导入完成：成功 ${res.success ?? res.successful} 条，失败 ${res.failed} 条${res.errors?.length ? `\n错误: ${res.errors.slice(0, 3).join('; ')}` : ''}`,
      });
      onSuccess();
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="upload-section">
      <h3 className="section-title">📥 数据导入</h3>

      <div className="form-group">
        <label>操作人姓名（可选）</label>
        <input
          type="text"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          placeholder="记录操作人，留空则显示为 system"
        />
      </div>

      <div
        className={`upload-area ${isDragging ? 'dragover' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {loading ? (
          <div>
            <span className="loading"></span>
            <div className="upload-text">正在导入...</div>
          </div>
        ) : (
          <>
            <div className="upload-icon">📊</div>
            <div className="upload-text">点击或拖拽文件到此处上传</div>
            <div className="upload-hint">支持 .csv, .xlsx, .xls 格式</div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {result && (
        <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 16, whiteSpace: 'pre-line' }}>
          {result.message}
        </div>
      )}

      <div className="alert alert-info" style={{ marginTop: 16 }}>
        <strong>文件格式要求：</strong>
        <br />
        必需列：<code>transaction_id</code>（或交易ID）、<code>amount</code>（或金额）、<code>transaction_time</code>（或交易时间）
        <br />
        其他列：merchant, category, country, user_id, device_id, velocity_24h, amount_deviation, is_first_transaction, is_weekend, is_night, risk_score
      </div>
    </div>
  );
};
