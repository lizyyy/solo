import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fileToDataUrl } from '@/utils/image';

interface UploadZoneProps {
  onFileSelect: (file: File, preview: string) => void;
  maxFiles?: number;
  accept?: string;
  className?: string;
}

export function UploadZone({
  onFileSelect,
  maxFiles = 10,
  accept = 'image/*',
  className
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newFiles = [];
    for (let i = 0; i < Math.min(files.length, maxFiles - selectedFiles.length); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const preview = await fileToDataUrl(file);
      newFiles.push({ file, preview });
      onFileSelect(file, preview);
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, [maxFiles, selectedFiles.length, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center">
          <Upload className={cn(
            'w-12 h-12 mb-4 transition-colors',
            isDragging ? 'text-indigo-500' : 'text-slate-400'
          )} />
          <p className="text-lg font-medium text-slate-700 mb-2">
            拖拽图片到此处，或点击选择
          </p>
          <p className="text-sm text-slate-500">
            支持 JPG、PNG 格式，最多 {maxFiles} 张
          </p>
          {selectedFiles.length > 0 && (
            <p className="text-sm text-indigo-600 mt-2">
              已选择 {selectedFiles.length} 张图片
            </p>
          )}
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          {selectedFiles.map((item, index) => (
            <div
              key={index}
              className="relative group rounded-lg overflow-hidden border border-slate-200"
            >
              <img
                src={item.preview}
                alt={item.file.name}
                className="w-full h-24 object-cover"
              />
              <button
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                <p className="text-white text-xs truncate">{item.file.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
