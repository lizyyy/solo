import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileAudio, Image, FileText, ListMusic, CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { WeekSelector } from '@/components/common/WeekSelector';
import { FileListItem } from '@/components/common/FileListItem';
import { StatCard } from '@/components/common/StatCard';
import { useFileImport } from '@/hooks/useFileImport';
import { useAppStore } from '@/store/useAppStore';
import { useTrackMatcher } from '@/hooks/useTrackMatcher';
import { FileItem } from '@/types';

export default function ImportPage() {
  const navigate = useNavigate();
  const { currentRecordId, files } = useAppStore();
  const { progress, importFiles, resetProgress } = useFileImport();
  const { autoMatch } = useTrackMatcher();
  const [isDragging, setIsDragging] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [importedFiles, setImportedFiles] = useState<FileItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFiles = currentRecordId 
    ? files.filter(f => f.recordId === currentRecordId)
    : importedFiles;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!currentRecordId) {
      alert('请先选择一个周次');
      return;
    }
    
    await processFiles(e.dataTransfer.files);
  }, [currentRecordId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentRecordId) {
      alert('请先选择一个周次');
      return;
    }
    
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  }, [currentRecordId]);

  const processFiles = async (fileList: FileList) => {
    if (!currentRecordId) return;
    
    resetProgress();
    setShowResults(false);
    
    const result = await importFiles(fileList);
    
    if (result) {
      setImportedFiles(result.files);
      setShowResults(true);
      
      const hasTracklist = result.files.some(f => f.type === 'tracklist');
      const hasAudio = result.files.some(f => f.type === 'audio');
      
      if (hasTracklist && hasAudio) {
        setTimeout(() => {
          autoMatch();
        }, 500);
      }
    }
  };

  const handleClick = () => {
    if (!currentRecordId) {
      alert('请先选择一个周次');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    resetProgress();
    setShowResults(false);
    setImportedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const successCount = currentFiles.filter(f => f.status === 'success').length;
  const warningCount = currentFiles.filter(f => f.status === 'warning').length;
  const errorCount = currentFiles.filter(f => f.status === 'error').length;

  const typeCounts = {
    audio: currentFiles.filter(f => f.type === 'audio').length,
    image: currentFiles.filter(f => f.type === 'image').length,
    text: currentFiles.filter(f => f.type === 'text').length,
    tracklist: currentFiles.filter(f => f.type === 'tracklist').length,
  };

  return (
    <div>
      <WeekSelector />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="成功导入"
          value={successCount}
          icon={CheckCircle2}
          color="success"
          className="stagger-1"
        />
        <StatCard
          title="有异常"
          value={warningCount}
          icon={AlertTriangle}
          color="warning"
          className="stagger-2"
        />
        <StatCard
          title="导入失败"
          value={errorCount}
          icon={XCircle}
          color="danger"
          className="stagger-3"
        />
        <StatCard
          title="总计文件"
          value={currentFiles.length}
          icon={Upload}
          color="default"
          className="stagger-4"
        />
      </div>

      {currentRecordId && (
        <>
          <div
            className={`
              card mb-6 border-2 border-dashed transition-all duration-300 cursor-pointer
              ${isDragging 
                ? 'border-studio-amber bg-studio-amber/5 drag-active' 
                : 'border-gray-300 hover:border-studio-amber/50 hover:bg-studio-amber/[0.02]'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,image/*,.txt,.csv,.md"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            <div className="py-12 text-center">
              <div className={`
                w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-colors
                ${isDragging ? 'bg-studio-amber/20' : 'bg-studio-amber/10'}
              `}>
                <Upload className={`w-8 h-8 ${isDragging ? 'text-studio-amber' : 'text-studio-amber/70'}`} />
              </div>
              
              <h3 className="font-serif text-lg font-bold text-studio-text mb-2">
                拖拽文件到这里，或点击选择
              </h3>
              <p className="text-sm text-studio-textMuted mb-4">
                支持音频文件、图片截图、曲目表文本、群聊记录等
              </p>
              
              <div className="flex items-center justify-center gap-4 text-xs text-studio-textMuted">
                <span className="flex items-center gap-1">
                  <FileAudio className="w-3.5 h-3.5 text-studio-amber" />
                  音频
                </span>
                <span className="flex items-center gap-1">
                  <Image className="w-3.5 h-3.5 text-blue-500" />
                  图片
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  文本
                </span>
                <span className="flex items-center gap-1">
                  <ListMusic className="w-3.5 h-3.5 text-green-500" />
                  曲目表
                </span>
              </div>
            </div>
          </div>

          {progress.status === 'processing' && (
            <div className="card mb-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-studio-text">
                  正在处理 {progress.currentFile}
                </span>
                <span className="text-sm text-studio-textMuted font-mono">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-studio-amber transition-all duration-300 rounded-full"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {showResults && progress.results && (
            <div className="card mb-6 bg-studio-amber/5 border border-studio-amber/30 animate-bounce-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-studio-amber/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-studio-amber" />
                  </div>
                  <div>
                    <p className="font-medium text-studio-text">
                      导入完成！
                    </p>
                    <p className="text-sm text-studio-textMuted">
                      成功 {progress.results.success} 个 · 
                      异常 {progress.results.warning} 个 · 
                      失败 {progress.results.error} 个
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    className="btn-ghost flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    重新导入
                  </button>
                  <button
                    onClick={() => navigate('/review')}
                    className="btn-primary flex items-center gap-1"
                  >
                    去核对材料
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentFiles.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg font-bold text-white">
                  已导入的文件
                </h2>
                <div className="flex items-center gap-3 text-xs text-white/60">
                  {typeCounts.audio > 0 && (
                    <span className="flex items-center gap-1">
                      <FileAudio className="w-3 h-3" />
                      音频 {typeCounts.audio}
                    </span>
                  )}
                  {typeCounts.image > 0 && (
                    <span className="flex items-center gap-1">
                      <Image className="w-3 h-3" />
                      图片 {typeCounts.image}
                    </span>
                  )}
                  {typeCounts.text > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      文本 {typeCounts.text}
                    </span>
                  )}
                  {typeCounts.tracklist > 0 && (
                    <span className="flex items-center gap-1">
                      <ListMusic className="w-3 h-3" />
                      曲目表 {typeCounts.tracklist}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentFiles.map((file, index) => (
                  <div key={file.id} className={`stagger-${Math.min(index % 6 + 1, 6)}`}>
                    <FileListItem file={file} />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => navigate('/review')}
                  className="btn-primary flex items-center gap-2"
                  disabled={currentFiles.filter(f => f.type === 'tracklist').length === 0}
                >
                  开始核对材料
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!currentRecordId && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
            <ListMusic className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-serif text-lg font-bold text-studio-text mb-2">
            先选一个周次吧
          </h3>
          <p className="text-sm text-studio-textMuted">
            上面的周次选择器点一下，或者加载小样例数据试试
          </p>
        </div>
      )}
    </div>
  );
}
