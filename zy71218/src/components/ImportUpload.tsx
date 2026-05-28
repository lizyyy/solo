import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  FileSpreadsheet,
  File,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { BusinessDataType, ImportResult } from '../../shared/types';
import { DATA_TYPE_LABELS } from '../../shared/types';

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: ImportResult;
}

export interface ImportUploadProps {
  importType: BusinessDataType;
  onImportTypeChange?: (type: BusinessDataType) => void;
  onUpload?: (files: File[]) => Promise<ImportResult[]>;
  onFileRemove?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  maxSize?: number;
  className?: string;
  showTemplate?: boolean;
  onDownloadTemplate?: () => void;
  disabled?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const fileTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-excel': FileSpreadsheet,
  'text/csv': FileSpreadsheet,
  'application/json': FileText,
};

const getFileIcon = (type: string) => {
  return fileTypeIcons[type] || File;
};

export const ImportUpload: React.FC<ImportUploadProps> = ({
  importType,
  onImportTypeChange,
  onUpload,
  onFileRemove,
  onRetry,
  acceptedFileTypes = ['.xlsx', '.xls', '.csv'],
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024,
  className,
  showTemplate = true,
  onDownloadTemplate,
  disabled = false,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importTypes: BusinessDataType[] = ['invoice', 'confirmation', 'contract', 'repayment_plan', 'collection_note', 'risk_report'];

  const validateFile = (file: File): string | null => {
    if (!acceptedFileTypes.some(type => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return acceptedFileTypes.includes(ext) || acceptedFileTypes.includes(type);
    })) {
      return `不支持的文件类型，请上传 ${acceptedFileTypes.join('、')} 格式的文件`;
    }
    if (file.size > maxSize) {
      return `文件大小不能超过 ${formatFileSize(maxSize)}`;
    }
    return null;
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    if (disabled) return;

    const fileArray = Array.from(newFiles);
    
    if (files.length + fileArray.length > maxFiles) {
      alert(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    const validFiles: UploadFile[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);
      validFiles.push({
        id: Math.random().toString(36).substring(2, 11),
        file,
        name: file.name,
        size: file.size,
        progress: error ? 0 : 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      });
    });

    setFiles(prev => [...prev, ...validFiles]);

    const filesToUpload = validFiles.filter(f => f.status === 'pending');
    if (filesToUpload.length > 0 && onUpload) {
      filesToUpload.forEach(async (uploadFile) => {
        setFiles(prev => prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        ));

        try {
          const results = await onUpload([uploadFile.file]);
          const result = results[0];
          
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: result.success ? 'success' : 'error', progress: 100, result }
              : f
          ));
        } catch (error) {
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'error', error: error instanceof Error ? error.message : '上传失败' }
              : f
          ));
        }
      });
    }
  }, [disabled, files.length, maxFiles, maxSize, onUpload, validateFile, acceptedFileTypes]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    onFileRemove?.(fileId);
  };

  const handleRetry = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file && onUpload) {
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'uploading', progress: 0, error: undefined } : f
      ));

      onUpload([file.file])
        .then(results => {
          const result = results[0];
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, status: result.success ? 'success' : 'error', progress: 100, result }
              : f
          ));
        })
        .catch(error => {
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, status: 'error', error: error instanceof Error ? error.message : '上传失败' }
              : f
          ));
        });
    }
    onRetry?.(fileId);
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-slate-400" />;
      case 'uploading':
        return (
          <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        );
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return '等待上传';
      case 'uploading':
        return '上传中...';
      case 'success':
        return '上传成功';
      case 'error':
        return '上传失败';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Import Type Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
          导入类型：
        </label>
        <div className="flex flex-wrap gap-2">
          {importTypes.map(type => (
            <button
              key={type}
              onClick={() => onImportTypeChange?.(type)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                importType === type
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              {DATA_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center',
            isDragOver ? 'bg-blue-100' : 'bg-slate-100'
          )}>
            <Upload className={cn(
              'w-8 h-8',
              isDragOver ? 'text-blue-600' : 'text-slate-400'
            )} />
          </div>
          <div>
            <p className="text-base font-medium text-slate-800">
              {isDragOver ? '释放文件到这里' : '拖拽文件到此处，或'}
              <span className="text-blue-600 mx-1">点击上传</span>
            </p>
            <p className="text-sm text-slate-500 mt-1">
              支持 {acceptedFileTypes.join('、')} 格式，单个文件不超过 {formatFileSize(maxSize)}
            </p>
          </div>
        </div>

        {showTemplate && onDownloadTemplate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadTemplate();
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            下载导入模板
          </button>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(file => {
            const FileIcon = getFileIcon(file.file.type);
            return (
              <div
                key={file.id}
                className={cn(
                  'flex items-center gap-4 p-4 bg-white rounded-xl border transition-all',
                  file.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : file.status === 'success'
                    ? 'border-green-200 bg-green-50'
                    : 'border-slate-200'
                )}
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-5 h-5 text-slate-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusIcon(file.status)}
                      <span className={cn(
                        'text-xs font-medium',
                        file.status === 'error'
                          ? 'text-red-600'
                          : file.status === 'success'
                          ? 'text-green-600'
                          : 'text-slate-500'
                      )}>
                        {getStatusText(file.status)}
                      </span>
                    </div>
                  </div>

                  {file.status === 'uploading' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span>上传进度</span>
                        <span>{file.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {file.result && (
                    <div className="mt-2 text-xs">
                      <span className="text-green-600">
                        成功 {file.result.imported} 条，
                      </span>
                      <span className="text-slate-500">
                        共 {file.result.total} 条
                      </span>
                      {file.result.errors && file.result.errors.length > 0 && (
                        <div className="mt-1 text-red-600">
                          错误：{file.result.errors.join('；')}
                        </div>
                      )}
                    </div>
                  )}

                  {file.error && (
                    <p className="mt-1 text-xs text-red-600">
                      {file.error}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {file.status === 'error' && (
                    <button
                      onClick={() => handleRetry(file.id)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="重试"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="移除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImportUpload;
