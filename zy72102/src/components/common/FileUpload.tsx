import React, { useCallback, useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  acceptedFormats?: string;
  maxFiles?: number;
  className?: string;
}

export function FileUpload({
  onFilesSelected,
  acceptedFormats = '.csv,.json',
  maxFiles = 5,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const newFiles = droppedFiles.slice(0, maxFiles - files.length);
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    },
    [files, maxFiles, onFilesSelected]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      const newFiles = selectedFiles.slice(0, maxFiles - files.length);
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    },
    [files, maxFiles, onFilesSelected]
  );

  const removeFile = useCallback(
    (index: number) => {
      const updatedFiles = files.filter((_, i) => i !== index);
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    },
    [files, onFilesSelected]
  );

  return (
    <div className={className}>
      <div
        className={cn(
          'rounded-lg border-2 border-dashed p-8 text-center transition-all',
          isDragging
            ? 'border-cyan-500 bg-cyan-500/10'
            : 'border-slate-600 hover:border-slate-500'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={acceptedFormats}
          multiple
          onChange={handleFileChange}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <Upload
            className={cn(
              'mx-auto h-12 w-12',
              isDragging ? 'text-cyan-400' : 'text-slate-400'
            )}
          />
          <p className="mt-4 text-lg font-medium text-white">
            {isDragging ? '释放以上传文件' : '拖拽文件到此处'}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            或点击选择文件（支持 {acceptedFormats}）
          </p>
          <p className="mt-1 text-xs text-slate-500">
            最多上传 {maxFiles} 个文件
          </p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-slate-800 p-3"
            >
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-sm font-medium text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
