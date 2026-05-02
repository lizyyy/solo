import React, { useRef, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface FileUploaderProps {
  onFileSelect: (file: File, content: string) => void;
  accept?: string;
  label: string;
  description?: string;
  error?: string;
  selectedFile?: File | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  accept = '*/*',
  label,
  description,
  error,
  selectedFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onFileSelect(file, content);
    };
    reader.onerror = () => {
      console.error('文件读取失败');
    };
    reader.readAsText(file);
  };

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
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
          isDragging 
            ? "border-blue-500 bg-blue-50" 
            : error 
              ? "border-red-300 bg-red-50" 
              : selectedFile 
                ? "border-green-300 bg-green-50" 
                : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <FileText className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <p className="text-xs text-blue-600 hover:text-blue-800">
              点击重新选择
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className={clsx(
              "w-12 h-12 rounded-full flex items-center justify-center",
              isDragging ? "bg-blue-100" : "bg-gray-100"
            )}>
              <Upload 
                className={clsx(
                  "size-6",
                  isDragging ? "text-blue-600" : "text-gray-500"
                )} 
              />
            </div>
            <div>
              <p className="text-sm text-gray-700">
                <span className="font-medium text-blue-600">点击上传</span> 或拖拽文件到此处
              </p>
              {description && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
