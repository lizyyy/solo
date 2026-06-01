import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, Database } from 'lucide-react';

interface DataUploadProps {
  onLoadMockData: () => void;
  onFileUpload: (file: File) => void;
}

const DataUpload: React.FC<DataUploadProps> = ({ onLoadMockData, onFileUpload }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          <span>数据上传</span>
        </div>
        <button
          onClick={onLoadMockData}
          className="btn-secondary flex items-center gap-1.5 text-sm"
        >
          <Database className="w-4 h-4" />
          加载内置样例数据
        </button>
      </div>
      <div className="card-body">
        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            blueprint-bg rounded-engineering border-2 border-dashed cursor-pointer
            transition-all duration-300 min-h-[200px] flex flex-col items-center justify-center
            ${isDragOver 
              ? 'border-engineering-300 bg-engineering-900/80 scale-[1.01]' 
              : 'border-engineering-600 hover:border-engineering-400'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <FileSpreadsheet className={`w-12 h-12 mb-4 transition-colors duration-300 ${isDragOver ? 'text-engineering-200' : 'text-engineering-400'}`} />
          <p className={`text-lg font-medium mb-2 transition-colors duration-300 ${isDragOver ? 'text-white' : 'text-engineering-200'}`}>
            {isDragOver ? '释放文件以上传' : '拖拽文件到此处'}
          </p>
          <p className="text-sm text-engineering-400">
            或点击选择文件
          </p>
          <div className="flex gap-2 mt-4">
            <span className="px-2 py-1 bg-engineering-800/50 text-engineering-300 text-xs rounded-engineering">.csv</span>
            <span className="px-2 py-1 bg-engineering-800/50 text-engineering-300 text-xs rounded-engineering">.xlsx</span>
            <span className="px-2 py-1 bg-engineering-800/50 text-engineering-300 text-xs rounded-engineering">.xls</span>
            <span className="px-2 py-1 bg-engineering-800/50 text-engineering-300 text-xs rounded-engineering">.json</span>
          </div>
        </div>
        <div className="mt-4 text-xs text-engineering-500 space-y-1">
          <p>• 数据应包含：材料、应力、应力单位、寿命、寿命单位等字段</p>
          <p>• 支持 CSV、Excel、JSON 格式文件</p>
          <p>• 可加载内置样例数据快速体验系统功能</p>
        </div>
      </div>
    </div>
  );
};

export default DataUpload;
