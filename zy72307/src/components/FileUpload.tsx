import React, { useRef, useState } from 'react';
import { parseExcelFile } from '../utils/excelHandler';

interface FileUploadProps {
  onFileLoaded: (data: Array<{ criterion: string; weight: string }>) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await parseExcelFile(file);
      onFileLoaded(data);
    } catch (err) {
      setError('文件解析失败，请检查文件格式');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const loadSampleData = () => {
    const sampleData = [
      { criterion: '教学态度', weight: '0.25' },
      { criterion: '教学内容', weight: '30%' },
      { criterion: '教学方法', weight: '0.20' },
      { criterion: '教学效果', weight: '25%' }
    ];
    onFileLoaded(sampleData);
  };

  return (
    <div className="file-upload">
      <div className="upload-area" onClick={handleClick}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="file-input"
        />
        <div className="upload-icon">📁</div>
        <p className="upload-text">点击或拖拽上传评分权重表</p>
        <p className="upload-hint">支持 Excel (.xlsx, .xls) 和 CSV 格式</p>
        {isLoading && <div className="loading">正在解析文件...</div>}
        {error && <div className="error-message">{error}</div>}
      </div>
      <div className="sample-data">
        <button className="btn-sample" onClick={loadSampleData}>
          加载示例数据（包含百分数小数混合）
        </button>
      </div>
    </div>
  );
};
