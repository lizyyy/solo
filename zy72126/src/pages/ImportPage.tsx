import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, FileAudio } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import { parseFileName, validateAudioFile, generateId, detectConflicts } from '@/utils/fileParser';
import { formatFileSize } from '@/utils/fileParser';
import { cn } from '@/lib/utils';
import type { Track, ImportRecord, Conflict } from '@/types';

interface FileItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'failed';
  progress: number;
  errorReason?: string;
  parsedData?: any;
}

export const ImportPage = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { addTrack, addImportRecord, addConflict, tracks } = useAppStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    e.target.value = '';
  }, []);

  const addFiles = (newFiles: File[]) => {
    const fileItems: FileItem[] = newFiles.map((file) => ({
      id: generateId(),
      file,
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...fileItems]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
  };

  const processFiles = async () => {
    if (files.length === 0 || isProcessing) return;
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i];
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'processing', progress: 10 } : f
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const validation = validateAudioFile(fileItem.file);
      
      if (!validation.valid) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: 'failed', progress: 100, errorReason: validation.reason }
              : f
          )
        );

        const importRecord: ImportRecord = {
          id: generateId(),
          fileName: fileItem.file.name,
          fileSize: fileItem.file.size,
          status: 'failed',
          errorReason: validation.reason,
          importedAt: new Date().toISOString(),
        };
        addImportRecord(importRecord);
        continue;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, progress: 40 } : f
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const parsedData = parseFileName(fileItem.file.name);
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, progress: 70, parsedData } : f
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 200));

      const trackId = generateId();
      const now = new Date().toISOString();

      const existingTrack = tracks.find(
        (t) => t.fileName === fileItem.file.name || t.trackName === parsedData.trackName
      );

      let trackStatus: Track['status'] = 'normal';

      if (existingTrack) {
        const detectedConflicts = detectConflicts(existingTrack, {
          ...parsedData,
          fileName: fileItem.file.name,
        });

        if (detectedConflicts.length > 0) {
          trackStatus = 'conflict';
          detectedConflicts.forEach((c) => {
            const conflict: Conflict = {
              id: generateId(),
              trackId: existingTrack.id,
              sourceA: '舞台通道表',
              sourceB: '导入文件',
              field: c.field,
              valueA: c.valueA,
              valueB: c.valueB,
              status: 'pending',
              suggestedAction: c.suggestedAction,
            };
            addConflict(conflict);
          });
        }
      }

      const track: Track = {
        id: trackId,
        channelNo: parsedData.channelNo || '',
        trackName: parsedData.trackName,
        artist: parsedData.artist,
        duration: parsedData.duration,
        fileName: fileItem.file.name,
        fileSize: fileItem.file.size,
        status: trackStatus,
        metadata: {
          version: parsedData.version,
          originalName: fileItem.file.name,
        },
        createdAt: now,
        updatedAt: now,
      };

      addTrack(track);

      const importRecord: ImportRecord = {
        id: generateId(),
        fileName: fileItem.file.name,
        fileSize: fileItem.file.size,
        status: 'success',
        importedAt: now,
        trackId,
      };
      addImportRecord(importRecord);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: 'success', progress: 100 } : f
        )
      );
    }

    setIsProcessing(false);
  };

  const successCount = files.filter((f) => f.status === 'success').length;
  const failedCount = files.filter((f) => f.status === 'failed').length;

  return (
    <div>
      <PageHeader
        title="导入面板"
        subtitle="批量导入音频文件，支持中英文混合文件名解析，坏文件自动隔离不影响整批处理"
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => useAppStore.getState().loadMockData()}
              className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium text-sm"
            >
              加载示例数据
            </button>
            {files.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 text-olive-600 hover:text-olive-800 transition-colors"
              >
                清空列表
              </button>
            )}
          </div>
        }
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 bg-white/50',
          isDragging
            ? 'border-amber-500 bg-amber-50 scale-[1.02]'
            : 'border-olive-300 hover:border-olive-400'
        )}
      >
        <input
          type="file"
          id="file-input"
          multiple
          accept=".mp3,.wav,.flac,.aac,.m4a,.ogg"
          onChange={handleFileSelect}
          className="hidden"
        />
        <label
          htmlFor="file-input"
          className="cursor-pointer flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-olive-100 rounded-full flex items-center justify-center mb-4">
            <Upload size={32} className="text-olive-600" />
          </div>
          <p className="text-lg font-medium text-olive-800 mb-2">
            拖拽文件到此处，或点击选择文件
          </p>
          <p className="text-sm text-olive-500">
            支持 MP3、WAV、FLAC、AAC、M4A、OGG 格式，单文件最大 500MB
          </p>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl font-semibold text-olive-900">
              文件列表 ({files.length})
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-moss-600">
                <CheckCircle size={16} /> {successCount} 成功
              </span>
              <span className="flex items-center gap-1 text-brick-600">
                <AlertCircle size={16} /> {failedCount} 失败
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-soft overflow-hidden">
            {files.map((fileItem, index) => (
              <div
                key={fileItem.id}
                className={cn(
                  'flex items-center gap-4 p-4 border-b border-cream-200 last:border-b-0 animate-slide-in',
                  { 'bg-brick-50': fileItem.status === 'failed' }
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-10 h-10 bg-olive-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileAudio size={20} className="text-olive-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-olive-900 truncate">
                    {fileItem.file.name}
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-olive-500">
                      {formatFileSize(fileItem.file.size)}
                    </span>
                    {fileItem.parsedData && (
                      <span className="text-amber-600">
                        解析: {fileItem.parsedData.trackName}
                        {fileItem.parsedData.artist && ` - ${fileItem.parsedData.artist}`}
                      </span>
                    )}
                    {fileItem.errorReason && (
                      <span className="text-brick-600">{fileItem.errorReason}</span>
                    )}
                  </div>
                  {fileItem.status === 'processing' && (
                    <div className="mt-2 h-1 bg-cream-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${fileItem.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {fileItem.status === 'processing' && (
                    <Loader2 size={20} className="text-amber-500 animate-spin" />
                  )}
                  {fileItem.status === 'success' && (
                    <CheckCircle size={20} className="text-moss-500" />
                  )}
                  {fileItem.status === 'failed' && (
                    <AlertCircle size={20} className="text-brick-500" />
                  )}
                  {fileItem.status === 'pending' && (
                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className="p-1 hover:bg-cream-200 rounded transition-colors"
                    >
                      <X size={20} className="text-olive-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-4">
            <button
              onClick={processFiles}
              disabled={isProcessing || files.every((f) => f.status !== 'pending')}
              className={cn(
                'px-8 py-3 rounded-lg font-medium transition-all duration-200',
                isProcessing || files.every((f) => f.status !== 'pending')
                  ? 'bg-olive-300 text-white cursor-not-allowed'
                  : 'bg-olive-700 text-white hover:bg-olive-800 hover:shadow-lg active:scale-95'
              )}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  处理中...
                </span>
              ) : (
                '开始处理'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
