import React, { useRef, useState } from 'react';
import { parseExcelFile } from '../utils/excelHandler';

export interface FileLoadResult {
  rows: Array<{ criterion: string; weight: string }>;
  fileName: string;
  fileSize: number;
}

interface FileUploadProps {
  onFileLoaded: (data: FileLoadResult) => void;
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
    onFileLoaded({
      rows: sampleData,
      fileName: '评分权重表示例(含混合).xlsx',
      fileSize: 12345
    });
  };

  const loadSampleDataV2 = () => {
    const sampleData = [
      { criterion: '教学态度', weight: '0.25' },
      { criterion: '教学内容', weight: '30%' },
      { criterion: '教学方法', weight: '0.20' },
      { criterion: '教学效果', weight: '25%' }
    ];
    onFileLoaded({
      rows: sampleData,
      fileName: '评分权重表示例(含混合) - 副本.xlsx',
      fileSize: 12345
    });
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
        <div className="sample-buttons">
          <button className="btn-sample" onClick={loadSampleData}>
            📊 测试1：首次导入（含百分数小数混合）
          </button>
          <button className="btn-sample" onClick={loadSampleDataV2}>
            🔁 测试2：再次上传同一份表（触发重复导入检测）
          </button>
        </div>
        <p className="sample-hint">
          提示：测试用例 → 先点测试1导入数据，然后点测试2触发重复导入检测（内容相同会被识别）
        </p>
      </div>
    </div>
  );
};
