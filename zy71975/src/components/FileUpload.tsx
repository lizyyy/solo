import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  onUpload?: (file: File) => Promise<void>;
  label?: string;
  description?: string;
}

export default function FileUpload({
  accept = '.pdf,.doc,.docx,.txt',
  maxSize = 10 * 1024 * 1024,
  onUpload,
  label = '上传文件',
  description = '拖拽文件到此处或点击选择',
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const acceptedTypes = accept.split(',');
    const fileType = file.name.toLowerCase();
    const isValidType = acceptedTypes.some((type) =>
      fileType.endsWith(type.trim().toLowerCase().replace('.', '')) ||
      fileType.endsWith(type.trim().toLowerCase())
    );

    if (!isValidType) {
      setErrorMessage(`不支持的文件格式，请上传 ${accept} 格式的文件`);
      setStatus('error');
      return false;
    }

    if (file.size > maxSize) {
      setErrorMessage(`文件大小不能超过 ${maxSize / 1024 / 1024}MB`);
      setStatus('error');
      return false;
    }

    return true;
  };

  const handleFile = useCallback(async (file: File) => {
    if (!validateFile(file)) return;

    setSelectedFile(file);
    setStatus('idle');
    setErrorMessage('');

    if (onUpload) {
      setUploading(true);
      try {
        await onUpload(file);
        setStatus('success');
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '上传失败');
      } finally {
        setUploading(false);
      }
    }
  }, [onUpload, accept, maxSize]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
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

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setStatus('idle');
    setErrorMessage('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="w-full">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300',
          isDragging
            ? 'border-orange-500 bg-orange-50 scale-[1.01]'
            : status === 'error'
            ? 'border-red-300 bg-red-50'
            : status === 'success'
            ? 'border-green-300 bg-green-50'
            : 'border-slate-300 bg-white hover:border-primary hover:bg-slate-50 hover:scale-[1.01]'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600">正在上传...</p>
          </div>
        ) : selectedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-3 rounded-xl',
                status === 'success' ? 'bg-green-100' : status === 'error' ? 'bg-red-100' : 'bg-slate-100'
              )}>
                <FileText className={cn(
                  'w-8 h-8',
                  status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-primary'
                )} />
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-800">{selectedFile.name}</p>
                <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status === 'success' && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">上传成功</span>
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">上传失败</span>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-slate-100 rounded-2xl">
              <Upload className="w-10 h-10 text-primary" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{label}</p>
              <p className="text-sm text-slate-500 mt-1">{description}</p>
              <p className="text-xs text-slate-400 mt-2">支持格式：{accept}，最大 {maxSize / 1024 / 1024}MB</p>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
