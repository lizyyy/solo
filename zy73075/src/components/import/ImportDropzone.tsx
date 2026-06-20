import { useCallback, useRef, useState } from 'react';
import { Upload, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportDropzoneProps {
  onFile: (text: string) => void;
}

export default function ImportDropzone({ onFile }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.json')) {
        alert('请选择 .json 文件');
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target?.result as string;
        onFile(text);
      };
      reader.onerror = () => alert('文件读取失败');
      reader.readAsText(file, 'utf-8');
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData('text');
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        onFile(text);
      }
    },
    [onFile],
  );

  return (
    <div
      className={cn(
        'relative card cursor-pointer transition-all duration-200 border-2 border-dashed',
        'px-8 py-12 text-center',
        isDragging
          ? 'border-shield-400 bg-shield-500/10 shadow-glow-shield'
          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/40',
      )}
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      onClick={() => inputRef.current?.click()}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
            isDragging ? 'bg-shield-500/20' : 'bg-slate-800',
          )}
        >
          {isDragging ? (
            <FileJson className="w-8 h-8 text-shield-300" />
          ) : (
            <Upload className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <div>
          <p className="text-base font-medium text-slate-200">
            拖拽 JSON 文件到此处，或点击选择文件
          </p>
          <p className="mt-1 text-sm text-slate-400">
            也可直接 <span className="text-shield-300 font-medium">Ctrl+V 粘贴</span> JSON 内容
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileJson className="w-3.5 h-3.5" />
          <span>支持格式：盾构刀盘工单回放导出的 .json</span>
        </div>
      </div>
    </div>
  );
}
