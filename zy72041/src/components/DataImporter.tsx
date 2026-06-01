import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import type { ImportedData } from '@/types';
import { DataValidator } from '@/utils/dataValidator';
import { cn } from '@/lib/utils';
import AlertMessage from './AlertMessage';

interface DataImporterProps {
  onImport: (data: ImportedData) => void;
  onError?: (error: string) => void;
  className?: string;
  style?: React.CSSProperties;
  sampleData?: ImportedData;
}

export const DataImporter: React.FC<DataImporterProps> = ({
  onImport,
  onError,
  className = '',
  style,
  sampleData,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [importedData, setImportedData] = useState<ImportedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = DataValidator.parseImportData(text);
        
        if (result.error) {
          setError(result.error);
          onError?.(result.error);
          return;
        } else if (result.data) {
          const validation = DataValidator.validateImportedData(result.data);
          
          if (!validation.valid) {
            setError(validation.errors.join('；'));
            onError?.(validation.errors.join('；'));
            return;
          } else {
            setImportedData(result.data);
            setWarnings(validation.warnings);
            setError(null);
            onImport(result.data);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '文件读取失败';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleUseSample = () => {
    if (sampleData) {
      const validation = DataValidator.validateImportedData(sampleData);
      setImportedData(sampleData);
      setWarnings(validation.warnings);
      setError(null);
      onImport(sampleData);
    }
  };

  const handleClear = () => {
    setImportedData(null);
    setError(null);
    setWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('space-y-4', className)} style={style}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 font-serif flex items-center gap-2">
          <FileText className="w-5 h-5 text-subway-600" />
          导入课堂计分表数据
        </h3>
        {sampleData && !importedData && (
          <button
            onClick={handleUseSample}
            className="text-sm text-subway-600 hover:text-subway-700 hover:underline"
          >
            使用示例数据
          </button>
        )}
      </div>

      {error && (
        <AlertMessage type="error" message={error} onClose={() => setError(null)} />
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <AlertMessage
              key={index}
              type="warning"
              message={warning}
              onClose={() => setWarnings(w => w.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      )}

      {!importedData ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-subway-500 bg-subway-50'
              : 'border-gray-300 hover:border-subway-400 hover:bg-gray-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.txt"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className={cn(
            'w-12 h-12 mx-auto mb-4 transition-colors',
            isDragging ? 'text-subway-500' : 'text-gray-400'
          )} />
          <p className="text-gray-600 mb-2">
            拖拽文件到此处，或点击选择文件
          </p>
          <p className="text-sm text-gray-400">
            支持 JSON、TXT 格式，需包含课堂计分表数据
          </p>
        </div>
      ) : (
        <div className="bg-success-50 border border-success-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-success-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-success-800 mb-1">
                  数据导入成功
                </h4>
                <p className="text-sm text-success-700 mb-2">
                  来源：{importedData.source}
                </p>
                {importedData.teacherNote && (
                  <p className="text-sm text-success-600 bg-white/50 rounded p-2 mt-2">
                    <span className="font-medium">教师备注：</span>
                    {importedData.teacherNote}
                  </p>
                )}
                <div className="mt-2 text-sm text-success-600">
                  包含 {Object.keys(importedData.data).length} 个回合的数据
                </div>
              </div>
            </div>
            <button
              onClick={handleClear}
              className="p-1 hover:bg-success-100 rounded-full transition-colors"
              aria-label="清除"
            >
              <X className="w-5 h-5 text-success-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataImporter;
