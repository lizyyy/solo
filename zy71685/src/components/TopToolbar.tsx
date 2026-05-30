import React, { useRef, useState } from 'react';
import { useAppStore } from '@/store';
import {
  Play,
  Pause,
  SkipBack,
  Upload,
  Search,
  RotateCcw,
  FileDown,
  ZoomIn,
  ZoomOut,
  Maximize,
  Music,
  Clock,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { formatTime } from '@/types';

interface TopToolbarProps {
  onExportClick: () => void;
}

export default function TopToolbar({ onExportClick }: TopToolbarProps) {
  const {
    currentRehearsal,
    rehearsals,
    setCurrentRehearsal,
    uploadAudio,
    runDetection,
    undoOperation,
    togglePlayback,
    isPlaying,
    playbackTime,
    audioTrack,
    zoomView,
    viewRange,
    setViewRange,
    isAnalyzing,
    analysisProgress,
    operationLogs,
    selectionRange,
    setSelectionRange,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRehearsalMenu, setShowRehearsalMenu] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAudio(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRunDetection = async () => {
    if (selectionRange) {
      await runDetection(undefined, selectionRange);
      setSelectionRange(null);
    } else {
      await runDetection();
    }
  };

  const handleUndo = async () => {
    const lastUndoable = [...operationLogs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find((log) => ['confirm', 'reject', 'manual_add'].includes(log.operationType));

    if (lastUndoable) {
      await undoOperation(lastUndoable.id);
    }
  };

  const handleZoomIn = () => zoomView(1.5);
  const handleZoomOut = () => zoomView(0.67);
  const handleZoomFit = () => {
    if (audioTrack) {
      setViewRange([0, audioTrack.duration]);
    }
  };

  const hasUndoable = operationLogs.some((log) =>
    ['confirm', 'reject', 'manual_add'].includes(log.operationType)
  );

  const viewDuration = viewRange[1] - viewRange[0];

  return (
    <div className="bg-bg-card border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-text-primary">
                儿童合奏错音定位
              </h1>
              <p className="text-xs text-text-tertiary">少儿乐团排练音频分析工具</p>
            </div>
          </div>

          <div className="w-px h-8 bg-border mx-2" />

          <div className="relative">
            <button
              onClick={() => setShowRehearsalMenu(!showRehearsalMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-bg-subtle rounded-lg hover:bg-bg-subtle/80 transition-colors min-w-[180px]"
            >
              <div className="flex-1 text-left">
                <div className="text-xs text-text-tertiary">当前排练</div>
                <div className="text-sm font-medium text-text-primary truncate">
                  {currentRehearsal?.name || '未选择'}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-text-tertiary" />
            </button>

            {showRehearsalMenu && (
              <div className="absolute top-full left-0 mt-1 w-full bg-bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {rehearsals.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setCurrentRehearsal(r.id);
                      setShowRehearsalMenu(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-bg-subtle transition-colors ${
                      r.id === currentRehearsal?.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-text-primary">{r.name}</div>
                    <div className="text-xs text-text-tertiary">{r.date}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-bg-subtle rounded-lg px-3 py-1.5">
            <Clock className="w-4 h-4 text-text-tertiary" />
            <span className="font-mono text-sm text-text-primary tabular-nums">
              {formatTime(playbackTime)}
            </span>
            <span className="text-text-tertiary">/</span>
            <span className="font-mono text-sm text-text-secondary tabular-nums">
              {formatTime(audioTrack?.duration || 0)}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-bg-subtle rounded-lg p-1">
            <button
              onClick={() => zoomView(2)}
              className="p-2 rounded hover:bg-bg-card text-text-secondary hover:text-text-primary transition-colors"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => zoomView(0.5)}
              className="p-2 rounded hover:bg-bg-card text-text-secondary hover:text-text-primary transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={handleZoomFit}
              className="p-2 rounded hover:bg-bg-card text-text-secondary hover:text-text-primary transition-colors"
              title="适应窗口"
            >
              <Maximize className="w-4 h-4" />
            </button>
            <span className="text-xs text-text-tertiary px-2 min-w-[60px] text-center">
              {viewDuration < 10
                ? `${viewDuration.toFixed(1)}s`
                : viewDuration < 60
                ? `${viewDuration.toFixed(0)}s`
                : `${(viewDuration / 60).toFixed(1)}m`}
            </span>
          </div>

          <div className="w-px h-8 bg-border" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => {}}
              className="p-2.5 rounded-lg bg-bg-subtle text-text-secondary hover:text-text-primary hover:bg-bg-subtle/80 transition-colors"
              title="跳转到开始"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlayback}
              className="p-3 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors shadow-lg shadow-primary/20"
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          </div>

          <div className="w-px h-8 bg-border" />

          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex items-center gap-2"
              title="上传音频"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">上传</span>
            </button>

            <button
              onClick={handleRunDetection}
              disabled={isAnalyzing}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              title={selectionRange ? '重新计算选中区域' : '运行检测'}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden sm:inline">分析中 {Math.round(analysisProgress)}%</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {selectionRange ? '重算选区' : '运行检测'}
                  </span>
                </>
              )}
            </button>

            <button
              onClick={handleUndo}
              disabled={!hasUndoable}
              className="btn-secondary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="撤回上一步操作"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">撤回</span>
            </button>

            <button
              onClick={onExportClick}
              className="btn-secondary flex items-center gap-2"
              title="导出报告"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">导出</span>
            </button>

            <button
              className="p-2.5 rounded-lg bg-bg-subtle text-text-secondary hover:text-text-primary hover:bg-bg-subtle/80 transition-colors"
              title="设置"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mt-3 h-1 bg-bg-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
