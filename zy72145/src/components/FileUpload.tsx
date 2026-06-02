import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, Loader2 } from 'lucide-react';
import { parseExcelFile } from '../utils/excelParser';
import { TrackRecord } from '../types';
import { useTrackStore } from '../store/useTrackStore';

interface FileUploadProps {
  onSuccess?: (records: TrackRecord[]) => void;
  onError?: (error: string) => void;
}

export default function FileUpload({ onSuccess, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addRecords = useTrackStore((state) => state.addRecords);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      onError?.('请上传Excel文件 (.xlsx, .xls, .csv)');
      return;
    }

    setIsLoading(true);
    try {
      const { records } = await parseExcelFile(file);
      if (records.length === 0) {
        onError?.('文件中没有有效数据');
        return;
      }
      addRecords(records);
      onSuccess?.(records);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : '文件解析失败');
    } finally {
      setIsLoading(false);
    }
  }, [addRecords, onError, onSuccess]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFile]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-300 cursor-pointer ${
        isDragging
          ? 'border-blue-500 bg-blue-50 scale-[1.02]'
          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
      } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 size={40} className="text-blue-500 animate-spin" />
          <span className="text-slate-600 font-medium">正在解析Excel文件...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-4">
          {isDragging ? (
            <FileSpreadsheet size={48} className="text-blue-500" />
          ) : (
            <Upload size={48} className="text-slate-400" />
          )}
          <div className="text-center">
            <p className="text-slate-700 font-medium">
              {isDragging ? '释放以上传文件' : '拖拽Excel文件到此处'}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              或点击选择文件，支持 .xlsx, .xls, .csv 格式
            </p>
          </div>
          {isDragging && (
            <div className="absolute inset-0 border-2 border-blue-400 rounded-lg bg-blue-50/50 pointer-events-none flex items-center justify-center">
              <X size={24} className="text-blue-500 absolute top-3 right-3" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
