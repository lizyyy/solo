import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';
import { useState, type DragEvent, type ChangeEvent } from 'react';

interface FileDropZoneProps {
  onDrop: (file: File, sourceType: 'original' | 'processed') => void;
  className?: string;
}

export function FileDropZone({ onDrop, className }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sourceType, setSourceType] = useState<'original' | 'processed'>('original');

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onDrop(files[0], sourceType);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onDrop(files[0], sourceType);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setSourceType('original')}
          className={cn(
            'px-3 py-1 rounded border transition-colors',
            sourceType === 'original'
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
          )}
        >
          原始材料
        </button>
        <button
          onClick={() => setSourceType('processed')}
          className={cn(
            'px-3 py-1 rounded border transition-colors',
            sourceType === 'processed'
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
          )}
        >
          处理结果
        </button>
      </div>
      
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer',
          isDragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
        )}
      >
        <input
          type="file"
          onChange={handleFileInput}
          className="hidden"
          id="file-input"
          accept=".json,.csv,.txt"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <Upload className="w-8 h-8 mx-auto mb-2 text-zinc-500" />
          <p className="text-sm text-zinc-400">拖拽文件到此处或点击上传</p>
          <p className="text-xs text-zinc-600 mt-1">支持 JSON, CSV, TXT</p>
        </label>
      </div>
    </div>
  );
}
